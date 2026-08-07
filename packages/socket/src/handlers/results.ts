import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import manager, { emitConfig } from "@rahoot/socket/services/manager"

export const resultsSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.RESULTS.GET,
    manager.withAuth(socket, (id) => {
      try {
        socket.emit(EVENTS.RESULTS.DATA, Config.resultById(id))
      } catch (error) {
        console.error("Failed to get result:", error)
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:results.fetchFailed")
      }
    }),
  )

  // Suppression d'une participation : le classement est réécrit sur disque
  // (joueur + ses réponses), puis renvoyé pour rafraîchir la modale ouverte.
  socket.on(
    EVENTS.RESULTS.DELETE_PLAYER,
    manager.withAuth(
      socket,
      ({ resultId, username }: { resultId: string; username: string }) => {
        try {
          const result = Config.resultById(resultId)
          const target = username.trim().toLowerCase()

          result.players = result.players.filter(
            (p) => p.username.trim().toLowerCase() !== target,
          )
          result.players.forEach((p, idx) => {
            p.rank = idx + 1
          })
          result.questions = result.questions.map((q) => ({
            ...q,
            playerAnswers: (q.playerAnswers ?? []).filter(
              (a) => a.playerName.trim().toLowerCase() !== target,
            ),
          }))

          Config.saveResult(result)
          socket.emit(EVENTS.RESULTS.DATA, result)
          emitConfig(socket)
        } catch (error) {
          console.error("Failed to delete result player:", error)
          socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:results.deleteFailed")
        }
      },
    ),
  )

  socket.on(
    EVENTS.RESULTS.DELETE,
    manager.withAuth(socket, (id) => {
      try {
        Config.deleteResult(id)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete result:", error)
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:results.deleteFailed")
      }
    }),
  )
}
