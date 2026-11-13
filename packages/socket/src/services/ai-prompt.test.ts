import { distributeDifficulties } from "@rahoot/common/utils/difficulty"
import { describe, expect, it } from "vitest"
import {
  TONE_INSTRUCTIONS,
  WRITING_RULES,
  buildExplanationsSection,
  buildQuestionSchemas,
  buildTimingSection,
} from "@rahoot/socket/services/ai-prompt"

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

describe("briques du prompt de l'atelier", () => {
  it("impose la durée choisie, ou la laisse libre en mode auto", () => {
    expect(buildTimingSection(30)).toContain(`set "time" to exactly 30`)
    expect(buildTimingSection(null)).toContain("that fits its difficulty")
  })

  it("n'exige la carte réponse que si les explications sont demandées", () => {
    expect(buildExplanationsSection(true)).toContain(
      `"answerReveal": { "enabled": true`,
    )
    expect(buildExplanationsSection(false)).toContain(
      `Do NOT include an "answerReveal" field`,
    )
  })

  it("décrit chaque format de question, sans recherche d'image", () => {
    const schemas = buildQuestionSchemas()

    for (const type of [
      "mcq",
      "true_false",
      "open",
      "slider",
      "date",
      "puzzle",
    ]) {
      expect(schemas).toContain(`"type": "${type}"`)
    }
    expect(schemas).not.toContain("imageQuery")
  })

  it("garde des tons sobres et des règles de rédaction natives", () => {
    expect(TONE_INSTRUCTIONS.fun).toContain("pub-quiz host")
    expect(TONE_INSTRUCTIONS.epic).toContain("epic, dramatic")
    expect(WRITING_RULES).toContain("NATIVE speaker")
  })
})
