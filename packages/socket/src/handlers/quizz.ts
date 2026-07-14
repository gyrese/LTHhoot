import { EVENTS } from "@rahoot/common/constants"
import {
  GUEST_FOLDER,
  isGuestQuizId,
  parseGuestQuizId,
} from "@rahoot/common/utils/guest"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import manager, {
  emitConfig,
  type ManagerSession,
} from "@rahoot/socket/services/manager"
import { AIService } from "@rahoot/socket/services/ai"

// Bibliothèque ciblée par une session : celle de l'invité connecté, ou celle
// de l'admin. Le scoping vient TOUJOURS de la session serveur, jamais du client.
const ownerFor = (session: ManagerSession) =>
  session.role === "guest" ? session.guestId : undefined

// Lecture : l'admin peut résoudre un id préfixé `guest:` (dossier Invités,
// export, lancement) vers la bibliothèque du compte correspondant.
const readScope = (session: ManagerSession, id: string) => {
  if (session.role === "admin") {
    const parsed = parseGuestQuizId(id)

    if (parsed) {
      return { id: parsed.quizId, owner: parsed.guestId }
    }
  }

  return { id, owner: ownerFor(session) }
}

// Écriture : les quiz invités sont en lecture seule pour l'admin (v1).
const isReadonlyForSession = (session: ManagerSession, id: string) =>
  session.role === "admin" && isGuestQuizId(id)

export const quizzSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.QUIZZ.GET,
    manager.withAnyAuth(socket, (session, id) => {
      try {
        const scope = readScope(session, id)
        const quizz = Config.quizzById(scope.id, scope.owner)

        // On renvoie l'id tel que le client le connaît (préfixé côté admin).
        socket.emit(EVENTS.QUIZZ.DATA, { ...quizz, id })
      } catch (error) {
        console.error("Failed to get quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.notFound")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.SAVE,
    manager.withAnyAuth(socket, (session, data) => {
      try {
        const { id, updatedAt } = Config.saveQuizz(data, ownerFor(session))

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
    manager.withAnyAuth(socket, (session, id) => {
      try {
        if (isReadonlyForSession(session, id)) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.guestReadonly")

          return
        }

        Config.deleteQuizz(id, ownerFor(session))

        emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.failedToDelete")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.UPDATE,
    manager.withAnyAuth(socket, (session, { id, ...data }) => {
      try {
        if (isReadonlyForSession(session, id)) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.guestReadonly")

          return
        }

        const { id: newId, updatedAt } = Config.updateQuizz(
          id,
          data,
          ownerFor(session),
        )

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
    manager.withAnyAuth(socket, (session, { id, folder }) => {
      try {
        if (isReadonlyForSession(session, id)) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.guestReadonly")

          return
        }

        // « Invités » est un dossier virtuel (vue admin des bibliothèques
        // guest) : on refuse d'y ranger un vrai quiz admin.
        if (
          session.role === "admin" &&
          (folder === GUEST_FOLDER || folder?.startsWith(`${GUEST_FOLDER}/`))
        ) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.guestReadonly")

          return
        }

        Config.moveToFolder(id, folder, ownerFor(session))
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to move quizz to folder:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.failedToUpdate")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.AI_GENERATE,
    manager.withAnyAuth(
      socket,
      async (_session, { prompt, count, questionTypes, level }) => {
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
    manager.withAnyAuth(socket, async (_session, { currentText }) => {
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
    manager.withAnyAuth(
      socket,
      async (_session, { correctAnswer, questionContext }) => {
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
      },
    ),
  )
}
