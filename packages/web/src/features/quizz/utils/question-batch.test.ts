import { describe, expect, it } from "vitest"
import { duplicateQuestionBatch, removeQuestionBatch } from "./question-batch"

const questions = [
  { id: "a", question: "A" },
  { id: "b", question: "B" },
  { id: "c", question: "C" },
  { id: "d", question: "D" },
]

describe("actions groupées sur les questions", () => {
  it("supprime uniquement les identifiants demandés et garde une question active", () => {
    const result = removeQuestionBatch(questions, ["a", "c"])
    expect(result?.questions.map((question) => question.id)).toEqual(["b", "d"])
    expect(result?.activeIndex).toBe(0)
  })

  it("refuse de supprimer toutes les questions", () => {
    expect(removeQuestionBatch(questions, ["a", "b", "c", "d"])).toBeNull()
  })

  it("duplique dans l'ordre du quiz, après la dernière question choisie", () => {
    const ids = ["copy-a", "copy-c"]
    const result = duplicateQuestionBatch(
      questions,
      ["c", "a"],
      () => ids.shift()!,
    )
    expect(result?.questions.map((question) => question.id)).toEqual([
      "a",
      "b",
      "c",
      "copy-a",
      "copy-c",
      "d",
    ])
    expect(result?.copies.map((question) => question.question)).toEqual([
      "A",
      "C",
    ])
    expect(result?.activeIndex).toBe(3)
  })
})
