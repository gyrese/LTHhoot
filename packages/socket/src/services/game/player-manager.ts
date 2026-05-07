import { EVENTS } from "@rahoot/common/constants"
import type { Player } from "@rahoot/common/types/game"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import { usernameValidator } from "@rahoot/common/validators/auth"

export class PlayerManager {
  private readonly io: Server
  private readonly gameId: string
  private readonly getManagerId: () => string
  private players: Player[] = []

  constructor(io: Server, gameId: string, getManagerId: () => string) {
    this.io = io
    this.gameId = gameId
    this.getManagerId = getManagerId
  }

  join(socket: Socket, username: string, avatar?: string): void {
    const existingPlayer = this.findByClientId(socket.handshake.auth.clientId)
    if (existingPlayer) {
      console.log(`[TAKEOVER] Login takeover for ${existingPlayer.username}`)
      // On déconnecte l'ancien socket s'il existe
      const oldSocket = this.io.sockets.sockets.get(existingPlayer.id)
      if (oldSocket && oldSocket.id !== socket.id) {
        oldSocket.emit(EVENTS.GAME.RESET, "errors:game.sessionTakenOver")
        oldSocket.disconnect(true)
      }
      // On met à jour l'ID et on continue (cela mettra à jour le pseudo/avatar si besoin)
      this.players = this.players.filter((p) => p.clientId !== socket.handshake.auth.clientId)
    }

    const result = usernameValidator.safeParse(username)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    socket.join(this.gameId)

    const player: Player = {
      id: socket.id,
      clientId: socket.handshake.auth.clientId,
      connected: true,
      username,
      avatar,
      points: 0,
      streak: 0,
    }

    this.players.push(player)
    this.io.to(this.getManagerId()).emit(EVENTS.MANAGER.NEW_PLAYER, player)
    this.io.to(this.gameId).emit(EVENTS.GAME.NEW_PLAYER, {
      id: player.id,
      username: player.username,
      avatar: player.avatar,
    })
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.players.length)
    socket.emit(EVENTS.GAME.SUCCESS_JOIN, this.gameId)
  }

  kick(socket: Socket, playerId: string): boolean {
    if (this.getManagerId() !== socket.id) {
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
      .to(this.getManagerId())
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

  broadcastCount(): void {
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.players.length)
  }
}
