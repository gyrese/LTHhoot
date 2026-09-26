import { EVENTS } from "@rahoot/common/constants"
import type { Player } from "@rahoot/common/types/game"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import { usernameValidator } from "@rahoot/common/validators/auth"
import { toPublicPlayer } from "@rahoot/socket/utils/game"

export type JoinResult =
  | { status: "joined"; player: Player }
  // Ré-inscription du même clientId : `oldId` est l'ancien id socket, à
  // remapper (réponses en cours, power-ups, statut par joueur).
  | { status: "rejoined"; player: Player; oldId: string }
  | { status: "error" }

export class PlayerManager {
  private readonly io: Server
  private readonly gameId: string
  private players: Player[] = []

  constructor(io: Server, gameId: string) {
    this.io = io
    this.gameId = gameId
  }

  // Inscription d'un joueur. Le pseudo est validé AVANT toute modification :
  // un pseudo refusé ne doit jamais coûter sa place (ni ses points) à un joueur
  // déjà inscrit. Un même clientId qui se ré-inscrit récupère SON joueur
  // (points, série, pièces) sous son nouveau socket au lieu d'être recréé à 0.
  join(socket: Socket, username: string, avatar?: string): JoinResult {
    const trimmedUsername = username.trim()
    const result = usernameValidator.safeParse(trimmedUsername)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return { status: "error" }
    }

    const { clientId } = socket.handshake.auth
    const existingPlayer = this.findByClientId(clientId)

    // Unicité (insensible à la casse) : de nombreux endroits matchent les
    // joueurs par username plutôt que par id (résultats, power-ups, mode
    // soirée) — un doublon casserait ce matching. Le joueur du même clientId
    // est exclu de la comparaison : se ré-inscrire avec son propre pseudo est
    // légitime.
    const isDuplicate = this.players.some(
      (p) =>
        p !== existingPlayer &&
        p.username.trim().toLowerCase() === trimmedUsername.toLowerCase(),
    )

    if (isDuplicate) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:auth.usernameTaken")

      return { status: "error" }
    }

    socket.join(this.gameId)

    if (existingPlayer) {
      console.log(`[TAKEOVER] Login takeover for ${existingPlayer.username}`)

      const oldId = existingPlayer.id

      // L'id est basculé AVANT de couper l'ancien socket : son « disconnect »
      // ne retrouve alors plus de joueur et n'arme aucun retrait différé.
      existingPlayer.id = socket.id
      existingPlayer.username = trimmedUsername
      existingPlayer.avatar = avatar
      existingPlayer.connected = true

      const oldSocket = this.io.sockets.sockets.get(oldId)

      if (oldSocket && oldSocket.id !== socket.id) {
        // Même clientId qui se ré-inscrit : on coupe l'ancien socket orphelin
        // sans GAME.RESET (qui éjecterait brutalement vers l'accueil).
        oldSocket.disconnect(true)
      }

      // Les listes des autres écrans sont indexées par id socket : on retire
      // l'ancienne entrée avant d'annoncer la nouvelle.
      this.io
        .to(`manager-${this.gameId}`)
        .emit(EVENTS.MANAGER.REMOVE_PLAYER, oldId)
      this.io.to(this.gameId).emit(EVENTS.GAME.REMOVE_PLAYER, oldId)
      this.announce(existingPlayer)
      socket.emit(EVENTS.GAME.SUCCESS_JOIN, this.gameId)

      return { status: "rejoined", player: existingPlayer, oldId }
    }

    const player: Player = {
      id: socket.id,
      clientId,
      connected: true,
      username: trimmedUsername,
      avatar,
      points: 0,
      streak: 0,
    }

    this.players.push(player)
    this.announce(player)
    socket.emit(EVENTS.GAME.SUCCESS_JOIN, this.gameId)

    return { status: "joined", player }
  }

  // Annonce d'un joueur à la partie : jamais de clientId diffusé (la room
  // manager inclut la télécommande).
  private announce(player: Player): void {
    this.io
      .to(`manager-${this.gameId}`)
      .emit(EVENTS.MANAGER.NEW_PLAYER, toPublicPlayer(player))
    this.io.to(this.gameId).emit(EVENTS.GAME.NEW_PLAYER, {
      id: player.id,
      username: player.username,
      avatar: player.avatar,
    })
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.players.length)
  }

  kick(socket: Socket, playerId: string): boolean {
    if (!socket.rooms.has(`manager-${this.gameId}`)) {
      return false
    }

    const player = this.findById(playerId)

    if (!player) {
      return false
    }

    this.players = this.players.filter((p) => p.id !== playerId)

    this.io.in(playerId).socketsLeave(this.gameId)
    this.io.to(player.id).emit(EVENTS.GAME.RESET, "errors:game.kickedByManager")
    this.io
      .to(`manager-${this.gameId}`)
      .emit(EVENTS.MANAGER.PLAYER_KICKED, player.id)
    this.io.to(this.gameId).emit(EVENTS.GAME.REMOVE_PLAYER, player.id)
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.players.length)

    return true
  }

  remove(socketId: string): Player | undefined {
    const player = this.findById(socketId)

    if (!player) {
      return undefined
    }

    this.players = this.players.filter((p) => p.id !== socketId)

    return player
  }

  setDisconnected(socketId: string): void {
    const player = this.findById(socketId)

    if (player) {
      player.connected = false
    }
  }

  updateSocketId(oldId: string, newId: string): void {
    const player = this.findById(oldId)

    if (player) {
      player.id = newId
    }
  }

  replace(players: Player[]): void {
    this.players = players
  }

  findById(socketId: string): Player | undefined {
    return this.players.find((p) => p.id === socketId)
  }

  findByClientId(clientId: string): Player | undefined {
    return this.players.find((p) => p.clientId === clientId)
  }

  getAll(): Player[] {
    return this.players
  }

  count(): number {
    return this.players.length
  }

  // Nombre de joueurs réellement connectés. À utiliser pour les conditions de
  // jeu (auto-fin de manche, total de réponses attendues) : un joueur déconnecté
  // n'est pas retiré pendant une partie en cours, mais ne répondra pas.
  countConnected(): number {
    return this.players.filter((p) => p.connected).length
  }

  broadcastCount(): void {
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.players.length)
  }
}
