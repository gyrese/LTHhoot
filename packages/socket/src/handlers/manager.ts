import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import manager, {
  emitConfig,
  getRemotePin,
} from "@rahoot/socket/services/manager"
import { hashPassword, verifyPassword } from "@rahoot/socket/utils/password"
import { timingSafeEqual } from "node:crypto"

// Comparaison à temps constant du PIN de télécommande (même précaution que
// pour le mot de passe administrateur).
const isRemotePin = (password: string): boolean => {
  const pin = getRemotePin()

  if (!pin) {
    return false
  }

  const expected = Buffer.from(pin)
  const received = Buffer.from(password)

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  )
}

export const managerSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.MANAGER.GET_CONFIG,
    // Admin ET invité : emitConfig scope la réponse selon le rôle de la session.
    manager.withAnyAuth(socket, () => {
      emitConfig(socket)
    }),
  )

  socket.on(EVENTS.MANAGER.LOGOUT, () => {
    manager.logout(socket)
  })

  // Connexion d'un compte invité (nom + mot de passe créés par l'admin).
  // Même rate-limit IP que l'auth admin : les deux flux partagent le compteur.
  socket.on(EVENTS.MANAGER.GUEST_AUTH, ({ name, password }) => {
    try {
      if (manager.isRateLimited(socket)) {
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.tooManyAttempts",
        )

        return
      }

      const guest =
        typeof name === "string" ? Config.guestByName(name) : undefined

      if (
        !guest ||
        typeof password !== "string" ||
        !verifyPassword(password, guest.passwordHash)
      ) {
        manager.registerFailedAuth(socket)
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.invalidPassword",
        )

        return
      }

      manager.loginGuest(socket, guest.id)
      emitConfig(socket)
    } catch (error) {
      console.error("Failed to authenticate guest:", error)
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:failedToReadConfig")
    }
  })

  socket.on(
    EVENTS.MANAGER.GUEST_CREATE,
    manager.withAuth(socket, ({ name, password }) => {
      try {
        Config.createGuest(name, password)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to create guest:", error)
        const message =
          error instanceof Error ? error.message : "errors:failedToReadConfig"
        socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, message)
      }
    }),
  )

  socket.on(
    EVENTS.MANAGER.GUEST_DELETE,
    manager.withAuth(socket, (id) => {
      try {
        Config.deleteGuest(id)
        // Les appareils encore connectés avec ce compte perdent leur session
        // sur-le-champ (et non au prochain redémarrage du serveur).
        manager.revokeGuest(id)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete guest:", error)
        const message =
          error instanceof Error ? error.message : "errors:failedToReadConfig"
        socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, message)
      }
    }),
  )

  socket.on(EVENTS.MANAGER.AUTH, (password) => {
    try {
      if (typeof password !== "string" || password.length > 256) {
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.invalidPassword",
        )

        return
      }

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

      if (isConfigPassword) {
        manager.login(socket)
        emitConfig(socket)

        return
      }

      // PIN de télécommande (REMOTE_PIN, désactivé par défaut) : session
      // limitée au pilotage d'une partie, sans accès aux quiz, résultats,
      // invités ni médias.
      if (isRemotePin(password)) {
        manager.loginRemote(socket)
        emitConfig(socket)

        return
      }

      manager.registerFailedAuth(socket)
      socket.emit(
        EVENTS.MANAGER.ERROR_MESSAGE,
        "errors:manager.invalidPassword",
      )
    } catch (error) {
      console.error("Failed to read game config:", error)
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:failedToReadConfig")
    }
  })
}
