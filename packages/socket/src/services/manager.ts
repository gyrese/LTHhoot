import { EVENTS } from "@rahoot/common/constants"
import type { Socket } from "@rahoot/common/types/game/socket"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"

const getClientId = (socket: SocketContext["socket"]) =>
  socket.handshake.auth.clientId as string

const getClientIp = (socket: SocketContext["socket"]) =>
  socket.handshake.address || "unknown"

// Clé de rate-limit : un appareil (clientId) sur un réseau (IP). Deux appareils
// derrière la même IP publique ont donc des compteurs indépendants.
const getAuthKey = (socket: SocketContext["socket"]) =>
  `${getClientIp(socket)}|${getClientId(socket)}`

// Session d'un client authentifié. Le rôle `admin` (mot de passe manager)
// conserve tous les droits ; le rôle `guest` est confiné à sa propre
// bibliothèque de quiz (cf. services/config, scoping `owner`).
export type ManagerSession =
  | { role: "admin" }
  | { role: "guest"; guestId: string }

// Rate-limiting des tentatives d'authentification manager. La clé combine l'IP
// ET le clientId : en soirée, l'écran principal, la télécommande et les joueurs
// sortent très souvent par la MÊME IP publique (partage de connexion 4G, box de
// la salle). Verrouiller sur l'IP seule punissait donc tout le monde parce qu'un
// seul appareil avait mal saisi son PIN. L'IP reste dans la clé pour qu'un
// attaquant ne puisse pas se réinitialiser à volonté en changeant de clientId ;
// une IP qui accumule les échecs tous clientId confondus est bloquée par
// MAX_AUTH_ATTEMPTS_PER_IP.
const MAX_AUTH_ATTEMPTS = 5
const MAX_AUTH_ATTEMPTS_PER_IP = 20
const AUTH_WINDOW_MS = 60_000

class Manager {
  private loggedClients = new Map<string, ManagerSession>()
  private failedAuth = new Map<string, { count: number; resetAt: number }>()
  private failedAuthByIp = new Map<string, { count: number; resetAt: number }>()

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
    const now = Date.now()

    const isBlocked = (
      store: Map<string, { count: number; resetAt: number }>,
      key: string,
      max: number,
    ) => {
      const entry = store.get(key)

      if (!entry) {
        return false
      }

      // Fenêtre expirée : on repart de zéro. C'est ce qui garantit qu'un
      // verrou finit toujours par se lever (cf. registerFailedAuth, qui ne
      // repousse plus resetAt).
      if (now > entry.resetAt) {
        store.delete(key)

        return false
      }

      return entry.count >= max
    }

    return (
      isBlocked(this.failedAuth, getAuthKey(socket), MAX_AUTH_ATTEMPTS) ||
      isBlocked(
        this.failedAuthByIp,
        getClientIp(socket),
        MAX_AUTH_ATTEMPTS_PER_IP,
      )
    )
  }

  registerFailedAuth(socket: Socket) {
    const now = Date.now()

    const bump = (
      store: Map<string, { count: number; resetAt: number }>,
      key: string,
    ) => {
      const entry = store.get(key)

      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS })

        return
      }

      // On incrémente SANS repousser resetAt : prolonger la fenêtre à chaque
      // échec rendait le verrou permanent tant que des tentatives arrivaient
      // (une télécommande qui retente en boucle ne se débloquait jamais).
      // La fenêtre court désormais depuis le premier échec.
      entry.count += 1
    }

    bump(this.failedAuth, getAuthKey(socket))
    bump(this.failedAuthByIp, getClientIp(socket))
  }

  login(socket: Socket) {
    this.loggedClients.set(getClientId(socket), { role: "admin" })
    this.clearFailedAuth(socket)
  }

  loginGuest(socket: Socket, guestId: string) {
    this.loggedClients.set(getClientId(socket), { role: "guest", guestId })
    this.clearFailedAuth(socket)
  }

  // Une authentification réussie lève le verrou de l'appareil ET celui de son
  // IP : sans cela, un PIN mal saisi plusieurs fois continuait de bloquer les
  // autres appareils de la salle alors que l'hôte était déjà connecté.
  private clearFailedAuth(socket: Socket) {
    this.failedAuth.delete(getAuthKey(socket))
    this.failedAuthByIp.delete(getClientIp(socket))
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
