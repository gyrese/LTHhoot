import { EVENTS } from "@rahoot/common/constants"
import type { GameResult, GameResultPlayer } from "@rahoot/common/types/game"
import type { SoloSubmitResult } from "@rahoot/common/types/solo"
import { quizzDisplayName } from "@rahoot/common/utils/quizz-name"
import {
  SOLO_RESULT_ID_PREFIX,
  SOLO_RESULT_SUBJECT_PREFIX,
} from "@rahoot/common/utils/result-kind"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import { type SoloSession, SoloSessions } from "@rahoot/socket/services/solo"
import { getClientIp } from "@rahoot/socket/utils/client-ip"
import { RateLimiter } from "@rahoot/socket/utils/rate-limit"
import { parsePayload, replyAck } from "@rahoot/socket/utils/validate"
import { z } from "zod"

// Sessions solo en mémoire (cf. services/solo) : partagées par tous les
// sockets, une session survit donc à une reconnexion du joueur.
const sessions = new SoloSessions()

// Rate-limit des parties publiques : par IP (généreux, un bar entier peut
// sortir par la même IP publique) et par socket.
const startLimitByIp = new RateLimiter(20, 10 * 60_000)
const startLimitBySocket = new RateLimiter(5, 60_000)
const submitLimitByIp = new RateLimiter(20, 10 * 60_000)

const sessionId = z.string().regex(/^[0-9a-f]{32}$/u)

const startSchema = z.object({
  quizzId: z.string().min(1).max(200),
  playerName: z.string().trim().min(1).max(30),
  socialContact: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  human: z.object({ hp: z.string().max(200).optional() }).optional(),
})

const answerSchema = z.object({
  sessionId,
  questionIndex: z.number().int().min(0),
  answerId: z.number().int().min(0).max(1000).optional(),
  textAnswer: z.string().max(500).optional(),
  numberAnswer: z.number().optional(),
  orderAnswer: z.array(z.number().int().min(0).max(1000)).max(100).optional(),
})

const sessionSchema = z.object({ sessionId })

// Enregistre le score d'une session terminée dans le résultat solo du quiz
// (meilleure tentative par pseudo) et renvoie le classement du joueur.
const saveSoloResult = (session: SoloSession): SoloSubmitResult => {
  const { quizz, playerName, socialContact } = session
  const resultId = `${SOLO_RESULT_ID_PREFIX}${quizz.id}`
  let gameResult: GameResult | null = null

  try {
    gameResult = Config.resultById(resultId)
  } catch {
    gameResult = {
      id: resultId,
      subject: `${SOLO_RESULT_SUBJECT_PREFIX}${quizzDisplayName(quizz)}`,
      date: new Date().toISOString(),
      players: [],
      questions: quizz.questions.map((q) => ({
        ...q,
        playerAnswers: [],
      })),
      logs: [],
    }
  }

  const playerKey = playerName.toLowerCase()
  const existingPlayerIdx = gameResult.players.findIndex(
    (p) => p.username.toLowerCase() === playerKey,
  )

  const newPlayerData: GameResultPlayer = {
    username: playerName,
    points: session.totalPoints,
    rank: 1,
    socialContact,
  }

  // Seule la meilleure tentative d'un joueur est conservée : le détail par
  // question doit donc suivre le score retenu, pas la dernière soumission.
  const isBestRun =
    existingPlayerIdx < 0 ||
    session.totalPoints > gameResult.players[existingPlayerIdx].points

  if (existingPlayerIdx >= 0) {
    if (isBestRun) {
      gameResult.players[existingPlayerIdx] = newPlayerData
    }
  } else {
    gameResult.players.push(newPlayerData)
  }

  if (isBestRun) {
    // Trace par question, indexée comme le quiz : sans elle le rapport de
    // résultat du manager n'a rien à afficher pour un joueur solo.
    const answerRecords = SoloSessions.recordsByQuizzIndex(session)

    gameResult.questions = gameResult.questions.map((q, index) => {
      const others = (q.playerAnswers ?? []).filter(
        (a) => a.playerName.trim().toLowerCase() !== playerKey,
      )
      const record = answerRecords[index]

      return {
        ...q,
        playerAnswers: record ? [...others, record] : others,
      }
    })
  }

  gameResult.players.sort((a, b) => b.points - a.points)
  gameResult.players.forEach((p, idx) => {
    p.rank = idx + 1
  })

  Config.saveResult(gameResult)

  const playerRank =
    gameResult.players.find((p) => p.username.toLowerCase() === playerKey)
      ?.rank || gameResult.players.length

  return {
    totalPoints: session.totalPoints,
    rank: playerRank,
    totalPlayers: gameResult.players.length,
    correctAnswersCount: session.correctCount,
    totalQuestions: session.questions.length,
  }
}

