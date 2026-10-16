import { expect, it } from "vitest"
import {
  workshopRequestValidator,
  type WorkshopRequest,
} from "@rahoot/common/validators/ai-workshop"
import { buildWorkshopPrompt, parseWorkshopResult } from "./ai-workshop"

const question = {
  type: "mcq" as const,
  question: "Quelle planète est rouge ?",
  answers: ["Mars", "Vénus"],
  solutions: [0],
  time: 45,
  cooldown: 5,
}
const request: WorkshopRequest = {
  message: "Remplace la question 2",
  history: [],
  questions: [
    { id: "protected", locked: true, question },
    {
      id: "editable",
      locked: false,
      question: { ...question, question: "Quelle planète a des anneaux ?" },
    },
  ],
  existingQuestions: ["Quelle est la capitale de la France ?"],
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
const replacement = {
  ...question,
  question: "Quelle planète est la plus proche du Soleil ?",
  answers: ["Mercure", "Mars"],
}

it("accepts a targeted replacement while keeping stable ids", () => {
  const result = parseWorkshopResult(
    {
      message: "Question remplacée.",
      operations: [{ type: "replace", id: "editable", question: replacement }],
    },
    { ...request, targetIds: ["editable"] },
  )
  expect(result.operations).toHaveLength(1)
  expect(result.operations[0]).toMatchObject({
    type: "replace",
    id: "editable",
  })
})
it("rejects changes to locked, unknown or untargeted ids", () => {
  for (const id of ["protected", "missing", "editable"]) {
    expect(() =>
      parseWorkshopResult(
        {
          message: "OK",
          operations: [{ type: "replace", id, question: replacement }],
        },
        { ...request, targetIds: ["protected"] },
      ),
    ).toThrow()
  }
})
it("rejects duplicate operations and malformed questions atomically", () => {
  expect(() =>
    parseWorkshopResult(
      {
        message: "OK",
        operations: [
          { type: "remove", id: "editable" },
          { type: "replace", id: "editable", question: replacement },
        ],
      },
      request,
    ),
  ).toThrow()
  expect(() =>
    parseWorkshopResult(
      {
        message: "OK",
        operations: [
          { type: "add", question: { ...replacement, solutions: [9] } },
        ],
      },
      request,
    ),
  ).toThrow()
})
it("rejects repeats of the quiz or unchanged draft and caps total count", () => {
  for (const title of [
    question.question,
    "Quelle est la capitale de la France ?",
  ]) {
    expect(() =>
      parseWorkshopResult(
        {
          message: "OK",
          operations: [
            { type: "add", question: { ...replacement, question: title } },
          ],
        },
        request,
      ),
    ).toThrow(/doublon/u)
  }
  expect(() =>
    parseWorkshopResult(
      { message: "OK", operations: [{ type: "add", question: replacement }] },
      {
        ...request,
        questions: Array.from({ length: 20 }, (_, i) => ({
          id: String(i),
          question: { ...question, question: `Question ${i} ?` },
          locked: false,
        })),
      },
    ),
  ).toThrow(/20/u)
})
it("allows discussion without changes and strips invented media", () => {
  expect(
    parseWorkshopResult({ message: "Quel public ?", operations: [] }, request)
      .operations,
  ).toEqual([])
  const result = parseWorkshopResult(
    {
      message: "OK",
      operations: [
        {
          type: "add",
          question: {
            ...replacement,
            background: {
              type: "image",
              value: "https://invented.example/image.png",
            },
          },
        },
      ],
    },
    request,
  )
  expect(result.operations[0]).toMatchObject({
    question: { background: undefined },
  })
})
it("rejects additions on a targeted turn and invalid request ids", () => {
  expect(() =>
    parseWorkshopResult(
      { message: "OK", operations: [{ type: "add", question: replacement }] },
      { ...request, targetIds: ["editable"] },
    ),
  ).toThrow()
  expect(
    workshopRequestValidator.safeParse({ ...request, targetIds: ["missing"] })
      .success,
  ).toBe(false)
  expect(
    workshopRequestValidator.safeParse({
      ...request,
      questions: [request.questions[0], request.questions[0]],
    }).success,
  ).toBe(false)
})
it("provides numbered draft, existing quiz and bounded history as context", () => {
  const prompt = buildWorkshopPrompt({
    ...request,
    history: [{ role: "user", text: "Disney pour adultes" }],
  })
  expect(prompt).toContain('"number":2')
  expect(prompt).toContain("Disney pour adultes")
  expect(prompt).toContain("NEVER alter or remove a locked question")
  expect(prompt).toContain("never claim you checked sources")
})
