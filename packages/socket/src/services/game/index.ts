import { EVENTS } from "@rahoot/common/constants"
import type { Player, Quizz } from "@rahoot/common/types/game"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import {
  STATUS,
  type Status,
  type StatusDataMap,
} from "@rahoot/common/types/game/status"
import Config from "@rahoot/socket/services/config"
import { CooldownTimer } from "@rahoot/socket/services/game/cooldown-timer"
import { PlayerManager } from "@rahoot/socket/services/game/player-manager"
import { RoundManager } from "@rahoot/socket/services/game/round-manager"
import Registry from "@rahoot/socket/services/registry"
import { createInviteCode } from "@rahoot/socket/utils/game"
import { v4 as uuid } from "uuid"

const registry = Registry.getInstance()

class Game {
  readonly gameId: string
  readonly inviteCode: string

  private readonly io: Server
  private readonly _manager: {
    id: string
    clientId: string
    connected: boolean
  }
  private readonly playerManager: PlayerManager
  private readonly round: RoundManager
  private readonly cooldown: CooldownTimer

  private readonly disconnectTimers: Map<
    string,
    ReturnType<typeof setTimeout>
  > = new Map()

  private lastBroadcastStatus: {
    name: Status
    data: StatusDataMap[Status]
  } | null = null
  private managerStatus: {
    name: Status
    data: StatusDataMap[Status]
  } | null = null
  private playerStatus: Map<
    string,
    { name: Status; data: StatusDataMap[Status] }
  > = new Map()

  constructor(io: Server, socket: Socket, quizz: Quizz) {
    if (!io) {
      throw new Error("Socket server not initialized")
    }

    this.io = io
    this.gameId = uuid()
    this.inviteCode = createInviteCode()
    this._manager = {
      id: socket.id,
      clientId: socket.handshake.auth.clientId,
      connected: true,
    }

    this.cooldown = new CooldownTimer(io, this.gameId)

    this.playerManager = new PlayerManager(
      io,
      this.gameId,
      () => this._manager.id,
    )

    this.round = new RoundManager({
      quizz,
      players: this.playerManager,
      cooldown: this.cooldown,
      io,
      gameId: this.gameId,
      getManagerId: () => this._manager.id,
      broadcast: this.broadcastStatus.bind(this),
      send: this.sendStatus.bind(this),
      onNewQuestion: () => {
        this.playerStatus.clear()
        this.managerStatus = null
      },
      onGameFinished: (result) => {
        Config.saveResult(result)
        registry.removeGame(this.gameId)
      },
    })

    this.lastBroadcastStatus = {
      name: STATUS.SHOW_ROOM,
      data: {
        text: "game:waitingForPlayers",
        inviteCode: this.inviteCode,
        salonImage: quizz.salonImage || quizz.listingImage,
      },
    }

    socket.join(this.gameId)
    socket.join(`manager-${this.gameId}`)
    socket.emit(EVENTS.MANAGER.GAME_CREATED, {
      gameId: this.gameId,
      inviteCode: this.inviteCode,
      salonImage: quizz.salonImage || quizz.listingImage,
    })

    console.log(
      `New game created: ${this.inviteCode} subject: ${quizz.subject}`,
    )
  }

  get manager() {
    return this._manager
  }

  get players(): Player[] {
    return this.playerManager.getAll()
  }

  get started(): boolean {
    return this.round.isStarted()
  }

  // ── Status broadcasting ──────────────────────────────────────────────────

  private broadcastStatus<T extends Status>(status: T, data: StatusDataMap[T]) {
    const statusData = { name: status, data }
    this.lastBroadcastStatus = statusData
    this.io.to(this.gameId).emit(EVENTS.GAME.STATUS, statusData)
  }

  private sendStatus<T extends Status>(
    target: string,
    status: T,
    data: StatusDataMap[T],
  ) {
    const statusData = { name: status, data }

    if (this._manager.id === target) {
      this.managerStatus = statusData
      this.io.to(`manager-${this.gameId}`).emit(EVENTS.GAME.STATUS, statusData)
    } else {
      this.playerStatus.set(target, statusData)
      this.io.to(target).emit(EVENTS.GAME.STATUS, statusData)
    }
  }

  // Player actions

  join(socket: Socket, username: string, avatar?: string) {
    this.playerManager.join(socket, username, avatar)
  }

