import type { McqQuestion } from "@rahoot/common/types/game"
import { describe, expect, it } from "vitest"
import { moveMcqAnswer, removeMcqAnswer } from "./mcq-answer-actions"
import { defaultAnswerBoxes } from "@rahoot/web/features/game/utils/question-layout"

const question: McqQuestion = {
  type: "mcq",
  question: "Exemple",
  answers: ["A", "B", "C", "D"],
  solutions: [1, 3],
  cooldown: 5,
  time: 20,
  layout: {
    answers: [
      { x: 1, y: 0, width: 10, height: 10 },
      { x: 2, y: 0, width: 10, height: 10 },
      { x: 3, y: 0, width: 10, height: 10 },
      { x: 4, y: 0, width: 10, height: 10 },
    ],
  },
}

describe("gestion des réponses QCM", () => {
  it("déplace une réponse avec son état correct sans déplacer les cases", () => {
    const patch = moveMcqAnswer(question, 1, 1)
    expect(patch).toMatchObject({
      answers: ["A", "C", "B", "D"],
      solutions: [2, 3],
    })
    expect(patch?.layout).toBeUndefined()
    expect(moveMcqAnswer(question, 0, -1)).toBeNull()
  })

  it("retire une réponse au milieu et réaligne solutions et mise en page", () => {
    const patch = removeMcqAnswer(question, 1)
    expect(patch).toMatchObject({
      answers: ["A", "C", "D"],
      solutions: [2],
    })
    expect(patch?.layout?.answers?.map((box) => box.x)).toEqual([1, 3, 4])
  })

  it("conserve une bonne réponse et au moins deux choix", () => {
    const onlyFirstCorrect = { ...question, solutions: [0] }
    expect(removeMcqAnswer(onlyFirstCorrect, 0)?.solutions).toEqual([0])
    expect(removeMcqAnswer({ ...question, answers: ["A", "B"] }, 0)).toBeNull()
  })

  it("réaligne la grille après suppression d'une réponse au milieu", () => {
    const layout = {
      answers: defaultAnswerBoxes(4).map((box, index) => ({
        ...box,
        fill: `color-${index}`,
      })),
    }
    const patch = removeMcqAnswer({ ...question, layout }, 1)!
    expect(patch.layout?.answers).toEqual(
      defaultAnswerBoxes(3).map((box, index) => ({
        ...box,
        fill: `color-${[0, 2, 3][index]}`,
      })),
    )
    const next = { ...question, ...patch } as McqQuestion
    const two = removeMcqAnswer(next, 2)!
    expect(two.layout?.answers).toEqual(
      defaultAnswerBoxes(2).map((box, index) => ({
        ...box,
        fill: `color-${[0, 2][index]}`,
      })),
    )
  })
})
