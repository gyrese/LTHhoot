// @vitest-environment jsdom
import { expect, it } from "vitest"
import {
  applyWorkshopOperations,
  emptySession,
  loadSession,
  numberedTargets,
  type DraftQuestion,
} from "./workshop"

const question = {
  type: "mcq" as const,
  question: "Question ?",
  answers: ["Oui", "Non"],
  solutions: [0],
  time: 45,
  cooldown: 5,
}
const draft: DraftQuestion[] = [
  { id: "a", question, locked: true, selected: true },
  { id: "b", question, locked: false, selected: false },
]

it("preserves untouched questions, ids and selections during replacement", () => {
  const next = applyWorkshopOperations(draft, [
    {
      type: "replace",
      id: "b",
      question: { ...question, question: "Autre question ?" },
    },
  ])
  expect(next[0]).toBe(draft[0])
  expect(next[1]).toMatchObject({ id: "b", selected: false, locked: false })
  expect(draft[1].question.question).toBe("Question ?")
})
it("keeps the entire draft on invalid or protected changes", () => {
  expect(() =>
    applyWorkshopOperations(draft, [
      { type: "remove", id: "b" },
      { type: "remove", id: "a" },
    ]),
  ).toThrow()
  expect(draft).toHaveLength(2)
})
it("restores a saved conversation and safely ignores corrupted backups", () => {
  const session = {
    ...emptySession(),
    questions: draft,
    messages: [{ role: "user", text: "Plus difficile" }],
  }
  localStorage.setItem("workshop-test", JSON.stringify(session))
  expect(loadSession("workshop-test")).toEqual(session)
  localStorage.setItem("workshop-test", "broken")
  expect(loadSession("workshop-test")).toEqual(emptySession())
  localStorage.removeItem("workshop-test")
})

it("scopes numbered requests without interpreting a requested count as a target", () => {
  expect(numberedTargets("Remplace les questions 1 et 2", draft)).toEqual([
    "a",
    "b",
  ])
  expect(numberedTargets("Crée 10 questions Disney", draft)).toBeUndefined()
  expect(() => numberedTargets("Change la question 7", draft)).toThrow()
})
