import type {
  Answer,
  DateQuestion,
  DropPinQuestion,
  GameResult,
  McqQuestion,
  Player,
  PuzzleQuestion,
  QuestionResult,
  SliderQuestion,
  TitleQuestion,
  TrueFalseQuestion,
  OpenQuestion,
} from "@rahoot/common/types/game"
import { describe, expect, it, vi } from "vitest"
import {
  calculateAwards,
  checkAnswer,
  detectTopTie,
  timeToPoint,
} from "@rahoot/socket/utils/game"

// Champs communs à toutes les questions (BaseQuestion), sans intérêt pour les
// tests de scoring — factorisés pour ne pas polluer chaque cas de test.
const base = { question: "Q", cooldown: 5, time: 20 }

const buildAnswer = (overrides: Partial<Answer> = {}): Answer => ({
  playerId: "p1",
  points: 0,
  ...overrides,
})

describe("checkAnswer", () => {
  describe("mcq", () => {
    const question: McqQuestion = {
      ...base,
      type: "mcq",
      answers: ["A", "B", "C"],
      solutions: [0, 2],
    }

    it("valide une bonne réponse", () => {
      expect(checkAnswer(question, buildAnswer({ answerId: 0 }))).toBe(true)
    })

    it("rejette une mauvaise réponse", () => {
      expect(checkAnswer(question, buildAnswer({ answerId: 1 }))).toBe(false)
    })

    it("valide n'importe laquelle des solutions multiples", () => {
      expect(checkAnswer(question, buildAnswer({ answerId: 2 }))).toBe(true)
    })

    it("rejette une réponse absente", () => {
      expect(checkAnswer(question, buildAnswer({}))).toBe(false)
    })
  })

  describe("true_false", () => {
    it("valide la solution 0", () => {
      const question: TrueFalseQuestion = {
        ...base,
        type: "true_false",
        solution: 0,
      }

      expect(checkAnswer(question, buildAnswer({ answerId: 0 }))).toBe(true)
      expect(checkAnswer(question, buildAnswer({ answerId: 1 }))).toBe(false)
    })

    it("valide la solution 1", () => {
      const question: TrueFalseQuestion = {
        ...base,
        type: "true_false",
        solution: 1,
      }

      expect(checkAnswer(question, buildAnswer({ answerId: 1 }))).toBe(true)
      expect(checkAnswer(question, buildAnswer({ answerId: 0 }))).toBe(false)
    })
  })

  describe("open", () => {
    const question: OpenQuestion = {
      ...base,
      type: "open",
      correctAnswers: ["Paris", "La Ville Lumière"],
    }

    it("valide une correspondance exacte", () => {
      expect(checkAnswer(question, buildAnswer({ textAnswer: "Paris" }))).toBe(
        true,
      )
    })

    it("ignore la casse et les espaces superflus", () => {
      expect(
        checkAnswer(question, buildAnswer({ textAnswer: "  pARIS  " })),
      ).toBe(true)
    })

    it("rejette une réponse incorrecte", () => {
      expect(checkAnswer(question, buildAnswer({ textAnswer: "Lyon" }))).toBe(
        false,
      )
    })
  })

  describe("date", () => {
    const question: DateQuestion = {
      ...base,
      type: "date",
      correctYear: 1789,
      tolerance: 5,
    }

    it("valide une réponse dans la tolérance", () => {
      expect(checkAnswer(question, buildAnswer({ numberAnswer: 1793 }))).toBe(
        true,
      )
    })

    it("valide une réponse exacte", () => {
      expect(checkAnswer(question, buildAnswer({ numberAnswer: 1789 }))).toBe(
        true,
      )
    })

    it("rejette une réponse hors tolérance", () => {
      expect(checkAnswer(question, buildAnswer({ numberAnswer: 1800 }))).toBe(
        false,
      )
    })
  })

  describe("slider", () => {
    const question: SliderQuestion = {
      ...base,
      type: "slider",
      correctValue: 50,
      min: 0,
      max: 100,
      tolerance: 3,
    }

    it("valide une réponse dans la tolérance", () => {
      expect(checkAnswer(question, buildAnswer({ numberAnswer: 52 }))).toBe(
        true,
      )
    })

    it("rejette une réponse hors tolérance", () => {
      expect(checkAnswer(question, buildAnswer({ numberAnswer: 60 }))).toBe(
        false,
      )
    })
  })

  describe("puzzle", () => {
    const question: PuzzleQuestion = {
      ...base,
      type: "puzzle",
      items: ["A", "B", "C"],
    }

    it("valide un ordre correct", () => {
      expect(
        checkAnswer(question, buildAnswer({ orderAnswer: [0, 1, 2] })),
      ).toBe(true)
    })

    it("rejette un ordre incorrect", () => {
      expect(
        checkAnswer(question, buildAnswer({ orderAnswer: [1, 0, 2] })),
      ).toBe(false)
    })

    it("rejette une longueur différente du nombre d'items", () => {
      expect(checkAnswer(question, buildAnswer({ orderAnswer: [0, 1] }))).toBe(
        false,
      )
    })
  })

  describe("drop_pin", () => {
    const question: DropPinQuestion = {
      ...base,
      type: "drop_pin",
      pinImage: "map.png",
      zones: [
        {
          id: "z1",
          x: 100,
          y: 100,
          width: 10,
          height: 10,
          label: "Zone 1",
          isCorrect: true,
        },
      ],
    }

    it("valide un point à l'intérieur du seuil de proximité (20)", () => {
      // distance = sqrt(10^2 + 10^2) ≈ 14.14 <= 20
      expect(
        checkAnswer(question, buildAnswer({ textAnswer: "110:110" })),
      ).toBe(true)
    })

    it("rejette un point hors du seuil de proximité", () => {
      // distance = sqrt(50^2 + 50^2) ≈ 70.7 > 20
      expect(
        checkAnswer(question, buildAnswer({ textAnswer: "150:150" })),
      ).toBe(false)
    })

    it("rejette un format de réponse invalide", () => {
      expect(
        checkAnswer(question, buildAnswer({ textAnswer: "not-a-point" })),
      ).toBe(false)
    })

    it("retourne true quand la liste de zones est vide (comportement actuel du code)", () => {
      const questionSansZones: DropPinQuestion = { ...question, zones: [] }

      expect(
        checkAnswer(questionSansZones, buildAnswer({ textAnswer: "0:0" })),
      ).toBe(true)
    })
  })

  it("retourne false pour un type de question sans logique de correction (branche par défaut)", () => {
    const question: TitleQuestion = { ...base, type: "title" }

    expect(checkAnswer(question, buildAnswer({ answerId: 0 }))).toBe(false)
  })
})

