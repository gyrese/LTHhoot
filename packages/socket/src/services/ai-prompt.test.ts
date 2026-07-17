import { distributeDifficulties } from "@rahoot/common/utils/difficulty"
import { describe, expect, it } from "vitest"
import { buildGenerationPrompt } from "@rahoot/socket/services/ai-prompt"

const baseParams = {
  prompt: "Les capitales européennes",
  count: 6,
  questionTypes: ["mcq", "true_false"],
  difficulties: ["medium"] as const,
  tone: "fun",
  language: "auto",
  time: null,
  withExplanations: false,
}

describe("distributeDifficulties", () => {
  it("répartit équitablement quand le compte tombe juste", () => {
    expect(distributeDifficulties(10, ["easy", "expert"])).toEqual([
      { difficulty: "easy", count: 5 },
      { difficulty: "expert", count: 5 },
    ])
  })

  it("donne le reste aux niveaux les plus faciles", () => {
    expect(distributeDifficulties(10, ["easy", "medium", "expert"])).toEqual([
      { difficulty: "easy", count: 4 },
      { difficulty: "medium", count: 3 },
      { difficulty: "expert", count: 3 },
    ])
  })

  it("réordonne les niveaux du plus facile au plus difficile", () => {
    expect(distributeDifficulties(2, ["expert", "easy"])).toEqual([
      { difficulty: "easy", count: 1 },
      { difficulty: "expert", count: 1 },
    ])
  })

  it("conserve le total demandé", () => {
    const slices = distributeDifficulties(7, ["easy", "medium", "hard"])
    const total = slices.reduce((sum, slice) => sum + slice.count, 0)

    expect(total).toBe(7)
  })

  it("n'émet pas de tranche vide quand il y a moins de questions que de niveaux", () => {
    const slices = distributeDifficulties(2, [
      "easy",
      "medium",
      "hard",
      "expert",
    ])

    expect(slices).toEqual([
      { difficulty: "easy", count: 1 },
      { difficulty: "medium", count: 1 },
    ])
  })

  it("retombe sur medium si aucun niveau n'est fourni", () => {
    expect(distributeDifficulties(3, [])).toEqual([
      { difficulty: "medium", count: 3 },
    ])
  })
})

describe("buildGenerationPrompt", () => {
  it("injecte le sujet et le nombre demandé", () => {
    const prompt = buildGenerationPrompt({
      ...baseParams,
      difficulties: ["medium"],
    })

    expect(prompt).toContain("Les capitales européennes")
    expect(prompt).toContain("exactly 6 quiz questions")
  })

  it("détaille la répartition quand plusieurs niveaux sont mélangés", () => {
    const prompt = buildGenerationPrompt({
      ...baseParams,
      count: 10,
      difficulties: ["easy", "expert"],
    })

    expect(prompt).toContain(`exactly 5 question(s) with "difficulty": "easy"`)
    expect(prompt).toContain(
      `exactly 5 question(s) with "difficulty": "expert"`,
    )
    // Le ton ne doit pas dériver avec la difficulté.
    expect(prompt).toContain("Keep the TONE identical across all levels")
  })

  it("change d'instruction de ton selon le registre choisi", () => {
    const fun = buildGenerationPrompt({ ...baseParams, tone: "fun" })
    const epic = buildGenerationPrompt({ ...baseParams, tone: "epic" })

    expect(fun).toContain("cool, fun, dynamic")
    expect(epic).toContain("epic, dramatic")
    expect(epic).not.toContain("cool, fun, dynamic")
  })

  it("retombe sur le ton par défaut si le registre est inconnu", () => {
    const prompt = buildGenerationPrompt({
      ...baseParams,
      tone: "n-importe-quoi",
    })

    expect(prompt).toContain("cool, fun, dynamic")
  })

  it("impose la durée choisie, ou la laisse libre en mode auto", () => {
    const fixed = buildGenerationPrompt({ ...baseParams, time: 30 })
    const auto = buildGenerationPrompt({ ...baseParams, time: null })

    expect(fixed).toContain(`set "time" to exactly 30`)
    expect(auto).toContain("that fits its difficulty")
  })

  it("réclame toujours une description de quiz", () => {
    const prompt = buildGenerationPrompt(baseParams)

    expect(prompt).toContain(`"description"`)
    expect(prompt).toContain(`{ "description": "...", "questions": [ ... ] }`)
  })

  it("n'exige la carte réponse que si les explications sont demandées", () => {
    const withExplanations = buildGenerationPrompt({
      ...baseParams,
      withExplanations: true,
    })
    const without = buildGenerationPrompt(baseParams)

    expect(withExplanations).toContain(`"answerReveal": { "enabled": true`)
    expect(without).toContain(`Do NOT include an "answerReveal" field`)
  })

  it("force la langue demandée et n'ajoute les consignes que si elles existent", () => {
    const withInstructions = buildGenerationPrompt({
      ...baseParams,
      language: "en",
      instructions: "Évite les dates",
    })
    const without = buildGenerationPrompt(baseParams)

    expect(withInstructions).toContain("in ENGLISH")
    expect(withInstructions).toContain("Évite les dates")
    expect(without).not.toContain("Additional instructions")
  })
})
