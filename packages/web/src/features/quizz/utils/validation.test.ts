import { describe, expect, it, vi } from "vitest"
import { createEditorValidator, getEditorIssues } from "./validation"
import {
  questionValidator,
  quizzValidator,
} from "@rahoot/common/validators/quizz"

const base = { question: "Question", cooldown: 5, time: 20 }
const mcq = { ...base, type: "mcq", answers: ["A", "B"], solutions: [0] }
describe("editor validation", () => {
  it("keeps each empty answer addressable, including the quiz title", () => {
    const issues = getEditorIssues({
      subject: "",
      questions: [{ ...mcq, answers: ["", ""] }],
    })
    expect(issues.map((issue) => issue.path)).toEqual([
      "subject",
      "questions.0.answers.0",
      "questions.0.answers.1",
    ])
    expect(issues[2]).toMatchObject({ questionIndex: 0, field: "Réponse 2" })
    expect(issues[0].message).toBe("Donnez un titre au quiz.")
    expect(issues[2].message).toBe("Renseignez le texte de cette réponse.")
  })
  it("uses the save schema for all ten question types", () => {
    const questions = [
      mcq,
      { ...base, type: "true_false", solution: 1 },
      { ...base, type: "open", correctAnswers: ["A"] },
      {
        ...base,
        type: "image_sequence",
        images: ["/image.png"],
        correctAnswers: ["A"],
      },
      { ...base, type: "date", correctYear: 2000, tolerance: 1 },
      {
        ...base,
        type: "slider",
        min: 0,
        max: 10,
        correctValue: 5,
        tolerance: 1,
      },
      { ...base, type: "puzzle", items: ["A", "B"] },
      {
        ...base,
        type: "drop_pin",
        pinImage: "/image.png",
        zones: [
          {
            id: "a",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            label: "A",
            isCorrect: true,
          },
        ],
      },
      {
        ...base,
        type: "grid",
        cellsPerRow: 2,
        cells: [{ image: "/a.png" }, { image: "/b.png" }],
        correctIndexes: [0],
      },
      { ...base, type: "title", question: "", cooldown: 120 },
    ]
    for (const question of questions) {
      const document = { subject: "Quiz", questions: [question] }
      expect(quizzValidator.safeParse(document).success).toBe(true)
      expect(getEditorIssues(document)).toEqual([])
      expect(createEditorValidator()(document)).toEqual(
        getEditorIssues(document),
      )
      const invalid = { ...document, questions: [{ ...question, time: 0 }] }
      expect(getEditorIssues(invalid)[0]).toMatchObject({
        path: "questions.0.time",
        message: "Choisissez une durée d’au moins 5 secondes.",
      })
      expect(createEditorValidator()(invalid)).toEqual(getEditorIssues(invalid))
    }
  })
  it("validates only the changed question in a large quiz and keeps error positions after reordering", () => {
    const validate = createEditorValidator()
    const questions = Array.from({ length: 250 }, (_, index) => ({
      ...mcq,
      question: `Question ${index}`,
    }))
    const parse = vi.spyOn(questionValidator, "safeParse")
    try {
      expect(validate({ subject: "Quiz", questions })).toEqual([])
      expect(parse).toHaveBeenCalledTimes(250)
      parse.mockClear()

      const modified = questions.map((question, index) =>
        index === 120 ? { ...question, question: "" } : question,
      )
      expect(
        validate({ subject: "Quiz", questions: modified })[0].questionIndex,
      ).toBe(120)
      expect(parse).toHaveBeenCalledTimes(1)
      parse.mockClear()

      const reversed = [...modified].reverse()
      expect(
        validate({ subject: "Quiz", questions: reversed })[0].questionIndex,
      ).toBe(129)
      expect(parse).not.toHaveBeenCalled()
      expect(validate({ subject: "", questions: reversed })[0].path).toBe(
        "subject",
      )
    } finally {
      parse.mockRestore()
    }
  })
  it("tracks corrections and reordering instead of keeping stale errors", () => {
    const invalid = { ...mcq, question: "" }
    expect(
      getEditorIssues({ subject: "Quiz", questions: [mcq, invalid] })[0]
        .questionIndex,
    ).toBe(1)
    expect(
      getEditorIssues({ subject: "Quiz", questions: [invalid, mcq] })[0]
        .questionIndex,
    ).toBe(0)
    expect(getEditorIssues({ subject: "Quiz", questions: [mcq, mcq] })).toEqual(
      [],
    )
  })
  it("preserves cross-field errors and explains missing correct answers", () => {
    const questions = [
      {
        ...base,
        type: "slider",
        min: 10,
        max: 5,
        correctValue: 20,
        tolerance: 0,
      },
      { ...mcq, solutions: [] },
    ]
    const issues = getEditorIssues({ subject: "Quiz", questions })
    expect(issues.map((issue) => issue.path)).toEqual([
      "questions.0.max",
      "questions.0.correctValue",
      "questions.1.solutions",
    ])
    expect(issues[2].message).toBe(
      "Sélectionnez au moins une bonne réponse valide.",
    )
  })
})
