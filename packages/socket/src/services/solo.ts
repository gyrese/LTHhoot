import type {
  Answer,
  PlayerAnswerRecord,
  Question,
  QuizzWithId,
} from "@rahoot/common/types/game"
import type {
  SoloAnswerAck,
  SoloAnswerPayload,
  SoloNextAck,
  SoloPublicQuestion,
  SoloSolution,
} from "@rahoot/common/types/solo"
import { checkAnswer } from "@rahoot/socket/utils/game"
import { randomBytes, randomInt } from "node:crypto"

// Solo public chronométré et corrigé côté serveur.
//
// Le client ne reçoit qu'UNE question à la fois, sans sa solution, horodatée
// par le serveur à l'envoi. La réponse est corrigée ici avec la logique du jeu
// live (`checkAnswer`), si bien que TOUS les types de question sont scorés de
// la même façon qu'en partie. Le temps de réponse est mesuré entre deux
// horodatages serveur : le client ne fournit plus ni `timeMs` ni `startedAt`.

// Latence réseau tolérée après la fin du temps imparti (aller-retour mobile).
export const SOLO_ANSWER_GRACE_MS = 1500
// Durée plancher MOYENNE par réponse : en dessous, personne n'a eu le temps de
// lire les énoncés — la partie vient d'un script. Volontairement bas (un
// joueur très rapide reste largement au-dessus) : on vise les bots.
export const MIN_SOLO_ANSWER_MS = 1000
// Barème solo : 1000 pts par bonne réponse + bonus de rapidité jusqu'à 500.
export const SOLO_BASE_POINTS = 1000
export const SOLO_MAX_SPEED_BONUS = 500

const DEFAULT_QUESTION_TIME = 20
const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const MAX_SESSIONS = 5000

type SoloQuestionEntry = {
  // Index de la question dans le quiz (résultats archivés)
  originalIndex: number
  question: Question
  // Puzzle : ordre d'affichage → index d'origine de chaque élément
  order?: number[]
}

export type SoloSession = {
  id: string
  quizz: QuizzWithId
  playerName: string
  socialContact?: string
  questions: SoloQuestionEntry[]
  // Index (solo) de la question servie, -1 avant la première
  current: number
  servedAt: number
  endsAt: number
  answered: boolean
  // Détail par question (index solo) : temps serveur et trace archivée
  records: (PlayerAnswerRecord | undefined)[]
  totalPoints: number
  correctCount: number
  lastActivityAt: number
}

const timeLimitMs = (question: Question) =>
  (question.time || DEFAULT_QUESTION_TIME) * 1000

// Mélange de Fisher-Yates (générateur cryptographique) qui n'est jamais
// l'identité dès qu'il y a deux éléments : un puzzle servi dans le bon ordre
// donnerait la solution.
const shuffledOrder = (length: number): number[] => {
  const order = Array.from({ length }, (_, i) => i)

  if (length < 2) {
    return order
  }

  do {
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1)
      const tmp = order[i]!

      order[i] = order[j]!
      order[j] = tmp
    }
  } while (order.every((value, index) => value === index))

  return order
}

// Question telle qu'envoyée au joueur : aucun champ de solution.
export const toSoloPublicQuestion = (
  question: Question,
  order?: number[],
): SoloPublicQuestion | null => {
  const base = {
    question: question.question,
    media: question.media,
    background: question.background,
    backgroundOpacity: question.backgroundOpacity,
    elements: question.elements,
    audio: question.audio,
    time: question.time || DEFAULT_QUESTION_TIME,
    revelationEnabled: question.revelationEnabled,
    revealDuration: question.revealDuration,
    gridCols: question.gridCols,
    gridRows: question.gridRows,
    revelationStyle: question.revelationStyle,
  }

  switch (question.type) {
    case "mcq":
      return { ...base, type: "mcq", answers: question.answers }

    case "true_false":
      return { ...base, type: "true_false" }

    case "open":
      return { ...base, type: "open" }

    case "image_sequence":
      return {
        ...base,
        type: "image_sequence",
        images: question.images,
        imageInterval: question.imageInterval,
      }

    case "date":
      return {
        ...base,
        type: "date",
        tolerance: question.tolerance,
        minYear: question.minYear,
        maxYear: question.maxYear,
      }

    case "slider":
      return {
        ...base,
        type: "slider",
        tolerance: question.tolerance,
        min: question.min,
        max: question.max,
      }

    case "puzzle": {
      const displayOrder = order ?? question.items.map((_, i) => i)

      return {
        ...base,
        type: "puzzle",
        items: displayOrder.map((index) => question.items[index]!),
      }
    }

    case "drop_pin":
      return { ...base, type: "drop_pin", pinImage: question.pinImage }

    case "grid":
      return {
        ...base,
        type: "grid",
        cells: question.cells,
        cellsPerRow: question.cellsPerRow,
      }

    default:
      // Slide titre : rien à jouer en solo.
      return null
  }
}

