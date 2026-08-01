import { EVENTS } from "@rahoot/common/constants"
import type { GameResult, GameResultPlayer } from "@rahoot/common/types/game"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"

export const asyncQuizzSocketHandlers = ({ socket }: SocketContext) => {
  // Récupération publique du quiz pour le jeu solo (pas besoin d'auth manager)
  socket.on(EVENTS.ASYNC_QUIZ.GET_PUBLIC, (quizzId: string) => {
    try {
      const quizz = Config.quizzById(quizzId)

      socket.emit(EVENTS.ASYNC_QUIZ.DATA, {
        id: quizz.id,
        subject: quizz.subject,
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
      answers: Array<{
        questionIndex: number
        answerId?: number | null
        textAnswer?: string | null
        numberAnswer?: number | null
        timeMs?: number
      }>
    }) => {
      try {
        const { quizzId, playerName, socialContact, answers } = payload
        const quizz = Config.quizzById(quizzId)

        if (!playerName || !quizz) {
          socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:quizz.invalidSubmission")
          return
        }

        let totalScore = 0
        let correctAnswersCount = 0

        // Calcul du score pour les réponses de ce joueur
        quizz.questions.forEach((q, index) => {
          const playerAns = answers.find((a) => a.questionIndex === index)
          if (!playerAns) return

          let isCorrect = false

          if (q.type === "mcq" || q.type === "true_false") {
            const correctAnsIndex = q.answers.findIndex((a) => a.correct)
            if (playerAns.answerId === correctAnsIndex) {
              isCorrect = true
            }
          } else if (q.type === "open") {
            if (
              playerAns.textAnswer &&
              q.answer &&
              playerAns.textAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase()
            ) {
              isCorrect = true
            }
          }

          if (isCorrect) {
            correctAnswersCount += 1
            const speedBonus = playerAns.timeMs ? Math.max(0, Math.round(500 * (1 - playerAns.timeMs / 20000))) : 0
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
          (p) => p.username.toLowerCase() === playerName.trim().toLowerCase()
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
            (p) => p.username.toLowerCase() === playerName.trim().toLowerCase()
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
    }
  )
}
