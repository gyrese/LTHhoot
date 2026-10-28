import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import eveningTracker from "@rahoot/socket/services/evening-tracker"
import manager, { emitConfig } from "@rahoot/socket/services/manager"
import Registry from "@rahoot/socket/services/registry"

// Le propriétaire vient toujours de la session authentifiée, jamais du payload.
export const eveningTrackingHandlers = ({ io, socket }: SocketContext) => {
  const owner = socket.handshake.auth.clientId as string

  socket.on(
    EVENTS.EVENING.OPEN,
    manager.withAuth(socket, (ack) => {
      if (typeof ack !== "function") {
        return
      }

      try {
        const evening = eveningTracker.start(owner)
        socket.join(`evening-owner-${owner}`)
        io.to(`evening-owner-${owner}`).emit(EVENTS.EVENING.STATE, evening)
        ack({ evening })
      } catch {
        ack({ error: "manager:eveningTracking.saveError" })
      }
    }),
  )

  socket.on(
    EVENTS.EVENING.CLOSE,
    manager.withAuth(socket, (ack) => {
      if (typeof ack !== "function") {
        return
      }

      const id = eveningTracker.getActiveId(owner)
      const playing = Registry.getInstance()
        .getGamesByManagerClientId(owner)
        .some(
          (game) =>
            game.eveningTrackingId === id &&
            (game.started || game.hasConnectedPlayers),
        )

      if (id && playing) {
        ack({ error: "manager:eveningTracking.gameInProgress" })

        return
      }

      try {
        const evening = eveningTracker.finish(owner)

        if (!evening) {
          ack({ error: "manager:eveningTracking.noEvening" })

          return
        }

        io.to(`evening-owner-${owner}`).emit(EVENTS.EVENING.STATE, evening)
        ack({ evening })
        emitConfig(socket)
      } catch {
        ack({ error: "manager:eveningTracking.saveError" })
      }
    }),
  )
}
