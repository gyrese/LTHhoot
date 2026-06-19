import { EVENTS } from "@rahoot/common/constants"
import type { GameResult, Player, Quizz } from "@rahoot/common/types/game"
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
import { PowerUpManager } from "@rahoot/socket/services/game/powerup-manager"
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
  private round: RoundManager
  private readonly cooldown: CooldownTimer
  private readonly logger: GameLogger
  private readonly powerUpManager: PowerUpManager
  private eveningSession: { quizIds: string[]; currentIndex: number; powerUpsEnabled: boolean } | null = null
  private singleQuizPowerUpsEnabled = false

  private readonly disconnectTimers: Map<
    string,
    ReturnType<typeof setTimeout>
  > = new Map()

  private managerDisconnectTimer: ReturnType<typeof setTimeout> | null = null

  // Horodatage de la dernière transition d'avancement acceptée. Sert de verrou
  // anti-double-pilotage : l'écran principal et la télécommande sont tous deux
  // dans la room manager et peuvent émettre la même commande (« suivant »,
  // « voir le classement »). Sans ce garde, deux clics concurrents font sauter
  // une question. 600 ms suffisent : les étapes légitimes sont toujours séparées
  // par plusieurs secondes d'interaction.
  private lastAdvanceAt = 0

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

  constructor(io: Server, socket: Socket, quizz: Quizz, powerUpsEnabled = false) {
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
    this.singleQuizPowerUpsEnabled = powerUpsEnabled

    this.cooldown = new CooldownTimer(io, this.gameId)
    this.playerManager = new PlayerManager(io, this.gameId)
    this.powerUpManager = new PowerUpManager()

    this.round = this.createRoundManager(quizz, false)

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

  // ── Factory RoundManager ────────────────────────────────────────────────────

  private createRoundManager(quizz: Quizz, isEvening: boolean): RoundManager {
    return new RoundManager({
      quizz,
      players: this.playerManager,
      cooldown: this.cooldown,
      io: this.io,
      gameId: this.gameId,
      getManagerId: () => this._manager.id,
      broadcast: this.broadcastStatus.bind(this),
      send: this.sendStatus.bind(this),
      onNewQuestion: () => {
        this.playerStatus.clear()
        this.managerStatus = null
      },
      onGameFinished: (result) => {
        Config.saveResult({ ...result, logs: this.logger.getAll() })

        if (!isEvening) {
          registry.removeGame(this.gameId)
        }
      },
      onEveningQuizFinished: isEvening
        ? (result, leaderboard) => this.handleEveningQuizFinished(result, leaderboard)
        : undefined,
      // Power-ups uniquement en mode soirée avec flag activé
      powerUpManager: this.powerUpsActive ? this.powerUpManager : undefined,
      onPowerUpEarned: this.powerUpsActive
        ? (playerId, powerUp) => {
            this.io.to(playerId).emit(EVENTS.POWER_UP.EARNED, powerUp)
          }
        : undefined,
    })
  }

  // ── Mode Soirée ─────────────────────────────────────────────────────────────

  initEveningMode(quizIds: string[], powerUpsEnabled: boolean = true) {
    this.eveningSession = { quizIds, currentIndex: 0, powerUpsEnabled }
    const firstQuizz = Config.quizz().find((q) => q.id === quizIds[0])

    if (!firstQuizz) {
      return
    }

    this.round = this.createRoundManager(firstQuizz, true)
  }

  private get powerUpsActive(): boolean {
    return this.singleQuizPowerUpsEnabled || Boolean(this.eveningSession?.powerUpsEnabled)
  }

  private handleEveningQuizFinished(result: GameResult, leaderboard: Player[]) {
    if (!this.eveningSession) {
      return
    }

    Config.saveResult({ ...result, logs: this.logger.getAll() })

    // Évaluer les power-ups de fin de quiz (victoire, sans faute, 2 wins d'affilée)
    this.grantQuizEndPowerUps(result, leaderboard)

    const { quizIds, currentIndex } = this.eveningSession
    const isLastQuiz = currentIndex + 1 >= quizIds.length

    if (isLastQuiz) {
      const top = leaderboard.slice(0, 3)

      this.io.to(`manager-${this.gameId}`).emit(EVENTS.GAME.STATUS, {
        name: STATUS.FINISHED,
        data: { subject: result.subject, top, totalPlayers: leaderboard.length },
      })

      leaderboard.forEach((player, index) => {
        this.io.to(player.id).emit(EVENTS.GAME.STATUS, {
          name: STATUS.FINISHED,
          data: {
            subject: result.subject,
            top,
            rank: index + 1,
            totalPlayers: leaderboard.length,
          },
        })
      })

      this.io.to(this.gameId).emit(EVENTS.EVENING.COMPLETE, {
        leaderboard: leaderboard.map((p, i) => ({ ...p, rank: i + 1 })),
      })

      registry.removeGame(this.gameId)
      this.eveningSession = null

      return
    }

    this.eveningSession.currentIndex += 1

    this.io.to(this.gameId).emit(EVENTS.EVENING.QUIZ_COMPLETE, {
      quizIndex: currentIndex,
      totalQuizzes: quizIds.length,
      subject: result.subject,
      leaderboard: leaderboard.map((p, i) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        points: p.points,
        rank: i + 1,
      })),
    })
  }

  startNextEveningQuiz() {
    if (!this.eveningSession) {
      return
    }

    const { quizIds, currentIndex } = this.eveningSession
    const quizz = Config.quizz().find((q) => q.id === quizIds[currentIndex])

    if (!quizz) {
      return
    }

    // Réinitialiser les streaks des joueurs pour le nouveau quiz
    for (const player of this.playerManager.getAll()) {
      player.streak = 0
    }

    this.powerUpManager.resetBetweenQuizzes()
    this.round = this.createRoundManager(quizz, true)

    // Retour à la salle d'attente — permet aux nouveaux joueurs de rejoindre
    // avant le quiz suivant. L'hôte déclenche le départ via MANAGER.START_GAME.
    this.broadcastStatus(STATUS.SHOW_ROOM, {
      text: "game:waitingForPlayers",
      inviteCode: this.inviteCode,
      salonImage: quizz.salonImage ?? quizz.listingImage,
    })
  }

  // ── Power-ups ────────────────────────────────────────────────────────────────

  private grantQuizEndPowerUps(result: GameResult, leaderboard: Player[]) {
    if (!this.powerUpsActive) {
      return
    }

    const [winner] = leaderboard
    const winnerId = winner?.points && winner.points > 0 ? winner.id : null
    const allPlayerIds = leaderboard.map((p) => p.id)

    // Quiz sans faute : player a marqué des points à chaque question
    const totalQuestions = result.questions.length
    const perfectPlayerIds: string[] = []

    for (const player of leaderboard) {
      const correctAnswers = result.questions.filter((q) =>
        q.playerAnswers.some((a) => a.playerName === player.username && a.points > 0),
      ).length

      if (totalQuestions > 0 && correctAnswers === totalQuestions) {
        perfectPlayerIds.push(player.id)
      }
    }

    const earned = this.powerUpManager.evaluateQuizEndEarnings(
      winnerId,
      perfectPlayerIds,
      allPlayerIds,
    )

    for (const { playerId, powerUp } of earned) {
      this.io.to(playerId).emit(EVENTS.POWER_UP.EARNED, powerUp)
    }
  }

  sendPlayerInventory(playerId: string) {
    if (!this.powerUpsActive) {
      return
    }

    const inventory = this.powerUpManager.getPlayerPowerUps(playerId)
    this.io.to(playerId).emit(EVENTS.POWER_UP.INVENTORY, inventory)

    // Notify the player about all other connected players so their target list is fully synced
    for (const p of this.playerManager.getAll()) {
      if (p.id !== playerId) {
        this.io.to(playerId).emit(EVENTS.GAME.NEW_PLAYER, {
          id: p.id,
          username: p.username,
          avatar: p.avatar,
        })
      }
    }
  }

  handlePowerUpUsed(playerId: string, powerUpId: string, targetIds?: string[]) {
    if (!this.powerUpsActive) {
      return
    }

    const players = this.playerManager.getAll()
    const result = this.powerUpManager.usePowerUp(players, playerId, powerUpId, targetIds)

    if (!result.success) {
      return
    }

    if (!result.type) {
      return
    }

    if (result.blockedBy) {
      this.io.to(playerId).emit(EVENTS.POWER_UP.BLOCKED, {
        powerUpType: result.type,
        defenderId: result.blockedBy,
      })

      return
    }

    const activatorPlayer = players.find((p) => p.id === playerId)
    this.io.to(this.gameId).emit(EVENTS.POWER_UP.EFFECT, {
      type: result.type,
      activatedBy: playerId,
      activatedByUsername: activatorPlayer?.username,
      affectedPlayers: result.affectedPlayers ?? [],
      ...(result.mirroredTo ? { mirrored: true } : {}),
    })

    // Mettre à jour les points modifiés côté joueurs
    if (result.affectedPlayers && result.affectedPlayers.length > 0) {
      this.playerManager.replace(players)

      for (const affected of result.affectedPlayers) {
        const updated = players.find((p) => p.id === affected.id)

        if (updated) {
          // Informer le manager des nouvelles valeurs de score pour rafraîchissement temps réel
          this.io.to(`manager-${this.gameId}`).emit(EVENTS.MANAGER.NEW_PLAYER, updated)
        }
      }
    }
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

  // Vrai s'il reste au moins un joueur connecté. Sert de garde au nettoyage des
  // parties « vides » : tant qu'un joueur est connecté (même si l'écran manager
  // a sauté et que la partie est pilotée par la seule télécommande), on ne doit
  // pas détruire la session sous lui.
  get hasConnectedPlayers(): boolean {
    return this.playerManager.getAll().some((p) => p.connected)
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

    // Cadeau de bienvenue (mode soirée avec power-ups activés) : 1 commun aléatoire
    if (this.powerUpsActive) {
      const gift = this.powerUpManager.grantStartGift(socket.id)

      if (gift) {
        this.io.to(socket.id).emit(EVENTS.POWER_UP.EARNED, gift.powerUp)
      }
    }
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
    // La télécommande prend le relais : si un reset « écran principal absent »
    // était armé (salon, partie non démarrée), on l'annule — la partie est
    // pilotée, elle ne doit pas se fermer toute seule.
    this.cancelManagerReset()

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
        // Même logique que pour le joueur : reconnexion du même clientId, on
        // évite le RESET qui éjecterait l'écran manager légitime.
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
        // Pas de GAME.RESET ici : c'est le MÊME clientId qui se reconnecte (même
        // navigateur après un blip réseau). Émettre RESET renvoyait le joueur à
        // l'accueil = « déco sauvage ». On coupe juste le socket orphelin.
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
    // Réassocier une éventuelle réponse en attente au nouveau socket id, sinon
    // le joueur reconnecté n'est pas crédité au scoring (cf. questions ouvertes
    // et leur fenêtre de repêchage).
    this.round.remapPlayerAnswer(oldSocketId, newSocketId)
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
      players: this.playerManager.getAll().map((p) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
      })),
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

      // Ne JAMAIS détruire la session s'il reste des joueurs connectés : l'hôte
      // peut piloter la partie depuis la télécommande pendant que l'écran
      // principal est tombé. Détruire ici éjecterait tout le monde alors que la
      // soirée est bien vivante. Le nettoyage des parties réellement abandonnées
      // reste assuré par le cleanup « empty games » (5 min, même garde).
      if (this.hasConnectedPlayers) {
        this.logAndEmit(
          "warn",
          "Écran principal absent mais joueurs connectés — session conservée",
        )
        console.log(
          `[TIMEOUT] Manager game=${this.inviteCode} → joueurs présents, reset annulé`,
        )

        return
      }

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

  // Verrou anti-double-pilotage partagé par toutes les transitions d'avancement.
  // Retourne false (et ignore l'action) si une transition a déjà été acceptée il
  // y a moins de 600 ms, quelle que soit la source (écran principal ou
  // télécommande).
  private acceptAdvance(): boolean {
    const now = Date.now()

    if (now - this.lastAdvanceAt < 600) {
      return false
    }

    this.lastAdvanceAt = now

    return true
  }

  nextRound(socket: Socket) {
    if (!this.acceptAdvance()) {
      return
    }

    this.round.nextQuestion(socket)
  }

  abortRound(socket: Socket) {
    this.logAndEmit("warn", "Question interrompue par le manager")
    this.round.abortQuestion(socket)
  }

  showLeaderboard() {
    if (!this.acceptAdvance()) {
      return
    }

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
