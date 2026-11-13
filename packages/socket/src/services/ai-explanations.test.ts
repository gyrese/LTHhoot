import { describe, expect, it } from "vitest"
import { buildExplanationsPrompt, parseExplanations } from "./ai-explanations"

describe("explications en lot", () => {
  it("numérote les questions et transmet la bonne réponse", () => {
    const prompt = buildExplanationsPrompt([
      { question: "Capitale de la France ?", solutionText: "Paris" },
      { question: "Année de la prise de la Bastille ?" },
    ])

    expect(prompt).toContain(
      '{"index":0,"question":"Capitale de la France ?","correctAnswer":"Paris"}',
    )
    expect(prompt).toContain(
      '{"index":1,"question":"Année de la prise de la Bastille ?"}',
    )
    expect(prompt).toContain("exactly 2 entries")
  })

  it("rend une explication par question, nettoyée", () => {
    expect(
      parseExplanations('{"explanations":["  Parce que.  ", 42]}', 2),
    ).toEqual(["Parce que.", ""])
  })

  it("refuse une réponse dont le nombre ne correspond pas", () => {
    expect(() => parseExplanations('{"explanations":["a"]}', 2)).toThrow()
    expect(() => parseExplanations('{"autre":[]}', 0)).toThrow()
  })
})
