import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import manager, { emitConfig } from "@rahoot/socket/services/manager"
import { hashPassword, verifyPassword } from "@rahoot/socket/utils/password"

// PIN volontairement simple et codé en dur : l'app tourne sur le réseau local
// pendant une soirée, la télécommande doit pouvoir se connecter sans friction.
const REMOTE_PIN = "1234"

export const managerSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.MANAGER.GET_CONFIG,
    manager.withAuth(socket, () => {
      emitConfig(socket)
    }),
  )

  socket.on(EVENTS.MANAGER.LOGOUT, () => {
    manager.logout(socket)
  })

  socket.on(EVENTS.MANAGER.AUTH, (password) => {
    try {
      if (manager.isRateLimited(socket)) {
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.tooManyAttempts",
        )

        return
      }

      const config = Config.game()

      // Le mot de passe du fichier de config reste valide s'il a été
      // personnalisé ; la valeur d'usine "PASSWORD" n'est jamais acceptée.
      let isConfigPassword = false

      if (config.managerPasswordHash) {
        isConfigPassword = verifyPassword(password, config.managerPasswordHash)
      } else if (
        config.managerPassword !== "PASSWORD" &&
        password === config.managerPassword
      ) {
        isConfigPassword = true

        // Migration transparente : un mot de passe legacy en clair valide est
        // immédiatement réécrit sous forme de hash, sans action utilisateur.
        Config.migratePasswordToHash(hashPassword(password))
      }

      if (password !== REMOTE_PIN && !isConfigPassword) {
        manager.registerFailedAuth(socket)
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.invalidPassword",
        )

        return
      }

      manager.login(socket)
      emitConfig(socket)
    } catch (error) {
      console.error("Failed to read game config:", error)
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:failedToReadConfig")
    }
  })
}