describe("detectTopTie", () => {
  const player = (overrides: Partial<Player>): Player => ({
    id: overrides.clientId ?? "id",
    clientId: "id",
    connected: true,
    username: "user",
    points: 0,
    streak: 0,
    ...overrides,
  })

  it("retourne null quand il n'y a aucune égalité", () => {
    const leaderboard: Player[] = [
      player({ clientId: "a", username: "Alice", points: 900 }),
      player({ clientId: "b", username: "Bob", points: 700 }),
      player({ clientId: "c", username: "Carla", points: 500 }),
    ]

    expect(detectTopTie(leaderboard)).toBeNull()
  })

  it("détecte une égalité entre les deux premiers", () => {
    const leaderboard: Player[] = [
      player({ clientId: "a", username: "Alice", points: 900 }),
      player({ clientId: "b", username: "Bob", points: 900 }),
      player({ clientId: "c", username: "Carla", points: 500 }),
    ]

    expect(detectTopTie(leaderboard)).toEqual(["a", "b"])
  })

  it("retourne null pour une égalité hors du podium (rang 4+)", () => {
    const leaderboard: Player[] = [
      player({ clientId: "a", username: "Alice", points: 900 }),
      player({ clientId: "b", username: "Bob", points: 700 }),
      player({ clientId: "c", username: "Carla", points: 500 }),
      player({ clientId: "d", username: "Dan", points: 300 }),
      player({ clientId: "e", username: "Eve", points: 300 }),
    ]

    expect(detectTopTie(leaderboard)).toBeNull()
  })

  it("détecte une égalité qui déborde sur le podium (rang 3 et 4)", () => {
    const leaderboard: Player[] = [
      player({ clientId: "a", username: "Alice", points: 900 }),
      player({ clientId: "b", username: "Bob", points: 700 }),
      player({ clientId: "c", username: "Carla", points: 500 }),
      player({ clientId: "d", username: "Dan", points: 500 }),
    ]

    expect(detectTopTie(leaderboard)).toEqual(["c", "d"])
  })
})

