import { expect, it } from "vitest"
import type { WorkshopRequest } from "@rahoot/common/validators/ai-workshop"
import {
  applyReview,
  buildReviewUserPrompt,
  reviewCandidates,
  withoutReview,
} from "./ai-review"
import type { ParsedWorkshop } from "./ai-workshop"

const base = {
  type: "mcq" as const,
  answers: ["A", "B"],
  solutions: [0],
  time: 20,
  cooldown: 5,
}
const ask = (question: string) => ({ ...base, question })
const request: WorkshopRequest = {
  message: "4 questions sur la Bretagne",
  brief: "Sujet : Bretagne",
  source: "Saint-Malo fut une république de 1590 à 1594.",
  history: [],
  questions: [
    { id: "draft", locked: false, question: ask("Question du brouillon ?") },
  ],
  existingQuestions: [],
  settings: {
    count: 5,
    tone: "fun",
    language: "fr",
    time: null,
    questionTypes: ["mcq"],
    difficulties: ["medium"],
    withExplanations: false,
  },
}
const draft: ParsedWorkshop = {
  message: "Voici 2 questions.",
  keep: 2,
  operations: [
    { type: "add", question: ask("Q1 ?") },
    {
      type: "add",
      question: ask("En 1790, quelle ville fut une république ?"),
    },
    { type: "add", question: ask("Q3 ?") },
    { type: "add", question: ask("Q4 ?") },
    { type: "remove", id: "draft" },
  ],
}
const titles = (result: { operations: { type: string }[] }) =>
  result.operations.map((operation) =>
    "question" in operation
      ? (operation.question as { question: string }).question
      : operation.type,
  )

it("numbers candidates and gives the editor the brief, request and source", () => {
  const candidates = reviewCandidates(draft)
  expect(candidates.map(({ id }) => id)).toEqual(["c1", "c2", "c3", "c4"])

  const prompt = buildReviewUserPrompt(request, candidates)
  expect(prompt).toContain("Sujet : Bretagne")
  expect(prompt).toContain("4 questions sur la Bretagne")
  expect(prompt).toContain("1590 à 1594")
  expect(prompt).toContain('"id":"c2"')
})

it("applies fixes, drops wrong facts and keeps the best in drafting order", () => {
  const result = applyReview(
    {
      reviews: [
        { id: "c1", verdict: "drop", reason: "Mythe tenace." },
        {
          id: "c2",
          verdict: "fix",
          reason: "C'était en 1590.",
          question: ask("En 1590, quelle ville fut une république ?"),
        },
        { id: "c3", verdict: "keep", reason: null, question: null },
      ],
      // Candidat c4 non classé, c3 passe avant c2 : l'ordre final reste c2, c3.
      selected: ["c3", "c2"],
    },
    draft,
    request,
  )

  expect(titles(result)).toEqual([
    "En 1590, quelle ville fut une république ?",
    "Q3 ?",
    "remove",
  ])
  expect(result.message).toContain("1 correction, 1 proposition écartée")
  expect(result.message).toContain("corrigée — C'était en 1590.")
  expect(result.message).toContain("écartée — Mythe tenace.")
  expect(result.message).not.toContain("de moins que demandé")
})

it("drops a fix that breaks the schema and reports a shortfall", () => {
  const result = applyReview(
    {
      reviews: [
        { id: "c1", verdict: "drop", reason: "Faux." },
        {
          id: "c2",
          verdict: "fix",
          reason: "Date.",
          question: { type: "mcq" },
        },
        { id: "c3", verdict: "drop", reason: "Faux." },
        { id: "c4", verdict: "keep" },
      ],
      selected: ["c4"],
    },
    draft,
    request,
  )

  expect(titles(result)).toEqual(["Q4 ?", "remove"])
  expect(result.message).toContain("3 propositions écartées")
  expect(result.message).toContain(
    "1 question de moins que demandé après relecture",
  )
})

it("keeps a replaced question untouched when its replacement is dropped", () => {
  const replace: ParsedWorkshop = {
    message: "Remplacée.",
    operations: [{ type: "replace", id: "draft", question: ask("Faux ?") }],
  }
  const result = applyReview(
    { reviews: [{ id: "c1", verdict: "drop", reason: "Inexact." }] },
    replace,
    request,
  )

  expect(result.operations).toEqual([])
  expect(result.message).toContain("écartée — Inexact.")
})

it("rejects an unreadable review so the caller can fall back", () => {
  expect(() => applyReview({ nope: true }, draft, request)).toThrow()

  const fallback = withoutReview(draft)
  expect(titles(fallback)).toEqual([
    "Q1 ?",
    "En 1790, quelle ville fut une république ?",
    "remove",
  ])
  expect(fallback.message).toContain("Relecture des faits indisponible")
  expect(withoutReview(draft, false).message).toBe("Voici 2 questions.")
})

it("aligns photo keywords with the kept operations", () => {
  const result = applyReview(
    {
      reviews: [
        { id: "c1", verdict: "keep", imageQuery: "lighthouse brittany" },
        { id: "c2", verdict: "drop", reason: "Faux.", imageQuery: null },
        { id: "c3", verdict: "keep", imageQuery: "  " },
      ],
      selected: ["c1", "c3"],
    },
    draft,
    request,
  )

  expect(titles(result)).toEqual(["Q1 ?", "Q3 ?", "remove"])
  expect(result.imageQueries).toEqual([
    "lighthouse brittany",
    undefined,
    undefined,
  ])
})
