import { EVENTS } from "@rahoot/common/constants"
import type { Socket } from "@rahoot/common/types/game/socket"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"

const getClientId = (socket: SocketContext["socket"]) =>
  socket.handshake.auth.clientId as string

const getClientIp = (socket: SocketContext["socket"]) =>
  socket.handshake.address || "unknown"

// Session d'un client authentifié. Le rôle `admin` (mot de passe manager)
// conserve tous les droits ; le rôle `guest` est confiné à sa propre
// bibliothèque de quiz (cf. services/config, scoping `owner`).
export type ManagerSession =
  | { role: "admin" }
  | { role: "guest"; guestId: string }

// Rate-limiting des tentatives d'authentification manager. Le verrouillage se
// fait par IP (et non par clientId, qui est fourni par le client donc facile à
// faire varier pour contourner la limite). Au-delà de MAX_ATTEMPTS échecs dans
// la fenêtre, toute tentative est rejetée jusqu'à expiration.
const MAX_AUTH_ATTEMPTS = 5
const AUTH_WINDOW_MS = 60_000

class Manager {
  private loggedClients = new Map<string, ManagerSession>()
  private failedAuth = new Map<string, { count: number; resetAt: number }>()

  // Admin uniquement : tous les gardes existants (lancement de partie,
  // résultats, réglages…) restent donc fermés aux invités par défaut.
  isLogged(socket: Socket) {
    return this.loggedClients.get(getClientId(socket))?.role === "admin"
  }

  getSession(socket: Socket): ManagerSession | undefined {
    return this.loggedClients.get(getClientId(socket))
  }

  // Utilisé hors-socket (endpoints HTTP /upload, médias) : on ne dispose alors
  // que du clientId transmis par le client, qui doit correspondre à une session
  // authentifiée — admin OU invité (les invités uploadent aussi des images).
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
    this.loggedClients.set(getClientId(socket), { role: "admin" })
    this.failedAuth.delete(getClientIp(socket))
  }

  loginGuest(socket: Socket, guestId: string) {
    this.loggedClients.set(getClientId(socket), { role: "guest", guestId })
    this.failedAuth.delete(getClientIp(socket))
  }

  logout(socket: Socket) {
    this.loggedClients.delete(getClientId(socket))
  }

  // Garde admin strict (historique) : un invité reçoit UNAUTHORIZED.
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

  // Garde admin OU invité : la session est passée au handler pour scoper les
  // opérations (bibliothèque de quiz) sans jamais faire confiance au client.
  withAnyAuth<T extends unknown[]>(
    socket: Socket,
    handler: (_session: ManagerSession, ..._args: T) => void,
  ) {
    return (..._args: T) => {
      const session = this.getSession(socket)

      if (!session) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      handler(session, ..._args)
    }
  }
}

const manager = new Manager()

// Config émise selon le rôle de la session : l'admin voit sa bibliothèque, les
// quiz invités (dossier virtuel « Invités/<nom> ») et la liste des comptes ;
// un invité ne voit QUE sa bibliothèque (ni résultats, ni quiz admin, ni hash).
export const emitConfig = (socket: SocketContext["socket"]) => {
  const session = manager.getSession(socket)

  if (!session) {
    socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

    return
  }

  if (session.role === "guest") {
    const guest = Config.guestById(session.guestId)

    socket.emit(EVENTS.MANAGER.CONFIG, {
      quizz: Config.quizzMeta(session.guestId),
      results: [],
      role: "guest",
      guestName: guest?.name ?? session.guestId,
    })

    return
  }

  socket.emit(EVENTS.MANAGER.CONFIG, {
    quizz: [...Config.quizzMeta(), ...Config.allGuestQuizzMeta()],
    results: Config.resultsMeta(),
    role: "admin",
    guests: Config.listGuests().map(({ id, name, createdAt }) => ({
      id,
      name,
      createdAt,
    })),
  })
}

export default manager
