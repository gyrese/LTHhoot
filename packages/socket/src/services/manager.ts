import { EVENTS } from "@rahoot/common/constants"
import type { Socket } from "@rahoot/common/types/game/socket"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import Config from "@rahoot/socket/services/config"
import { getClientIp as resolveClientIp } from "@rahoot/socket/utils/client-ip"

const getClientId = (socket: SocketContext["socket"]) =>
  socket.handshake.auth.clientId as string

const getClientIp = (socket: SocketContext["socket"]) => resolveClientIp(socket)

// Clé de rate-limit : un appareil (clientId) sur un réseau (IP). Deux appareils
// derrière la même IP publique ont donc des compteurs indépendants.
const getAuthKey = (socket: SocketContext["socket"]) =>
  `${getClientIp(socket)}|${getClientId(socket)}`

// Session d'un client authentifié. Le rôle `admin` (mot de passe manager)
// conserve tous les droits ; le rôle `guest` est confiné à sa propre
// bibliothèque de quiz (cf. services/config, scoping `owner`) ; le rôle
// `remote` (PIN de télécommande) ne sert qu'à piloter une partie existante.
export type ManagerSession =
  | { role: "admin" }
  | { role: "guest"; guestId: string }
  | { role: "remote" }

// Session donnant accès à une bibliothèque (quiz, médias) : tout sauf remote.
export type LibrarySession = Exclude<ManagerSession, { role: "remote" }>

// Longueur minimale du PIN de télécommande : en dessous, il est désactivé.
export const MIN_REMOTE_PIN_LENGTH = 4

// PIN de télécommande (variable d'environnement REMOTE_PIN), lu à chaque appel
// pour rester testable. Désactivé (`null`) s'il est absent ou trop court : la
// télécommande se connecte alors avec le mot de passe administrateur.
export const getRemotePin = (): string | null => {
  const pin = process.env.REMOTE_PIN?.trim()

  return pin && pin.length >= MIN_REMOTE_PIN_LENGTH ? pin : null
}

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
  getMediaAccount(clientId: string | undefined) {
    const session = clientId ? this.loggedClients.get(clientId) : undefined

    if (session?.role === "admin") {
      return "admin"
    }

    return session?.role === "guest" ? session.guestId : undefined
  }

  isAdminAuthorized(clientId: string | undefined) {
    return (
      Boolean(clientId) &&
      this.loggedClients.get(clientId as string)?.role === "admin"
    )
  }

  // Accès HTTP (uploads, médias) : admin ou invité, JAMAIS la télécommande.
  isAuthorized(clientId: string | undefined) {
    const role = clientId ? this.loggedClients.get(clientId)?.role : undefined

    return role === "admin" || role === "guest"
  }

  // Pilotage d'une partie (MANAGER.RECONNECT depuis un autre appareil) : admin
  // ou session télécommande.
  canPilot(socket: Socket) {
    const role = this.getSession(socket)?.role

    return role === "admin" || role === "remote"
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

  loginRemote(socket: Socket) {
    this.loggedClients.set(getClientId(socket), { role: "remote" })
    this.clearFailedAuth(socket)
  }

  // Révocation immédiate des sessions d'un invité supprimé : sans elle, son
  // appareil restait authentifié (et pouvait continuer d'uploader) jusqu'au
  // redémarrage du serveur.
  revokeGuest(guestId: string): string[] {
    const revoked: string[] = []

    for (const [clientId, session] of this.loggedClients) {
      if (session.role === "guest" && session.guestId === guestId) {
        this.loggedClients.delete(clientId)
        revoked.push(clientId)
      }
    }

    return revoked
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
  // Une session télécommande n'a accès à aucune bibliothèque.
  withAnyAuth<T extends unknown[]>(
    socket: Socket,
    handler: (_session: LibrarySession, ..._args: T) => void,
  ) {
    return (..._args: T) => {
      const session = this.getSession(socket)

      if (!session || session.role === "remote") {
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

  // Télécommande : aucune donnée de bibliothèque. La config vide permet
  // simplement à l'écran de connexion de savoir que le PIN a été accepté.
  if (session.role === "remote") {
    socket.emit(EVENTS.MANAGER.CONFIG, {
      quizz: [],
      results: [],
      role: "remote",
    })

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
