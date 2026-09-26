import type { Question } from "@rahoot/common/types/game"
import {
  countPlayableQuestions,
  estimateQuizzDurationSec,
} from "@rahoot/common/utils/round-duration"
import { describe, expect, it } from "vitest"

const questions = [
  { type: "title", question: "Intro", cooldown: 5, time: 0 },
  {
    type: "mcq",
    question: "?",
    answers: ["a", "b"],
    solutions: [0],
    cooldown: 5,
    time: 20,
  },
] as Question[]

describe("estimation d'un quiz (QuizzMeta)", () => {
  it("ne compte pas les slides titre comme questions", () => {
    expect(countPlayableQuestions(questions)).toBe(1)
  })

  it("somme préambule, lecture, réponse et résultats", () => {
    // 6 (départ) + 5 (slide titre) + 4 (« Prêt ? ») + 5 + 20 + 8 (résultats)
    expect(estimateQuizzDurationSec(questions)).toBe(48)
    expect(estimateQuizzDurationSec([])).toBe(0)
  })
})
