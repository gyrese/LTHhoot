import { expect, it } from "vitest"
import { previewSolutions } from "./PreviewCorrection"
import type { Question } from "@rahoot/common/types/game"

const base = { question: "Exemple", cooldown: 5, time: 20 }
it("shows the correct labels after reordering MCQ choices and respects false/true indexing", () => {
  expect(
    previewSolutions(
      { ...base, type: "mcq", answers: ["B", "A"], solutions: [1] },
      "Vrai",
      "Faux",
    ),
  ).toEqual(["A"])
  expect(
    previewSolutions(
      { ...base, type: "true_false", solution: 0 },
      "Vrai",
      "Faux",
    ),
  ).toEqual(["Faux"])
  expect(
    previewSolutions(
      { ...base, type: "true_false", solution: 1 },
      "Vrai",
      "Faux",
    ),
  ).toEqual(["Vrai"])
})
it("shows accepted answers, numeric solutions and puzzle order", () => {
  const cases: Array<[Question, string[]]> = [
    [
      { ...base, type: "open", correctAnswers: ["Paris", "paris"] },
      ["Paris", "paris"],
    ],
    [
      {
        ...base,
        type: "image_sequence",
        images: ["/a.png"],
        correctAnswers: ["A"],
      },
      ["A"],
    ],
    [{ ...base, type: "date", correctYear: 2020, tolerance: 1 }, ["2020"]],
    [
      {
        ...base,
        type: "slider",
        min: 0,
        max: 100,
        correctValue: 45,
        tolerance: 0,
      },
      ["45"],
    ],
    [{ ...base, type: "puzzle", items: ["Un", "Deux"] }, ["Un → Deux"]],
    [{ ...base, type: "title" }, []],
  ]
  cases.forEach(([question, expected]) => {
    expect(previewSolutions(question, "Vrai", "Faux")).toEqual(expected)
  })
})
