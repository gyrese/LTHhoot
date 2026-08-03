import { EVENTS } from "@rahoot/common/constants"
import type { GameResult, GameResultPlayer } from "@rahoot/common/types/game"
import { quizzDisplayName } from "@rahoot/common/utils/quizz-name"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"

// Durée plancher par question : sous ce seuil, personne n'a eu le temps de lire
// l'énoncé — la soumission vient d'un script. Volontairement bas (un joueur
// très rapide reste largement au-dessus) : on vise les bots, pas les pressés.
const MIN_SOLO_DURATION_MS = 1000

export const asyncQuizzSocketHandlers = ({ socket }: SocketContext) => {
  // Récupération publique du quiz pour le jeu solo (pas besoin d'auth manager)
  socket.on(EVENTS.ASYNC_QUIZ.GET_PUBLIC, (quizzId: string) => {
    try {
      const quizz = Config.quizzById(quizzId)

      socket.emit(EVENTS.ASYNC_QUIZ.DATA, {
        id: quizz.id,
        subject: quizzDisplayName(quizz),
        description: quizz.description,
        salonImage: quizz.salonImage,
        listingImage: quizz.listingImage,
        questions: quizz.questions,
      })
    } catch (error) {
      console.error("Failed to get public quizz:", error)
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:quizz.notFound")
    }
  })

  // Soumission des réponses d'un joueur solo
  socket.on(
    EVENTS.ASYNC_QUIZ.SUBMIT,
    (payload: {
      quizzId: string
      playerName: string
      socialContact?: string
      // Signaux anti-bot du formulaire public (cf. NotARobotCheck).
      human?: { hp?: string; startedAt?: number | null }
      answers: Array<{
        questionIndex: number
        answerId?: number | null
        textAnswer?: string | null
        numberAnswer?: number | null
        timeMs?: number
      }>
    }) => {
      try {
        const { quizzId, playerName, socialContact, answers, human } = payload
        const quizz = Config.quizzById(quizzId)

        if (!playerName || !quizz) {
          socket.emit(
            EVENTS.GAME.ERROR_MESSAGE,
            "errors:quizz.invalidSubmission",
          )
          return
        }

        // Contrôle anti-bot : le honeypot n'est rempli que par un remplisseur
        // automatique, et une partie humaine dure forcément plus que le seuil.
        // Les scores publics alimentent un tirage au sort — on refuse en
        // silence côté serveur (le client ne peut pas contourner le calcul).
        const elapsedMs = human?.startedAt ? Date.now() - human.startedAt : null
        const tooFast =
          elapsedMs !== null &&
          elapsedMs < MIN_SOLO_DURATION_MS * answers.length

        if (human?.hp?.trim() || tooFast) {
          console.warn(
            `[ANTI-BOT] Soumission solo rejetée (quiz=${quizzId}, joueur=${playerName}, hp=${Boolean(human?.hp?.trim())}, elapsed=${elapsedMs}ms)`,
          )
          socket.emit(
            EVENTS.GAME.ERROR_MESSAGE,
            "errors:quizz.invalidSubmission",
          )
          return
        }

        let totalScore = 0
        let correctAnswersCount = 0

        // Calcul du score pour les réponses de ce joueur
        quizz.questions.forEach((q: any, index: number) => {
          const playerAns = answers.find((a) => a.questionIndex === index)
          if (!playerAns) return

          let isCorrect = false

          switch (q.type) {
            case "mcq": {
              const ansId = playerAns.answerId
              if (ansId !== undefined && ansId !== null) {
                if (Array.isArray(q.solutions)) {
                  isCorrect = q.solutions.includes(ansId)
                } else if (typeof q.solution === "number") {
                  isCorrect = q.solution === ansId
                } else if (Array.isArray(q.answers)) {
                  const item = q.answers[ansId]
                  if (typeof item === "object" && item !== null) {
                    isCorrect = Boolean(item.correct)
                  }
                }
              }
              break
            }

            case "true_false": {
              const ansId = playerAns.answerId
              if (ansId !== undefined && ansId !== null) {
                if (typeof q.solution === "number") {
                  isCorrect = q.solution === ansId
                } else if (Array.isArray(q.answers)) {
                  const item = q.answers[ansId]
                  if (typeof item === "object" && item !== null) {
                    isCorrect = Boolean(item.correct)
                  }
                }
              }
              break
            }

            case "open": {
              const text = playerAns.textAnswer?.trim().toLowerCase()
              if (text) {
                if (Array.isArray(q.correctAnswers)) {
                  isCorrect = q.correctAnswers.some(
                    (ca: string) => ca.trim().toLowerCase() === text,
                  )
                } else if (typeof q.answer === "string") {
                  isCorrect = q.answer.trim().toLowerCase() === text
                }
              }
              break
            }

            case "date": {
              if (typeof playerAns.numberAnswer === "number") {
                const target = q.correctYear ?? q.solution
                const tol = q.tolerance ?? 0
                isCorrect = Math.abs(playerAns.numberAnswer - target) <= tol
              }
              break
            }

            case "slider": {
              if (typeof playerAns.numberAnswer === "number") {
                const target = q.correctValue ?? q.solution
                const tol = q.tolerance ?? 0
                isCorrect = Math.abs(playerAns.numberAnswer - target) <= tol
              }
              break
            }

            default:
              break
          }

          if (isCorrect) {
            correctAnswersCount += 1
            const timeLimit = (q.time || 20) * 1000
            const speedBonus = playerAns.timeMs
              ? Math.max(
                  0,
                  Math.round(500 * (1 - playerAns.timeMs / timeLimit)),
                )
              : 0
            totalScore += 1000 + speedBonus
          }
        })

        const resultId = `async_${quizzId}`
        let gameResult: GameResult

        try {
          gameResult = Config.resultById(resultId)
        } catch {
          gameResult = {
            id: resultId,
            subject: `[Réseaux] ${quizz.subject}`,
            date: new Date().toISOString(),
            players: [],
            questions: quizz.questions.map((q) => ({
              ...q,
              playerAnswers: [],
            })),
            logs: [],
          }
        }

        const existingPlayerIdx = gameResult.players.findIndex(
          (p) => p.username.toLowerCase() === playerName.trim().toLowerCase(),
        )

        const newPlayerData: GameResultPlayer = {
          username: playerName.trim(),
          points: totalScore,
          rank: 1,
          socialContact: socialContact ? socialContact.trim() : undefined,
        }

        if (existingPlayerIdx >= 0) {
          if (totalScore > gameResult.players[existingPlayerIdx].points) {
            gameResult.players[existingPlayerIdx] = newPlayerData
          }
        } else {
          gameResult.players.push(newPlayerData)
        }

        gameResult.players.sort((a, b) => b.points - a.points)
        gameResult.players.forEach((p, idx) => {
          p.rank = idx + 1
        })

        Config.saveResult(gameResult)

        const playerRank =
          gameResult.players.find(
            (p) => p.username.toLowerCase() === playerName.trim().toLowerCase(),
          )?.rank || gameResult.players.length

        socket.emit(EVENTS.ASYNC_QUIZ.SUBMIT_SUCCESS, {
          totalPoints: totalScore,
          rank: playerRank,
          totalPlayers: gameResult.players.length,
          correctAnswersCount,
          totalQuestions: quizz.questions.length,
        })
      } catch (error) {
        console.error("Async quizz submission error:", error)
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:quizz.submissionFailed")
      }
    },
  )
}