describe("calculateAwards", () => {
  const player = (overrides: Partial<Player>): Player => ({
    id: overrides.clientId ?? "id",
    clientId: "id",
    connected: true,
    username: "user",
    points: 0,
    streak: 0,
    ...overrides,
  })

  const buildQuestion = (
    playerAnswers: QuestionResult["playerAnswers"],
  ): QuestionResult => ({
    ...base,
    type: "mcq",
    answers: ["A", "B"],
    solutions: [0],
    playerAnswers,
  })

  it("calcule les awards sur un cas nominal (fastest, sniper, loser, comeback)", () => {
    const results: GameResult[] = [
      {
        id: "quiz-1",
        subject: "Quiz 1",
        date: "2026-01-01",
        players: [
          { username: "Carla", points: 900, rank: 1 },
          { username: "Bob", points: 600, rank: 2 },
          { username: "Alice", points: 0, rank: 3 },
        ],
        questions: [
          buildQuestion([
            { playerName: "Alice", answerId: 0, points: 800, timeMs: 1200 },
            { playerName: "Bob", answerId: 1, points: 0, timeMs: 3000 },
            { playerName: "Carla", answerId: 0, points: 900, timeMs: 500 },
          ]),
          buildQuestion([
            { playerName: "Alice", answerId: 0, points: 700, timeMs: 1500 },
            { playerName: "Bob", answerId: 0, points: 600, timeMs: 2000 },
            { playerName: "Carla", answerId: 1, points: 0, timeMs: 4000 },
          ]),
          buildQuestion([
            { playerName: "Alice", answerId: 0, points: 750, timeMs: 1000 },
            { playerName: "Bob", answerId: 1, points: 0, timeMs: 2500 },
            { playerName: "Carla", answerId: 0, points: 850, timeMs: 700 },
          ]),
        ],
      },
    ]

    // Classement final cumulé (soirée) : Alice termine 1ère alors qu'elle
    // était dernière au premier quiz -> "comeback".
    const finalLeaderboard: Player[] = [
      player({ clientId: "alice", username: "Alice", points: 500 }),
      player({ clientId: "bob", username: "Bob", points: 300 }),
      player({ clientId: "carla", username: "Carla", points: 100 }),
    ]

    const awards = calculateAwards(results, finalLeaderboard)

    expect(awards).toContainEqual({
      type: "fastest",
      playerName: "Carla",
      value: 500,
    })
    expect(awards).toContainEqual({
      type: "sniper",
      playerName: "Alice",
      value: 100,
    })
    expect(awards).toContainEqual({ type: "loser", playerName: "Carla" })
    expect(awards).toContainEqual({
      type: "comeback",
      playerName: "Alice",
      value: 2,
    })
    expect(awards).toHaveLength(4)
  })

  it("ne retourne aucun award quand il n'y a aucune réponse (tableaux vides)", () => {
    expect(calculateAwards([], [])).toEqual([])
  })
})

describe("timeToPoint", () => {
  const START = 1_700_000_000_000

  it("retourne ~1000 points au tout début du temps imparti", () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)

    expect(timeToPoint(START, 20)).toBe(1000)

    vi.useRealTimers()
  })

  it("retourne ~500 points à mi-parcours du temps imparti", () => {
    vi.useFakeTimers()
    vi.setSystemTime(START + 10_000)

    expect(timeToPoint(START, 20)).toBe(500)

    vi.useRealTimers()
  })

  it("retourne 0 (plancher) une fois le temps imparti dépassé", () => {
    vi.useFakeTimers()
    vi.setSystemTime(START + 25_000)

    expect(timeToPoint(START, 20)).toBe(0)

    vi.useRealTimers()
  })
})
