import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import manager, { emitConfig } from "@rahoot/socket/services/manager"
import { AIService } from "@rahoot/socket/services/ai"

export const quizzSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.QUIZZ.GET,
    manager.withAuth(socket, (id) => {
      try {
        const quizz = Config.quizzById(id)

        socket.emit(EVENTS.QUIZZ.DATA, quizz)
      } catch (error) {
        console.error("Failed to get quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.notFound")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.SAVE,
    manager.withAuth(socket, (data) => {
      try {
        const { id, updatedAt } = Config.saveQuizz(data)

        socket.emit(EVENTS.QUIZZ.SAVE_SUCCESS, { id, updatedAt })
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to save quizz:", error)
        const message =
          error instanceof Error ? error.message : "errors:quizz.failedToSave"
        socket.emit(EVENTS.QUIZZ.ERROR, message)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.DELETE,
    manager.withAuth(socket, (id) => {
      try {
        Config.deleteQuizz(id)

        emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.failedToDelete")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.UPDATE,
    manager.withAuth(socket, ({ id, ...data }) => {
      try {
        const { id: newId, updatedAt } = Config.updateQuizz(id, data)

        socket.emit(EVENTS.QUIZZ.UPDATE_SUCCESS, { id: newId, updatedAt })
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to update quizz:", error)
        const message =
          error instanceof Error ? error.message : "errors:quizz.failedToUpdate"
        socket.emit(EVENTS.QUIZZ.ERROR, message)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.MOVE_FOLDER,
    manager.withAuth(socket, ({ id, folder }) => {
      try {
        Config.moveToFolder(id, folder)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to move quizz to folder:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.failedToUpdate")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.AI_GENERATE,
    manager.withAuth(
      socket,
      async ({ prompt, count, questionTypes, level }) => {
        try {
          const questions = await AIService.generateQuestions({
            prompt,
            count,
            questionTypes,
            level,
          })

          socket.emit(EVENTS.QUIZZ.AI_GENERATE_SUCCESS, { questions })
        } catch (error) {
          console.error("Failed to generate quiz with AI:", error)
          const message =
            error instanceof Error
              ? error.message
              : "errors:quizz.aiGenerationFailed"
          // Canal AI_ERROR dédié : QUIZZ.ERROR est aussi écouté par le flux de
          // sauvegarde de l'éditeur (toast + reset d'état croisés).
          socket.emit(EVENTS.QUIZZ.AI_ERROR, message)
        }
      },
    ),
  )

  socket.on(
    EVENTS.QUIZZ.AI_REPHRASE,
    manager.withAuth(socket, async ({ currentText }) => {
      try {
        const rephrased = await AIService.rephraseQuestion(currentText)

        socket.emit(EVENTS.QUIZZ.AI_REPHRASE_SUCCESS, { rephrased })
      } catch (error) {
        console.error("Failed to rephrase question with AI:", error)
        const message =
          error instanceof Error
            ? error.message
            : "errors:quizz.aiGenerationFailed"
        socket.emit(EVENTS.QUIZZ.AI_ERROR, message)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.AI_SUGGEST_WRONG_ANSWERS,
    manager.withAuth(socket, async ({ correctAnswer, questionContext }) => {
      try {
        const wrongAnswers = await AIService.generateWrongAnswers(
          correctAnswer,
          questionContext,
        )

        socket.emit(EVENTS.QUIZZ.AI_SUGGEST_WRONG_ANSWERS_SUCCESS, {
          wrongAnswers,
        })
      } catch (error) {
        console.error("Failed to generate wrong answers with AI:", error)
        const message =
          error instanceof Error
            ? error.message
            : "errors:quizz.aiGenerationFailed"
        socket.emit(EVENTS.QUIZZ.AI_ERROR, message)
      }
    }),
  )
}
