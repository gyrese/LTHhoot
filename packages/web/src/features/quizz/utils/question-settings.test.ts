import type { QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { describe, expect, it } from "vitest"
import {
  copyTimingToSimilarQuestions,
  previousQuestionSettings,
} from "./question-settings"

const question = (
  id: string,
  type: "mcq" | "title",
  overrides: Partial<QuestionWithId> = {},
): QuestionWithId =>
  ({
    id,
    type,
    question: id,
    cooldown: 5,
    time: 20,
    ...(type === "mcq" ? { answers: ["A", "B"], solutions: [0] } : {}),
    ...overrides,
  }) as QuestionWithId

describe("reprise des réglages précédents", () => {
  it("ignore les slides de titre et ne copie que le minutage et le score", () => {
    const questions = [
      question("a", "mcq", {
        time: 45,
        cooldown: 8,
        showLeaderboard: true,
        pointsMultiplier: 2,
        suddenDeath: true,
      }),
      question("b", "title", { cooldown: 30 }),
      question("c", "mcq"),
    ]

    expect(previousQuestionSettings(questions, 2)).toEqual({
      sourceIndex: 0,
      patch: {
        cooldown: 8,
        time: 45,
        showLeaderboard: true,
        pointsMultiplier: 2,
        suddenDeath: true,
      },
    })
  })

  it("ne copie que la durée entre slides de titre", () => {
    const questions = [
      question("a", "title", { cooldown: 22 }),
      question("b", "mcq"),
      question("c", "title"),
    ]
    expect(previousQuestionSettings(questions, 2)).toEqual({
      sourceIndex: 0,
      patch: { cooldown: 22 },
    })
    expect(previousQuestionSettings(questions, 0)).toBeNull()
  })
})

describe("application des durées aux slides compatibles", () => {
  it("copie les deux durées entre questions et préserve les slides de titre", () => {
    const questions = [
      question("a", "mcq", { cooldown: 8, time: 45 }),
      question("b", "title", { cooldown: 30, time: 20 }),
      question("c", "mcq", { cooldown: 3, time: 10 }),
    ]

    const result = copyTimingToSimilarQuestions(questions, 0)
    expect(result[1]).toBe(questions[1])
    expect(result[2]).toMatchObject({ cooldown: 8, time: 45 })
    expect(result[2].question).toBe("c")
  })

  it("copie uniquement la durée entre slides de titre", () => {
    const questions = [
      question("a", "title", { cooldown: 60, time: 20 }),
      question("b", "mcq", { cooldown: 5, time: 10 }),
      question("c", "title", { cooldown: 5, time: 15 }),
    ]
    const result = copyTimingToSimilarQuestions(questions, 0)
    expect(result[1]).toBe(questions[1])
    expect(result[2]).toMatchObject({ cooldown: 60, time: 15 })
  })
})
