import { EVENTS } from "@rahoot/common/constants"
import type { Socket } from "@rahoot/common/types/game/socket"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"

const getClientId = (socket: SocketContext["socket"]) =>
  socket.handshake.auth.clientId as string

const getClientIp = (socket: SocketContext["socket"]) =>
  socket.handshake.address || "unknown"

export const emitConfig = (socket: SocketContext["socket"]) =>
  socket.emit(EVENTS.MANAGER.CONFIG, {
    quizz: Config.quizzMeta(),
    results: Config.resultsMeta(),
  })

// Rate-limiting des tentatives d'authentification manager. Le verrouillage se
// fait par IP (et non par clientId, qui est fourni par le client donc facile à
// faire varier pour contourner la limite). Au-delà de MAX_ATTEMPTS échecs dans
// la fenêtre, toute tentative est rejetée jusqu'à expiration.
const MAX_AUTH_ATTEMPTS = 5
const AUTH_WINDOW_MS = 60_000

class Manager {
  private loggedClients = new Set<string>()
  private failedAuth = new Map<string, { count: number; resetAt: number }>()

  isLogged(socket: Socket) {
    return this.loggedClients.has(getClientId(socket))
  }

  // Utilisé hors-socket (endpoint HTTP /upload) : on ne dispose alors que du
  // clientId transmis par le client, qui doit figurer parmi les clients
  // authentifiés via le mot de passe manager.
  isAuthorized(clientId: string | undefined) {
    return Boolean(clientId) && this.loggedClients.has(clientId as string)
  }

  isRateLimited(socket: Socket): boolean {
    const entry = this.failedAuth.get(getClientIp(socket))

    if (!entry) {
      return false
    }

    if (Date.now() > entry.resetAt) {
      this.failedAuth.delete(getClientIp(socket))

      return false
    }

    return entry.count >= MAX_AUTH_ATTEMPTS
  }

  registerFailedAuth(socket: Socket) {
    const ip = getClientIp(socket)
    const now = Date.now()
    const entry = this.failedAuth.get(ip)

    if (!entry || now > entry.resetAt) {
      this.failedAuth.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS })

      return
    }

    entry.count += 1
    entry.resetAt = now + AUTH_WINDOW_MS
  }

  login(socket: Socket) {
    this.loggedClients.add(getClientId(socket))
    this.failedAuth.delete(getClientIp(socket))
  }

  logout(socket: Socket) {
    this.loggedClients.delete(getClientId(socket))
  }

  withAuth<T extends unknown[]>(
    socket: Socket,
    handler: (..._args: T) => void,
  ) {
    return (..._args: T) => {
      if (!this.isLogged(socket)) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      handler(..._args)
    }
  }
}

export default new Manager()
