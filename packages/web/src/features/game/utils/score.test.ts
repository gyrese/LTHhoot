import { describe, expect, it } from "vitest"
import { calculatePercentages } from "./score"

describe("calculatePercentages", () => {
  it("renvoie un objet vide sans réponses", () => {
    expect(calculatePercentages({})).toEqual({})
  })

  it("calcule la part de chaque réponse, arrondie à l'entier", () => {
    expect(calculatePercentages({ 0: 1, 1: 2, 2: 0 })).toEqual({
      0: "33%",
      1: "67%",
      2: "0%",
    })
  })

  it("attribue 100 % à une réponse unique", () => {
    expect(calculatePercentages({ 3: 5 })).toEqual({ 3: "100%" })
  })
})
