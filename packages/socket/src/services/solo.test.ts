import type { Question, QuizzWithId } from "@rahoot/common/types/game"
import {
  SOLO_ANSWER_GRACE_MS,
  SOLO_BASE_POINTS,
  SoloSessions,
  soloPoints,
  toSoloPublicQuestion,
} from "@rahoot/socket/services/solo"
import { describe, expect, it } from "vitest"

const base = { question: "Q", cooldown: 5, time: 10 }

const quizz: QuizzWithId = {
  id: "quiz1",
  subject: "Solo",
  questions: [
    { ...base, type: "title" },
    { ...base, type: "mcq", answers: ["a", "b", "c"], solutions: [2] },
    { ...base, type: "puzzle", items: ["un", "deux", "trois"] },
    {
      ...base,
      type: "grid",
      cells: [{ image: "x" }, { image: "y" }],
      cellsPerRow: 2,
      correctIndexes: [1],
    },
  ] as Question[],
}

const SOLUTION_KEYS = [
  "solutions",
  "solution",
  "correctAnswers",
  "correctYear",
  "correctValue",
  "correctIndexes",
  "zones",
]

describe("solo — questions publiques", () => {
  it("ne contient aucun champ de solution, quel que soit le type", () => {
    const questions: Question[] = [
      ...quizz.questions,
      { ...base, type: "true_false", solution: 1 },
      { ...base, type: "open", correctAnswers: ["paris"] },
      { ...base, type: "date", correctYear: 1789, tolerance: 0 },
      {
        ...base,
        type: "slider",
        correctValue: 5,
        min: 0,
        max: 10,
        tolerance: 1,
      },
      {
        ...base,
        type: "drop_pin",
        pinImage: "map.png",
        zones: [
          {
            id: "z",
            x: 1,
            y: 1,
            width: 5,
            height: 5,
            label: "",
            isCorrect: true,
          },
        ],
      },
      {
        ...base,
        type: "image_sequence",
        images: ["a.png"],
        correctAnswers: ["chat"],
      },
    ] as Question[]

    for (const question of questions) {
      const publicQuestion = toSoloPublicQuestion(question)

      for (const key of SOLUTION_KEYS) {
        expect(publicQuestion ?? {}).not.toHaveProperty(key)
      }
    }
  })

  it("transmet la mise en page et la police résolue, sans solution", () => {
    const layout = {
      title: { x: 0, y: 0, width: 800, height: 100 },
      answers: [{ x: 0, y: 900, width: 400, height: 100, fill: "#123456" }],
    }
    const question = {
      ...base,
      type: "mcq",
      answers: ["a", "b"],
      solutions: [1],
      layout,
    } as Question

    const fromQuizz = toSoloPublicQuestion(question, undefined, "Roboto")
    expect(fromQuizz).toMatchObject({ layout, fontFamily: "Roboto" })
    expect(fromQuizz).not.toHaveProperty("solutions")

    const own = toSoloPublicQuestion(
      { ...question, fontFamily: "Lobster" },
      undefined,
      "Roboto",
    )
    expect(own?.fontFamily).toBe("Lobster")
  })

  it("sert la police du quiz dans la question suivante", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(
      { ...quizz, fontFamily: "Poppins" },
      { playerName: "Léa" },
      0,
    )!
    const next = SoloSessions.next(session, 1000)

    expect(next.ok && !next.done && next.question.fontFamily).toBe("Poppins")
  })

  it("exclut les slides titre", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(quizz, { playerName: "Léa" }, 0)!

    expect(session.questions).toHaveLength(3)
  })
})

describe("solo — session chronométrée", () => {
  it("corrige côté serveur avec le temps serveur", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(quizz, { playerName: "Léa" }, 0)!

    const next = SoloSessions.next(session, 1000)

    expect(next).toMatchObject({ ok: true, done: false, questionIndex: 0 })

    // Réponse juste 2 s après l'envoi (sur 10 s).
    const ack = SoloSessions.answer(session, 0, { answerId: 2 }, 3000)

    expect(ack).toMatchObject({
      ok: true,
      correct: true,
      points: soloPoints(2000, 10_000),
      solution: { solutions: [2] },
    })
    expect(session.records[0]?.timeMs).toBe(2000)
  })

  it("refuse de servir la question suivante avant réponse ou expiration", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(quizz, { playerName: "Léa" }, 0)!

    SoloSessions.next(session, 0)

    expect(SoloSessions.next(session, 5000)).toMatchObject({ ok: false })
    // Temps écoulé : la question suivante est servie.
    expect(SoloSessions.next(session, 10_001)).toMatchObject({
      ok: true,
      questionIndex: 1,
    })
  })

  it("compte fausse une réponse hors délai mais renvoie la correction", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(quizz, { playerName: "Léa" }, 0)!

    SoloSessions.next(session, 0)
    const ack = SoloSessions.answer(
      session,
      0,
      { answerId: 2 },
      10_000 + SOLO_ANSWER_GRACE_MS + 1,
    )

    expect(ack).toMatchObject({ ok: true, correct: false, late: true })
    expect(SoloSessions.answer(session, 0, { answerId: 2 }, 0)).toMatchObject({
      ok: false,
    })
  })

  it("remet un puzzle mélangé dans l'ordre d'origine avant correction", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(quizz, { playerName: "Léa" }, 0)!

    SoloSessions.next(session, 0)
    SoloSessions.answer(session, 0, {}, 100)

    const served = SoloSessions.next(session, 200)

    if (!served.ok || served.done) {
      throw new Error("puzzle non servi")
    }

    const displayed =
      served.question.type === "puzzle" ? served.question.items : []

    // Jamais servi dans le bon ordre (ce serait la solution).
    expect(displayed).not.toEqual(["un", "deux", "trois"])

    // Le joueur remet les éléments AFFICHÉS dans le bon ordre.
    const orderAnswer = ["un", "deux", "trois"].map((item) =>
      displayed.indexOf(item),
    )
    const ack = SoloSessions.answer(session, 1, { orderAnswer }, 2200)

    expect(ack).toMatchObject({ ok: true, correct: true })
    expect(ack.ok && ack.points).toBeGreaterThanOrEqual(SOLO_BASE_POINTS)
  })

  it("score une question grille (type autrefois non jouable en solo)", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(quizz, { playerName: "Léa" }, 0)!

    SoloSessions.next(session, 0)
    SoloSessions.answer(session, 0, {}, 100)
    SoloSessions.next(session, 200)
    SoloSessions.answer(session, 1, {}, 300)

    expect(SoloSessions.isFinished(session, 400)).toBe(false)
    SoloSessions.next(session, 400)

    expect(
      SoloSessions.answer(session, 2, { answerId: 1 }, 3000),
    ).toMatchObject({ ok: true, correct: true })
    expect(SoloSessions.isFinished(session, 3000)).toBe(true)
    // Détail archivé indexé comme le quiz (le slide titre est l'index 0).
    expect(SoloSessions.recordsByQuizzIndex(session)[3]?.answerId).toBe(1)
  })

  it("détecte une partie jouée trop vite (script)", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(quizz, { playerName: "Bot" }, 0)!

    SoloSessions.next(session, 0)
    SoloSessions.answer(session, 0, { answerId: 2 }, 50)

    expect(SoloSessions.isTooFast(session)).toBe(true)
  })

  it("expire une session inactive", () => {
    const sessions = new SoloSessions()
    const session = sessions.start(quizz, { playerName: "Léa" }, 0)!

    expect(sessions.get(session.id, 1000)).toBe(session)
    expect(sessions.get(session.id, 3 * 60 * 60 * 1000)).toBeUndefined()
  })
})
