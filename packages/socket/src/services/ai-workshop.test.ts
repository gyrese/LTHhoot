import { expect, it } from "vitest"
import {
  workshopRequestValidator,
  type WorkshopRequest,
} from "@rahoot/common/validators/ai-workshop"
import {
  buildWorkshopSystemPrompt,
  buildWorkshopUserPrompt,
  parseWorkshopResult,
} from "./ai-workshop"

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

it("accepts any text format the author asks for, beyond the default types", () => {
  const open = {
    type: "open",
    question: "Quel studio a produit Toy Story ?",
    correctAnswers: ["pixar"],
    time: 20,
    cooldown: 5,
  }
  const result = (question: unknown) => ({
    message: "OK",
    operations: [{ type: "add", question }],
  })

  expect(buildWorkshopSystemPrompt(request)).toContain("Question types: mcq.")
  expect(buildWorkshopSystemPrompt(request)).toContain("DEFAULT SETTINGS")
  expect(parseWorkshopResult(result(open), request).operations).toEqual([
    expect.objectContaining({
      question: expect.objectContaining({ type: "open" }),
    }),
  ])
  expect(() =>
    parseWorkshopResult(result({ type: "title", title: "Intro" }), request),
  ).toThrow(/exploitable/u)
})

it("keeps valid proposals and reports the discarded ones", () => {
  const result = parseWorkshopResult(
    {
      message: "Voici deux questions.",
      operations: [
        { type: "add", question: replacement },
        { type: "add", question: { ...replacement, solutions: [9] } },
        {
          type: "add",
          question: { ...replacement, question: question.question },
        },
      ],
    },
    request,
  )
  expect(result.operations).toHaveLength(1)
  expect(result.message).toContain("2 propositions écartées")
  expect(result.message).toContain("doublon")
})

it("returns the updated brief and clamps model timings", () => {
  const result = parseWorkshopResult(
    {
      message: "OK",
      brief: "Sujet : Pixar\nPublic : adultes fans",
      operations: [{ type: "add", question: { ...replacement, time: 900 } }],
    },
    request,
  )
  expect(result.brief).toBe("Sujet : Pixar\nPublic : adultes fans")
  expect(result.operations[0]).toMatchObject({ question: { time: 120 } })
  expect(
    parseWorkshopResult({ message: "OK", operations: [] }, request),
  ).not.toHaveProperty("brief")
})

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
it("ignores a second operation on the same id and fails when nothing is usable", () => {
  expect(
    parseWorkshopResult(
      {
        message: "OK",
        operations: [
          { type: "remove", id: "editable" },
          { type: "replace", id: "editable", question: replacement },
        ],
      },
      request,
    ).operations,
  ).toEqual([{ type: "remove", id: "editable" }])
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
it("puts the current request first, with the brief, draft and history as context", () => {
  const prompt = buildWorkshopUserPrompt({
    ...request,
    brief: "Public : adultes fans",
    targetIds: ["editable"],
    history: [{ role: "user", text: "Disney pour adultes" }],
  })
  expect(prompt.startsWith("CURRENT REQUEST:\nRemplace la question 2")).toBe(
    true,
  )
  expect(prompt).toContain("Public : adultes fans")
  expect(prompt).toContain('"number":2')
  expect(prompt).toContain('["editable"]')
  expect(prompt).toContain("Disney pour adultes")
  expect(prompt).toContain("Quelle est la capitale de la France ?")

  const system = buildWorkshopSystemPrompt(request)
  expect(system).toContain("PRIORITY ORDER")
  expect(system).toContain("NEVER alter or remove a locked question")
  expect(system).toContain("never claim you checked sources")
  expect(system).toContain("Wrap EACH new question in its own add operation")
  expect(system).not.toContain('imageQuery"')
  expect(system).not.toContain('{ "description": "...", "questions": [ ... ] }')
})

it("shuffles MCQ options and remaps the correct answers", () => {
  const mcq = {
    ...replacement,
    answers: ["Mercure", "Mars", "Vénus", "Jupiter"],
    solutions: [0],
  }
  const result = parseWorkshopResult(
    { message: "OK", operations: [{ type: "add", question: mcq }] },
    request,
    () => 0,
  )
  const shuffled = result.operations[0] as {
    question: { answers: string[]; solutions: number[] }
  }
  expect(shuffled.question.answers).toEqual([
    "Mars",
    "Vénus",
    "Jupiter",
    "Mercure",
  ])
  expect(shuffled.question.solutions).toEqual([3])

  for (let run = 0; run < 20; run += 1) {
    const { question } = parseWorkshopResult(
      { message: "OK", operations: [{ type: "add", question: mcq }] },
      request,
    ).operations[0] as typeof shuffled
    expect(question.answers[question.solutions[0]]).toBe("Mercure")
    expect([...question.answers].sort()).toEqual([...mcq.answers].sort())
  }
})

it("passes feedback, source and free room to the writer and keeps the target count", () => {
  const prompt = buildWorkshopUserPrompt({
    ...request,
    source: "Mars est la quatrième planète.",
    feedback: [
      { question: "Quelle planète est rouge ?", reason: "Trop facile" },
    ],
  })
  expect(prompt).toContain("FREE ROOM: 18")
  expect(prompt).toContain("Mars est la quatrième planète.")
  expect(prompt).toContain('"reason":"Trop facile"')
  expect(buildWorkshopSystemPrompt(request)).toContain('"keep"')

  const result = parseWorkshopResult(
    {
      message: "OK",
      keep: 1,
      operations: [
        { type: "add", question: replacement },
        { type: "add", question: { ...replacement, solutions: [9] } },
      ],
    },
    request,
  )
  expect(result.keep).toBe(1)
  // Candidat invalide en sur-génération : écarté sans bruit pour l'auteur.
  expect(result.message).toBe("OK")
  expect(result.operations).toHaveLength(1)
})

it("offers explanations on request instead of forbidding them", () => {
  const system = buildWorkshopSystemPrompt(request)
  expect(system).toContain("If the author asks for explanations")
  expect(system).not.toContain("Do NOT include")
})