  kickPlayer(socket: Socket, playerId: string) {
    if (this.playerManager.kick(socket, playerId)) {
      this.playerStatus.delete(playerId)
    }
  }

  // Reconnect

  reconnect(socket: Socket) {
    const { clientId } = socket.handshake.auth

    if (this._manager.clientId === clientId) {
      this.reconnectManager(socket)

      return
    }

    this.reconnectPlayer(socket)
  }

  // Reconnexion depuis un appareil tiers authentifié (télécommande)
  reconnectRemote(socket: Socket) {
    socket.join(this.gameId)
    socket.join(`manager-${this.gameId}`)
    this._manager.id = socket.id
    this._manager.connected = true

    const status = this.managerStatus ??
      this.lastBroadcastStatus ?? {
        name: STATUS.SHOW_ROOM,
        data: {
          text: "game:waitingForPlayers",
          inviteCode: this.inviteCode,
        },
      }

    socket.emit(EVENTS.MANAGER.SUCCESS_RECONNECT, {
      gameId: this.gameId,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      timer: this.cooldown.getTimeRemaining(),
      players: this.playerManager.getAll(),
    })

    registry.reactivateGame(this.gameId)
    console.log(`Remote control connected to game ${this.inviteCode}`)
  }

  private reconnectManager(socket: Socket) {
    if (this._manager.connected) {
      socket.emit(EVENTS.GAME.RESET, "errors:game.managerAlreadyConnected")

      return
    }

    socket.join(this.gameId)
    socket.join(`manager-${this.gameId}`)
    this._manager.id = socket.id
    this._manager.connected = true

    const status = this.managerStatus ??
      this.lastBroadcastStatus ?? {
        name: STATUS.SHOW_ROOM,
        data: {
          text: "game:waitingForPlayers",
          inviteCode: this.inviteCode,
        },
      }

    socket.emit(EVENTS.MANAGER.SUCCESS_RECONNECT, {
      gameId: this.gameId,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      timer: this.cooldown.getTimeRemaining(),
      players: this.playerManager.getAll(),
    })
    socket.emit(EVENTS.GAME.TOTAL_PLAYERS, this.playerManager.count())

    registry.reactivateGame(this.gameId)
    console.log(`Manager reconnected to game ${this.inviteCode}`)
  }

  private reconnectPlayer(socket: Socket) {
    const { clientId } = socket.handshake.auth
    const player = this.playerManager.findByClientId(clientId)
    const newSocketId = socket.id

    console.log(`[RECONNECT_START] clientId=${clientId.substring(0, 8)} newSocket=${newSocketId}`)

    if (!player) {
      console.warn(`[RECONNECT_REJECT] Player not found for clientId=${clientId}`)
      socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")

      return
    }

    const oldSocketId = player.id
    const isTimerActive = this.disconnectTimers.has(oldSocketId)

    console.log(`[RECONNECT_TRACE] player=${player.username} oldSocket=${oldSocketId} connected=${player.connected} timerActive=${isTimerActive}`)

    if (player.connected && oldSocketId !== newSocketId) {
      console.log(`[TAKEOVER] Triggered for ${player.username} (${oldSocketId} -> ${newSocketId})`)
      const oldSocket = this.io.sockets.sockets.get(oldSocketId)

      if (oldSocket) {
        console.log(`[TAKEOVER] Disconnecting old socket ${oldSocketId}`)
        oldSocket.emit(EVENTS.GAME.RESET, "errors:game.sessionTakenOver")
        oldSocket.disconnect(true)
      } else {
        console.log(`[TAKEOVER] Old socket ${oldSocketId} already gone from memory`)
      }
    }

    // Annuler le timer de grâce s'il est en cours
    if (isTimerActive) {
      clearTimeout(this.disconnectTimers.get(oldSocketId))
      this.disconnectTimers.delete(oldSocketId)
      console.log(`[RECONNECT_TIMER] Cancelled grace period for ${oldSocketId}`)
    }

    // Join room
    socket.join(this.gameId)
    
    // Update player info
    this.playerManager.updateSocketId(oldSocketId, newSocketId)
    player.connected = true

    // Restore status : utiliser le statut joueur spécifique en priorité,
    // sinon le dernier statut broadcasté à tous.
    // Si la partie est en cours mais lastBroadcastStatus est encore SHOW_ROOM
    // (joueur reconnecté avant le démarrage), utiliser WAIT pour éviter l'état lobby.
    const playerSpecific = this.playerStatus.get(oldSocketId)
    const liveStatus = (() => {
      const last = this.lastBroadcastStatus

      if (this.started && (!last || last.name === STATUS.SHOW_ROOM)) {
        return {
          name: STATUS.WAIT,
          data: { text: "game:waitingForAnswers" },
        } as const
      }

      return last ?? { name: STATUS.WAIT, data: { text: "game:waitingForPlayers" } }
    })()
    const status = playerSpecific ?? liveStatus

    if (this.playerStatus.has(oldSocketId)) {
      const oldStatus = this.playerStatus.get(oldSocketId)!
      this.playerStatus.delete(oldSocketId)
      this.playerStatus.set(newSocketId, oldStatus)
    }

    console.log(`[RECONNECT_SUCCESS] Emitting SUCCESS_RECONNECT to ${newSocketId}`)
    socket.emit(EVENTS.PLAYER.SUCCESS_RECONNECT, {
      gameId: this.gameId,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      timer: this.cooldown.getTimeRemaining(),
      player: {
        username: player.username,
        avatar: player.avatar,
        points: player.points,
      },
    })

    socket.emit(EVENTS.GAME.TOTAL_PLAYERS, this.playerManager.count())

    console.log(
      `[RECONNECT_FINISH] ${player.username} session restored on ${newSocketId}`,
    )
  }