// Correction affichée après la réponse (mêmes données que l'écran de
// résultats du jeu live).
export const soloSolutionOf = (question: Question): SoloSolution => {
  switch (question.type) {
    case "mcq":
      return { solutions: question.solutions }

    case "true_false":
      return { solutions: [question.solution] }

    case "open":
      return { correctAnswers: question.correctAnswers }

    case "image_sequence":
      return { correctAnswers: question.correctAnswers }

    case "date":
      return {
        correctYear: question.correctYear,
        tolerance: question.tolerance,
      }

    case "slider":
      return {
        correctValue: question.correctValue,
        tolerance: question.tolerance,
      }

    case "puzzle":
      return { items: question.items }

    case "drop_pin":
      return { zones: question.zones }

    case "grid":
      return { solutions: question.correctIndexes }

    default:
      return {}
  }
}

// Points d'une bonne réponse selon le temps SERVEUR écoulé.
export const soloPoints = (elapsedMs: number, limitMs: number): number =>
  SOLO_BASE_POINTS +
  Math.max(
    0,
    Math.round(SOLO_MAX_SPEED_BONUS * (1 - Math.max(0, elapsedMs) / limitMs)),
  )

// Puzzle : la réponse du client porte sur l'ordre AFFICHÉ, on la ramène aux
// index d'origine. Une réponse incohérente (doublons, hors bornes) est fausse.
const toOriginalOrder = (
  orderAnswer: number[] | undefined,
  order: number[] | undefined,
): number[] | undefined => {
  if (!orderAnswer || !order) {
    return orderAnswer
  }

  const isPermutation =
    orderAnswer.length === order.length &&
    new Set(orderAnswer).size === order.length &&
    orderAnswer.every((index) => index >= 0 && index < order.length)

  return isPermutation ? orderAnswer.map((index) => order[index]!) : []
}

export class SoloSessions {
  private readonly sessions = new Map<string, SoloSession>()

  get size(): number {
    return this.sessions.size
  }

  // Ouvre une session. `null` si la capacité mémoire est atteinte.
  start(
    quizz: QuizzWithId,
    player: { playerName: string; socialContact?: string },
    now = Date.now(),
  ): SoloSession | null {
    this.sweep(now)

    if (this.sessions.size >= MAX_SESSIONS) {
      return null
    }

    const questions: SoloQuestionEntry[] = quizz.questions.flatMap(
      (question, originalIndex) => {
        if (question.type === "title") {
          return []
        }

        return [
          {
            originalIndex,
            question,
            order:
              question.type === "puzzle"
                ? shuffledOrder(question.items.length)
                : undefined,
          },
        ]
      },
    )

    const session: SoloSession = {
      id: randomBytes(16).toString("hex"),
      quizz,
      playerName: player.playerName,
      socialContact: player.socialContact,
      questions,
      current: -1,
      servedAt: 0,
      endsAt: 0,
      answered: false,
      records: [],
      totalPoints: 0,
      correctCount: 0,
      lastActivityAt: now,
    }

    this.sessions.set(session.id, session)

    return session
  }

  get(id: string, now = Date.now()): SoloSession | undefined {
    const session = this.sessions.get(id)

    if (!session || now - session.lastActivityAt > SESSION_TTL_MS) {
      this.sessions.delete(id)

      return undefined
    }

    session.lastActivityAt = now

    return session
  }

  delete(id: string) {
    this.sessions.delete(id)
  }

