import type { Answer, Player } from "@rahoot/common/types/game"
import { describe, expect, it } from "vitest"
import { buildOpenAnswersList } from "@rahoot/socket/utils/open-answers"

const buildPlayer = (overrides: Partial<Player>): Player => ({
  id: "id",
  clientId: "id",
  connected: true,
  username: "user",
  points: 0,
  streak: 0,
  ...overrides,
})

const buildAnswer = (overrides: Partial<Answer>): Answer => ({
  playerId: "p1",
  points: 0,
  ...overrides,
})

describe("buildOpenAnswersList", () => {
  const players: Player[] = [
    buildPlayer({ id: "p1", username: "Alice" }),
    buildPlayer({ id: "p2", username: "Bob" }),
  ]

  it("construit la liste avec le texte, le pseudo et la validité de chaque réponse", () => {
    const answers: Answer[] = [
      buildAnswer({ playerId: "p1", textAnswer: "Paris" }),
      buildAnswer({ playerId: "p2", textAnswer: "Lyon" }),
    ]

    const result = buildOpenAnswersList(answers, players, ["Paris"])

    expect(result).toEqual([
      { text: "Paris", playerName: "Alice", isCorrect: true },
      { text: "Lyon", playerName: "Bob", isCorrect: false },
    ])
  })

  it("ignore la casse et les espaces superflus pour juger la validité, mais préserve le texte original (trim uniquement)", () => {
    const answers: Answer[] = [
      buildAnswer({ playerId: "p1", textAnswer: "  pARIS  " }),
    ]

    const result = buildOpenAnswersList(answers, players, ["Paris"])

    expect(result).toEqual([
      { text: "pARIS", playerName: "Alice", isCorrect: true },
    ])
  })

  it("ignore les accents pour juger la validité", () => {
    const answers: Answer[] = [
      buildAnswer({ playerId: "p1", textAnswer: "Éléphant" }),
    ]

    const result = buildOpenAnswersList(answers, players, ["elephant"])

    expect(result).toEqual([
      { text: "Éléphant", playerName: "Alice", isCorrect: true },
    ])
  })

  it("filtre les réponses sans texte (undefined ou chaîne vide)", () => {
    const answers: Answer[] = [
      buildAnswer({ playerId: "p1", textAnswer: undefined }),
      buildAnswer({ playerId: "p2", textAnswer: "" }),
    ]

    expect(buildOpenAnswersList(answers, players, ["Paris"])).toEqual([])
  })

  it("attribue '?' comme pseudo quand le joueur n'est pas trouvé", () => {
    const answers: Answer[] = [
      buildAnswer({ playerId: "unknown", textAnswer: "Paris" }),
    ]

    const result = buildOpenAnswersList(answers, players, ["Paris"])

    expect(result[0]!.playerName).toBe("?")
  })
})