export const asyncQuizzSocketHandlers = ({ socket }: SocketContext) => {
  // Récupération publique du quiz pour le jeu solo (pas besoin d'auth
  // manager) : métadonnées uniquement. Les questions sont servies une à une,
  // sans solution, par ASYNC_QUIZ.NEXT.
  socket.on(EVENTS.ASYNC_QUIZ.GET_PUBLIC, (quizzId: unknown) => {
    try {
      if (typeof quizzId !== "string" || quizzId.length > 200) {
        throw new Error("Identifiant de quiz invalide")
      }

      const quizz = Config.quizzById(quizzId)

      socket.emit(EVENTS.ASYNC_QUIZ.DATA, {
        id: quizz.id,
        subject: quizzDisplayName(quizz),
        description: quizz.description,
        salonImage: quizz.salonImage,
        listingImage: quizz.listingImage,
        totalQuestions: quizz.questions.filter((q) => q.type !== "title")
          .length,
      })
    } catch (error) {
      console.error("Failed to get public quizz:", error)
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:quizz.notFound")
    }
  })

  // Ouverture d'une session solo : pseudo validé, honeypot, rate-limit.
  socket.on(EVENTS.ASYNC_QUIZ.START, (payload, ack) => {
    const ip = getClientIp(socket)

    if (!startLimitByIp.hit(ip) || !startLimitBySocket.hit(socket.id)) {
      replyAck(ack, { ok: false, error: "errors:quizz.tooManyAttempts" })

      return
    }

    const parsed = parsePayload(startSchema, payload)

    if (!parsed) {
      replyAck(ack, { ok: false, error: "errors:quizz.invalidSubmission" })

      return
    }

    // Le honeypot n'est rempli que par un remplisseur automatique. On refuse
    // sans détail (le client ne doit pas apprendre quel signal l'a trahi).
    if (parsed.human?.hp?.trim()) {
      console.warn(
        `[ANTI-BOT] Session solo refusée (quiz=${parsed.quizzId}, joueur=${parsed.playerName}, honeypot)`,
      )
      replyAck(ack, { ok: false, error: "errors:quizz.invalidSubmission" })

      return
    }

    let quizz = null

    try {
      quizz = Config.quizzById(parsed.quizzId)
    } catch {
      quizz = null
    }

    if (!quizz) {
      replyAck(ack, { ok: false, error: "errors:quizz.notFound" })

      return
    }

    const session = sessions.start(quizz, {
      playerName: parsed.playerName,
      socialContact: parsed.socialContact,
    })

    if (!session) {
      replyAck(ack, { ok: false, error: "errors:quizz.tooManyAttempts" })

      return
    }

    replyAck(ack, {
      ok: true,
      sessionId: session.id,
      totalQuestions: session.questions.length,
    })
  })

  // Question suivante, horodatée par le serveur.
  socket.on(EVENTS.ASYNC_QUIZ.NEXT, (payload, ack) => {
    const parsed = parsePayload(sessionSchema, payload)
    const session = parsed ? sessions.get(parsed.sessionId) : undefined

    if (!session) {
      replyAck(ack, { ok: false, error: "errors:quizz.sessionExpired" })

      return
    }

    replyAck(ack, SoloSessions.next(session))
  })

  // Réponse à la question servie : corrigée ici, correction renvoyée par ack.
  socket.on(EVENTS.ASYNC_QUIZ.ANSWER, (payload, ack) => {
    const parsed = parsePayload(answerSchema, payload)
    const session = parsed ? sessions.get(parsed.sessionId) : undefined

    if (!parsed || !session) {
      replyAck(ack, { ok: false, error: "errors:quizz.sessionExpired" })

      return
    }

    const { questionIndex, answerId, textAnswer, numberAnswer, orderAnswer } =
      parsed

    replyAck(
      ack,
      SoloSessions.answer(session, questionIndex, {
        answerId,
        textAnswer,
        numberAnswer,
        orderAnswer,
      }),
    )
  })

  // Finalisation : le score enregistré est celui calculé par le serveur.
  socket.on(EVENTS.ASYNC_QUIZ.SUBMIT, (payload, ack) => {
    // Réponse par ack ; à défaut (client sans callback), par événements.
    const hasAck = typeof ack === "function"
    const fail = (error: string) => {
      if (hasAck) {
        replyAck(ack, { ok: false, error })
      } else {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, error)
      }
    }

    try {
      if (!submitLimitByIp.hit(getClientIp(socket))) {
        fail("errors:quizz.tooManyAttempts")

        return
      }

      const parsed = parsePayload(sessionSchema, payload)
      const session = parsed ? sessions.get(parsed.sessionId) : undefined

      if (!session) {
        fail("errors:quizz.sessionExpired")

        return
      }

      if (!SoloSessions.isFinished(session)) {
        fail("errors:quizz.invalidSubmission")

        return
      }

      // Une session ne s'enregistre qu'une fois, même en cas d'échec.
      sessions.delete(session.id)

      if (SoloSessions.isTooFast(session)) {
        console.warn(
          `[ANTI-BOT] Soumission solo rejetée (quiz=${session.quizz.id}, joueur=${session.playerName}, réponses trop rapides)`,
        )
        fail("errors:quizz.invalidSubmission")

        return
      }

      const result = saveSoloResult(session)

      if (hasAck) {
        replyAck(ack, { ok: true, ...result })
      } else {
        socket.emit(EVENTS.ASYNC_QUIZ.SUBMIT_SUCCESS, result)
      }
    } catch (error) {
      console.error("Async quizz submission error:", error)
      fail("errors:quizz.submissionFailed")
    }
  })
}