  // Disconnect helpers

  setManagerDisconnected() {
    this._manager.connected = false
    console.log(`[DISCONNECT] Manager déconnecté game=${this.inviteCode}`)
  }

  removePlayer(socketId: string): Player | undefined {
    const player = this.playerManager.remove(socketId)

    if (player) {
      this.io.to(this._manager.id).emit(EVENTS.MANAGER.REMOVE_PLAYER, player.id)
      this.io.to(this.gameId).emit(EVENTS.GAME.REMOVE_PLAYER, player.id)
      this.playerManager.broadcastCount()
      console.log(
        `[REMOVE] ${player.username} supprimé définitivement game=${this.inviteCode} joueurs restants=${this.playerManager.count()}`,
      )
    }

    return player
  }

  setPlayerDisconnected(socketId: string) {
    const player = this.playerManager.findById(socketId)

    console.log(
      `[DISCONNECT] socket=${socketId} joueur=${player?.username ?? "?"} game=${this.inviteCode} (partie en cours)`,
    )
    this.playerManager.setDisconnected(socketId)
    this.playerManager.broadcastCount()
  }

  // Timer de grâce : marque le joueur déconnecté et le supprime après 30s si pas de reconnexion
  schedulePlayerRemoval(socketId: string) {
    const player = this.playerManager.findById(socketId)

    if (!player) {
      console.log(
        `[DISCONNECT] socket=${socketId} - joueur introuvable game=${this.inviteCode}`,
      )

      return
    }

    console.log(
      `[DISCONNECT] ${player.username} (${player.clientId.substring(0, 8)}) socket=${socketId} game=${this.inviteCode} → grace period 30s`,
    )

    this.playerManager.setDisconnected(socketId)
    this.playerManager.broadcastCount()

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(socketId)
      const removed = this.removePlayer(socketId)

      if (removed) {
        console.log(
          `[TIMEOUT] ${removed.username} supprimé après 30s sans reconnexion game=${this.inviteCode}`,
        )
      }
    }, 30_000)

    this.disconnectTimers.set(socketId, timer)
  }

  // Game flow

  abortCooldown() {
    this.cooldown.abort()
  }

  async start(socket: Socket) {
    await this.round.start(socket)
  }

  async startDemo(socket: Socket) {
    this.round.setDemoMode(true)
    await this.round.start(socket)
  }

  selectAnswer(
    socket: Socket,
    payload: {
      answerId?: number
      textAnswer?: string
      numberAnswer?: number
      orderAnswer?: number[]
    },
  ) {
    this.round.selectAnswer(socket, payload)
  }

  nextRound(socket: Socket) {
    this.round.nextQuestion(socket)
  }

  abortRound(socket: Socket) {
    this.round.abortQuestion(socket)
  }

  showLeaderboard() {
    this.round.showLeaderboard()
  }

  validateOpenAnswer(text: string) {
    this.round.validateOpenAnswer(text)
  }

  finalizeOpenAnswers() {
    this.round.finalizeOpenAnswers()
  }
}

export default Game
