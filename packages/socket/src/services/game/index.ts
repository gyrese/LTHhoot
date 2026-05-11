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
import { GameLogger } from "@rahoot/socket/services/game/logger"
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
  private readonly logger: GameLogger

  private readonly disconnectTimers: Map<
    string,
    ReturnType<typeof setTimeout>
  > = new Map()

  private managerDisconnectTimer: ReturnType<typeof setTimeout> | null = null

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
    this.logger = new GameLogger()
    this._manager = {
      id: socket.id,
      clientId: socket.handshake.auth.clientId,
      connected: true,
    }

    this.cooldown = new CooldownTimer(io, this.gameId)
    this.playerManager = new PlayerManager(io, this.gameId)

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

    this.logAndEmit("info", `Partie créée — quiz : ${quizz.subject}`)
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

  getLogs() {
    return this.logger.getAll()
  }

  // ── Logger ───────────────────────────────────────────────────────────────────

  private logAndEmit(level: "info" | "warn" | "error", message: string) {
    const entry = this.logger.log(level, message)
    this.io
      .to(`manager-${this.gameId}`)
      .emit(EVENTS.MANAGER.LOG_ENTRY, entry)
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

  // ── Player actions ───────────────────────────────────────────────────────────

  join(socket: Socket, username: string, avatar?: string) {
    this.playerManager.join(socket, username, avatar)
    this.logAndEmit("info", `${username} a rejoint la partie`)
  }

  kickPlayer(socket: Socket, playerId: string) {
    const player = this.playerManager.findById(playerId)

    if (this.playerManager.kick(socket, playerId)) {
      this.playerStatus.delete(playerId)
      this.logAndEmit("warn", `${player?.username ?? playerId} a été expulsé`)
    }
  }

  // ── Reconnect ────────────────────────────────────────────────────────────────

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

    // Envoyer l'historique des logs à la télécommande qui vient de se connecter
    for (const entry of this.logger.getAll()) {
      socket.emit(EVENTS.MANAGER.LOG_ENTRY, entry)
    }

    registry.reactivateGame(this.gameId)
    this.logAndEmit("info", "Télécommande connectée")
    console.log(`Remote control connected to game ${this.inviteCode}`)
  }

  private reconnectManager(socket: Socket) {
    const newSocketId = socket.id
    const oldSocketId = this._manager.id

    if (this._manager.connected && oldSocketId !== newSocketId) {
      console.log(`[TAKEOVER] Manager takeover: ${oldSocketId} -> ${newSocketId}`)
      const oldSocket = this.io.sockets.sockets.get(oldSocketId)

      if (oldSocket) {
        oldSocket.emit(EVENTS.GAME.RESET, "errors:game.sessionTakenOver")
        oldSocket.disconnect(true)
      }
    }

    this.cancelManagerReset()

    socket.join(this.gameId)
    socket.join(`manager-${this.gameId}`)
    this._manager.id = newSocketId
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

    // Envoyer l'historique des logs au manager qui vient de se reconnecter
    for (const entry of this.logger.getAll()) {
      socket.emit(EVENTS.MANAGER.LOG_ENTRY, entry)
    }

    registry.reactivateGame(this.gameId)
    this.logAndEmit("info", "Manager reconnecté")
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

    if (isTimerActive) {
      clearTimeout(this.disconnectTimers.get(oldSocketId))
      this.disconnectTimers.delete(oldSocketId)
      console.log(`[RECONNECT_TIMER] Cancelled grace period for ${oldSocketId}`)
    }

    socket.join(this.gameId)
    this.playerManager.updateSocketId(oldSocketId, newSocketId)
    player.connected = true

    const MANAGER_ONLY_STATUSES: Status[] = [STATUS.SHOW_ROOM, STATUS.SHOW_LEADERBOARD]
    const playerSpecific = this.playerStatus.get(oldSocketId)
    const liveStatus = (() => {
      const last = this.lastBroadcastStatus

      if (!last || MANAGER_ONLY_STATUSES.includes(last.name)) {
        return {
          name: STATUS.WAIT,
          data: { text: this.started ? "game:waitingForAnswers" : "game:waitingForPlayers" },
        } as const
      }

      return last
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
    this.logAndEmit("info", `${player.username} reconnecté`)

    console.log(
      `[RECONNECT_FINISH] ${player.username} session restored on ${newSocketId}`,
    )
  }

  // ── Disconnect helpers ───────────────────────────────────────────────────────

  setManagerDisconnected() {
    this._manager.connected = false
    this.logAndEmit("warn", "Manager déconnecté — en attente de reconnexion")
    console.log(`[DISCONNECT] Manager déconnecté game=${this.inviteCode}`)
  }

  scheduleManagerReset() {
    if (this.managerDisconnectTimer) {
      return
    }

    this.logAndEmit("warn", "Manager absent — reset dans 30s si pas de reconnexion")
    console.log(
      `[DISCONNECT] Manager game=${this.inviteCode} → grace period 30s avant reset joueurs`,
    )

    this.managerDisconnectTimer = setTimeout(() => {
      this.managerDisconnectTimer = null
      this.logAndEmit("error", "Manager non reconnecté après 30s — session fermée")
      console.log(
        `[TIMEOUT] Manager game=${this.inviteCode} → reset après 30s sans reconnexion`,
      )
      this.abortCooldown()
      this.io
        .to(this.gameId)
        .emit(EVENTS.GAME.RESET, "game.managerDisconnected")
      registry.removeGame(this.gameId)
    }, 30_000)
  }

  cancelManagerReset() {
    if (this.managerDisconnectTimer) {
      clearTimeout(this.managerDisconnectTimer)
      this.managerDisconnectTimer = null
      console.log(
        `[RECONNECT] Manager game=${this.inviteCode} → timer reset annulé`,
      )
    }
  }

  removePlayer(socketId: string): Player | undefined {
    const player = this.playerManager.remove(socketId)

    if (player) {
      this.io.to(`manager-${this.gameId}`).emit(EVENTS.MANAGER.REMOVE_PLAYER, player.id)
      this.io.to(this.gameId).emit(EVENTS.GAME.REMOVE_PLAYER, player.id)
      this.playerManager.broadcastCount()
      this.logAndEmit("warn", `${player.username} retiré (30s sans reconnexion)`)
      console.log(
        `[REMOVE] ${player.username} supprimé définitivement game=${this.inviteCode} joueurs restants=${this.playerManager.count()}`,
      )
    }

    return player
  }

  setPlayerDisconnected(socketId: string) {
    const player = this.playerManager.findById(socketId)

    this.logAndEmit("warn", `${player?.username ?? "?"} déconnecté`)
    console.log(
      `[DISCONNECT] socket=${socketId} joueur=${player?.username ?? "?"} game=${this.inviteCode} (partie en cours)`,
    )
    this.playerManager.setDisconnected(socketId)
    this.playerManager.broadcastCount()
  }

  schedulePlayerRemoval(socketId: string) {
    const player = this.playerManager.findById(socketId)

    if (!player) {
      console.log(
        `[DISCONNECT] socket=${socketId} - joueur introuvable game=${this.inviteCode}`,
      )

      return
    }

    this.logAndEmit("warn", `${player.username} déconnecté — grace period 30s`)
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

  // ── Game flow ────────────────────────────────────────────────────────────────

  abortCooldown() {
    this.cooldown.abort()
  }

  async start(socket: Socket) {
    this.logAndEmit("info", "Démarrage de la partie")
    await this.round.start(socket)
  }

  async startDemo(socket: Socket) {
    this.logAndEmit("info", "Démarrage en mode démo")
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
    this.logAndEmit("warn", "Question interrompue par le manager")
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

  endGame() {
    this.logAndEmit("warn", "Session fermée manuellement par le manager")
    console.log(`[END_GAME] Force closing session game=${this.inviteCode}`)
    this.io.to(this.gameId).emit(EVENTS.GAME.RESET, "game:sessionClosedByManager")
    registry.removeGame(this.gameId)
  }
}

export default Game