  // Sert la question suivante, horodatée. Refusé tant que la question en
  // cours n'a été ni répondue ni expirée : impossible de « feuilleter » le quiz
  // pour chercher les réponses avant de jouer.
  static next(session: SoloSession, now = Date.now()): SoloNextAck {
    const hasCurrent = session.current >= 0

    if (hasCurrent && !session.answered && now < session.endsAt) {
      return { ok: false, error: "errors:quizz.questionInProgress" }
    }

    const nextIndex = session.current + 1
    const entry = session.questions[nextIndex]

    if (!entry) {
      session.answered = true

      return { ok: true, done: true }
    }

    const question = toSoloPublicQuestion(entry.question, entry.order)

    if (!question) {
      return { ok: false, error: "errors:quizz.notFound" }
    }

    session.current = nextIndex
    session.answered = false
    session.servedAt = now
    session.endsAt = now + timeLimitMs(entry.question)

    return {
      ok: true,
      done: false,
      questionIndex: nextIndex,
      totalQuestions: session.questions.length,
      question,
      servedAt: session.servedAt,
      endsAt: session.endsAt,
    }
  }

  // Corrige la réponse à la question servie. Une réponse vide (temps écoulé
  // côté client) ou tardive est comptée fausse, mais la correction est tout de
  // même renvoyée pour l'affichage.
  static answer(
    session: SoloSession,
    questionIndex: number,
    payload: SoloAnswerPayload,
    now = Date.now(),
  ): SoloAnswerAck {
    const entry = session.questions[session.current]

    if (!entry || questionIndex !== session.current) {
      return { ok: false, error: "errors:quizz.questionNotServed" }
    }

    if (session.answered) {
      return { ok: false, error: "errors:quizz.alreadyAnswered" }
    }

    session.answered = true

    const elapsedMs = now - session.servedAt
    const late = now > session.endsAt + SOLO_ANSWER_GRACE_MS
    const hasAnswer =
      payload.answerId !== undefined ||
      payload.textAnswer !== undefined ||
      payload.numberAnswer !== undefined ||
      payload.orderAnswer !== undefined

    const answer: Answer = {
      playerId: session.id,
      answerId: payload.answerId,
      textAnswer: payload.textAnswer,
      numberAnswer: payload.numberAnswer,
      orderAnswer: toOriginalOrder(payload.orderAnswer, entry.order),
      points: 0,
    }

    const correct = hasAnswer && !late && checkAnswer(entry.question, answer)
    const points = correct
      ? soloPoints(elapsedMs, timeLimitMs(entry.question))
      : 0

    if (correct) {
      session.correctCount += 1
      session.totalPoints += points
    }

    session.records[session.current] = hasAnswer
      ? {
          playerName: session.playerName,
          answerId: answer.answerId ?? null,
          textAnswer: answer.textAnswer ?? null,
          numberAnswer: answer.numberAnswer ?? null,
          orderAnswer: answer.orderAnswer ?? null,
          points,
          timeMs: elapsedMs,
        }
      : undefined

    return {
      ok: true,
      correct,
      points,
      totalPoints: session.totalPoints,
      late,
      solution: soloSolutionOf(entry.question),
    }
  }

  // Fin de partie atteinte : dernière question servie, puis répondue ou
  // expirée. Empêche d'enregistrer un score avant d'avoir tout joué.
  static isFinished(session: SoloSession, now = Date.now()): boolean {
    const isLast = session.current >= session.questions.length - 1

    return isLast && (session.answered || now >= session.endsAt)
  }

  // Contrôle anti-bot de fin de partie, sur les temps SERVEUR : la moyenne
  // des réponses données doit dépasser la durée plancher.
  static isTooFast(session: SoloSession): boolean {
    const times = session.records
      .filter((record): record is PlayerAnswerRecord => Boolean(record))
      .map((record) => record.timeMs ?? 0)

    if (times.length === 0) {
      return false
    }

    const total = times.reduce((sum, time) => sum + time, 0)

    return total < MIN_SOLO_ANSWER_MS * times.length
  }

  // Détail par question INDEXÉ COMME LE QUIZ (résultats archivés).
  static recordsByQuizzIndex(
    session: SoloSession,
  ): (PlayerAnswerRecord | undefined)[] {
    const byIndex: (PlayerAnswerRecord | undefined)[] = []

    session.questions.forEach((entry, soloIndex) => {
      byIndex[entry.originalIndex] = session.records[soloIndex]
    })

    return byIndex
  }

  private sweep(now: number) {
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > SESSION_TTL_MS) {
        this.sessions.delete(id)
      }
    }
  }
}
