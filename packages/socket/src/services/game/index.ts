import { EVENTS } from "@rahoot/common/constants"
/* eslint-disable max-lines */
import type { GameResult, Player, Quizz } from "@rahoot/common/types/game"
import { SHOP, type PowerUpType } from "@rahoot/common/types/powerup"
import { quizzDisplayName } from "@rahoot/common/utils/quizz-name"
import {
  ROUND_EVENT_TYPE,
  type RoundEventType,
} from "@rahoot/common/types/round-event"
import type {
  AnswerAckStatus,
  Server,
  Socket,
} from "@rahoot/common/types/game/socket"
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
import {
  type GameSnapshot,
  SNAPSHOT_VERSION,
  playerToSnapshot,
  snapshotToPlayer,
} from "@rahoot/socket/services/persistence"
import {
  calculateAwards,
  createInviteCode,
  resolvePodiumTheme,
} from "@rahoot/socket/utils/game"
import { v4 as uuid } from "uuid"

const registry = Registry.getInstance()

// Libellés du journal serveur (onglet « Journal » de la télécommande), aligné
// sur le reste des messages de log — eux aussi rédigés en français.
const ROUND_EVENT_LABELS: Record<RoundEventType, string> = {
  [ROUND_EVENT_TYPE.DOUBLE_POINTS]: "Points doublés",
  [ROUND_EVENT_TYPE.SUDDEN_DEATH]: "Mort subite",
}

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
  private eveningSession: {
    quizIds: string[]
    currentIndex: number
    powerUpsEnabled: boolean
  } | null = null
  private singleQuizPowerUpsEnabled = false
  private disabledPowerUps: string[] = []
  // Mode sans rapidité : chaque bonne réponse vaut le barème plein, quel que
  // soit le temps de réponse (les égalités restent tranchées par la mort
  // subite du classement final).
  private noSpeedMode = false
  // Partie de test créée par un compte invité : seul le mode démo (solo) peut
  // la démarrer — START_GAME est refusé (cf. handlers/game).
  readonly demoOnly: boolean = false
  // Accumulateur des résultats de chaque quiz d'une soirée — en mémoire
  // uniquement (pas de persistance disque), sert au calcul des awards
  // "Wrapped" au dernier quiz. Purgé/non pertinent hors mode soirée.
  private eveningGameResults: GameResult[] = []

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

  // Statut sauvegardé avant une pause soirée, restauré tel quel à la reprise.
  private prePauseStatus: { name: Status; data: StatusDataMap[Status] } | null =
    null

  constructor(
    io: Server,
    socket: Socket | null,
    quizz: Quizz,
    options?: {
      powerUpsEnabled?: boolean
      disabledPowerUps?: string[]
      noSpeedMode?: boolean
      demoOnly?: boolean
      restore?: { gameId: string; inviteCode: string; managerClientId: string }
    },
  ) {
    if (!io) {
      throw new Error("Socket server not initialized")
    }

    const powerUpsEnabled = options?.powerUpsEnabled ?? false
    const restore = options?.restore

    this.io = io
    this.gameId = restore?.gameId ?? uuid()
    this.inviteCode = restore?.inviteCode ?? createInviteCode()
    this.logger = new GameLogger()
    this._manager = {
      // En restauration : pas de socket, le manager se rebranchera par clientId.
      id: socket?.id ?? "",
      clientId: restore?.managerClientId ?? socket!.handshake.auth.clientId,
      connected: !restore,
    }
    this.singleQuizPowerUpsEnabled = powerUpsEnabled
    this.disabledPowerUps = options?.disabledPowerUps ?? []
    this.noSpeedMode = options?.noSpeedMode ?? false
    this.demoOnly = options?.demoOnly ?? false

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

    // Chemin restauration : aucun socket à rejoindre/notifier ici. La partie
    // attend que l'hôte et les joueurs se reconnectent par clientId.
    if (restore) {
      console.log(`Game restored: ${this.inviteCode} subject: ${quizz.subject}`)

      return
    }

    socket!.join(this.gameId)
    socket!.join(`manager-${this.gameId}`)
    socket!.emit(EVENTS.MANAGER.GAME_CREATED, {
      gameId: this.gameId,
      inviteCode: this.inviteCode,
      salonImage: quizz.salonImage || quizz.listingImage,
    })

    this.logAndEmit("info", `Partie créée — quiz : ${quizz.subject}`)
    console.log(
      `New game created: ${this.inviteCode} subject: ${quizz.subject}`,
    )
  }

  // ── Persistance ──────────────────────────────────────────────────────────────

  serialize(): GameSnapshot {
    const checkpoint = this.round.getCheckpoint()

    return {
      version: SNAPSHOT_VERSION,
      gameId: this.gameId,
      inviteCode: this.inviteCode,
      managerClientId: this._manager.clientId,
      quizz: checkpoint.quizz,
      resumeIndex: checkpoint.resumeIndex,
      questionsHistory: checkpoint.questionsHistory,
      players: this.playerManager.getAll().map(playerToSnapshot),
      eveningSession: this.eveningSession
        ? {
            quizIds: this.eveningSession.quizIds,
            currentIndex: this.eveningSession.currentIndex,
            powerUpsEnabled: this.eveningSession.powerUpsEnabled,
          }
        : null,
      singleQuizPowerUpsEnabled: this.singleQuizPowerUpsEnabled,
      disabledPowerUps: this.disabledPowerUps,
      noSpeedMode: this.noSpeedMode,
      demoOnly: this.demoOnly,
      savedAt: Date.now(),
    }
  }

  // Reconstruit une partie depuis un instantané (au démarrage du serveur). Aucun
  // socket : la partie repart en lobby et attend les reconnexions par clientId.
  // Retourne null si l'instantané correspond à une partie déjà terminée.
  static restore(io: Server, snapshot: GameSnapshot): Game | null {
    const totalQuestions = snapshot.quizz.questions.length

    if (totalQuestions === 0 || snapshot.resumeIndex >= totalQuestions) {
      // Partie terminée (ou quiz vide) → rien à reprendre.
      return null
    }

    const game = new Game(io, null, snapshot.quizz, {
      powerUpsEnabled: snapshot.singleQuizPowerUpsEnabled,
      disabledPowerUps: snapshot.disabledPowerUps,
      noSpeedMode: snapshot.noSpeedMode,
      demoOnly: snapshot.demoOnly,
      restore: {
        gameId: snapshot.gameId,
        inviteCode: snapshot.inviteCode,
        managerClientId: snapshot.managerClientId,
      },
    })

    // Mode soirée : restaurer la session et recâbler le RoundManager soirée.
    if (snapshot.eveningSession) {
      game.eveningSession = { ...snapshot.eveningSession }
      game.round = game.createRoundManager(snapshot.quizz, true)
    }

    // Joueurs : points/streak conservés, marqués déconnectés (id placeholder).
    const players = snapshot.players.map(snapshotToPlayer)
    game.playerManager.replace(players)

    // Progression : on repart à la prochaine question non scorée.
    game.round.restoreCheckpoint({
      resumeIndex: snapshot.resumeIndex,
      questionsHistory: snapshot.questionsHistory,
      leaderboard: [...players].sort((a, b) => b.points - a.points),
    })

    return game
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
        ? (result, leaderboard) =>
            this.handleEveningQuizFinished(result, leaderboard)
        : undefined,
      // Le duel de départage ne doit trancher que le classement FINAL : partie
      // simple = toujours, soirée = uniquement le dernier quiz (le cumul peut
      // encore bouger avant).
      isFinalQuiz: isEvening
        ? () =>
            !this.eveningSession ||
            this.eveningSession.currentIndex + 1 >=
              this.eveningSession.quizIds.length
        : () => true,
      noSpeedMode: this.noSpeedMode,
      // Power-ups (+ boutique) uniquement quand activés pour la partie
      powerUpManager: this.powerUpsActive ? this.powerUpManager : undefined,
      onCoinsEarned: this.powerUpsActive
        ? (playerId, coins) => {
            this.io.to(playerId).emit(EVENTS.POWER_UP.COINS, { coins })
          }
        : undefined,
    })
  }

  // ── Mode Soirée ─────────────────────────────────────────────────────────────

  initEveningMode(
    quizIds: string[],
    powerUpsEnabled: boolean = true,
    disabledPowerUps: string[] = [],
    noSpeedMode: boolean = false,
  ) {
    this.eveningSession = { quizIds, currentIndex: 0, powerUpsEnabled }
    this.disabledPowerUps = disabledPowerUps
    this.noSpeedMode = noSpeedMode
    const firstQuizz = Config.findQuizzByAnyId(quizIds[0])

    if (!firstQuizz) {
      return
    }

    this.round = this.createRoundManager(firstQuizz, true)
  }

  private get powerUpsActive(): boolean {
    return (
      this.singleQuizPowerUpsEnabled ||
      Boolean(this.eveningSession?.powerUpsEnabled)
    )
  }

  private handleEveningQuizFinished(result: GameResult, leaderboard: Player[]) {
    if (!this.eveningSession) {
      return
    }

    Config.saveResult({ ...result, logs: this.logger.getAll() })
    this.eveningGameResults.push(result)

    // Bonus de pièces de fin de quiz (victoire + quiz sans faute)
    this.grantQuizEndCoins(result, leaderboard)

    const { quizIds, currentIndex } = this.eveningSession
    const isLastQuiz = currentIndex + 1 >= quizIds.length
    // Le quiz qui vient de se terminer : `result.subject` est le titre interne
    // (archivage), les écrans joueurs affichent son nom public.
    const finishedQuizz = Config.findQuizzByAnyId(quizIds[currentIndex])
    const finishedName = finishedQuizz
      ? quizzDisplayName(finishedQuizz)
      : result.subject

    if (isLastQuiz) {
      // Thème du podium final de soirée : réglage du dernier quiz joué.
      const data = {
        subject: finishedName,
        top: leaderboard.slice(0, 3),
        totalPlayers: leaderboard.length,
        awards: calculateAwards(this.eveningGameResults, leaderboard),
        podiumTheme: resolvePodiumTheme(finishedQuizz?.podiumTheme),
        // Fond du podium "neutre" : couverture du quiz, sinon image du salon.
        coverImage: finishedQuizz?.listingImage || finishedQuizz?.salonImage,
      }

      this.io.to(`manager-${this.gameId}`).emit(EVENTS.GAME.STATUS, {
        name: STATUS.FINISHED,
        data,
      })

      leaderboard.forEach((player, index) => {
        this.io.to(player.id).emit(EVENTS.GAME.STATUS, {
          name: STATUS.FINISHED,
          data: { ...data, rank: index + 1 },
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
      subject: finishedName,
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

    // Garde contre un EVENING.NEXT tardif/dupliqué (countdown auto de
    // l'interstitiel + bouton manuel, potentiellement montés à la fois sur
    // l'écran principal et la télécommande) : si le quiz suivant a déjà été
    // démarré manuellement par l'hôte, ou si un duel de départage est en
    // cours (started=false pendant le duel), on ne doit pas écraser le
    // RoundManager.
    if (this.round.isStarted() || this.round.isTieBreakActive()) {
      return
    }

    const { quizIds, currentIndex } = this.eveningSession
    const quizz = Config.findQuizzByAnyId(quizIds[currentIndex])

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

  // Pause soirée : restreinte à l'écran salon (entre deux quiz) pour éviter
  // toute complexité de suspension d'un CooldownTimer en cours — pas de
  // persistance disque du statut de pause (limitation assumée, une pause de
  // quelques minutes ne survit pas à un crash serveur de toute façon).
  pauseGame() {
    if (!this.eveningSession) {
      return
    }

    if (
      !this.lastBroadcastStatus ||
      this.lastBroadcastStatus.name !== STATUS.SHOW_ROOM
    ) {
      return
    }

    this.prePauseStatus = this.lastBroadcastStatus
    this.logAndEmit("info", "Partie mise en pause")
    this.broadcastStatus(STATUS.PAUSED, { text: "game:paused" })
  }

  resumeGame() {
    if (!this.prePauseStatus) {
      return
    }

    const status = this.prePauseStatus
    this.prePauseStatus = null
    this.logAndEmit("info", "Partie reprise")
    this.broadcastStatus(status.name, status.data)

    // SHOW_ROOM n'est rendu que côté manager : sans statut dédié, les
    // téléphones resteraient figés sur l'écran Pause jusqu'au SHOW_START du
    // quiz suivant. On les bascule explicitement en attente.
    for (const player of this.playerManager.getAll()) {
      this.sendStatus(player.id, STATUS.WAIT, {
        text: "game:waitingForPlayers",
      })
    }
  }

  // ── Power-ups / boutique ─────────────────────────────────────────────────────

  // Bonus de pièces de fin de quiz (mode soirée) : le vainqueur et les joueurs
  // ayant réussi le quiz sans faute reçoivent un bonus de pièces.
  private grantQuizEndCoins(result: GameResult, leaderboard: Player[]) {
    if (!this.powerUpsActive) {
      return
    }

    // Gagnant de CE quiz = delta net de points sur `result.questions` (propre
    // à ce quiz). `leaderboard[0]` est le classement CUMULÉ de la soirée : le
    // prendre tel quel créditerait le leader de la soirée même s'il vient de
    // perdre ce quiz-ci.
    const deltaByPlayer = new Map<string, number>()

    for (const q of result.questions) {
      for (const pa of q.playerAnswers) {
        deltaByPlayer.set(
          pa.playerName,
          (deltaByPlayer.get(pa.playerName) ?? 0) + pa.points,
        )
      }
    }

    let winnerUsername: string | null = null
    let winnerDelta = 0

    for (const [username, delta] of deltaByPlayer) {
      if (delta > winnerDelta) {
        winnerDelta = delta
        winnerUsername = username
      }
    }

    const winner = winnerUsername
      ? leaderboard.find((p) => p.username === winnerUsername)
      : undefined

    if (winner) {
      winner.goldCoins = (winner.goldCoins ?? 0) + SHOP.QUIZ_WIN_BONUS
      this.emitCoins(winner)
    }

    // Quiz sans faute : le joueur a marqué des points à chaque question
    const totalQuestions = result.questions.length

    for (const player of leaderboard) {
      const correctAnswers = result.questions.filter((q) =>
        q.playerAnswers.some(
          (a) => a.playerName === player.username && a.points > 0,
        ),
      ).length

      if (totalQuestions > 0 && correctAnswers === totalQuestions) {
        player.goldCoins = (player.goldCoins ?? 0) + SHOP.PERFECT_BONUS
        this.emitCoins(player)
      }
    }
  }

  sendPlayerInventory(playerId: string) {
    if (!this.powerUpsActive) {
      return
    }

    const inventory = this.powerUpManager.getPlayerPowerUps(playerId)
    this.io.to(playerId).emit(EVENTS.POWER_UP.INVENTORY, inventory)

    // Solde de pièces (pour la boutique)
    const player = this.playerManager.findById(playerId)

    if (player) {
      this.emitCoins(player)
    }

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
    const result = this.powerUpManager.usePowerUp(
      players,
      playerId,
      powerUpId,
      targetIds,
    )

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
          this.io
            .to(`manager-${this.gameId}`)
            .emit(EVENTS.MANAGER.NEW_PLAYER, updated)
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
    this.io.to(`manager-${this.gameId}`).emit(EVENTS.MANAGER.LOG_ENTRY, entry)
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

    // Boutique activée : on crédite le solde de pièces de départ (le joueur
    // achète ses power-ups au lieu d'en recevoir aléatoirement).
    if (this.powerUpsActive) {
      const player = this.playerManager.findById(socket.id)

      if (player) {
        player.goldCoins = SHOP.STARTING_COINS
        this.emitCoins(player)
        this.io
          .to(`manager-${this.gameId}`)
          .emit(EVENTS.MANAGER.NEW_PLAYER, player)
      }
    }
  }

  private emitCoins(player: Player) {
    this.io.to(player.id).emit(EVENTS.POWER_UP.COINS, {
      coins: player.goldCoins ?? 0,
      disabledPowerUps: this.disabledPowerUps,
    })
  }

  // Achat d'un power-up à la boutique (contre des pièces d'or).
  handleBuyPowerUp(
    playerId: string,
    type: PowerUpType,
  ): { success: boolean; error?: string } {
    if (!this.powerUpsActive) {
      return { success: false, error: "errors:shop.disabled" }
    }

    if (this.disabledPowerUps.includes(type)) {
      return { success: false, error: "errors:shop.itemDisabled" }
    }

    const player = this.playerManager.findById(playerId)

    if (!player) {
      return { success: false, error: "errors:game.notFound" }
    }

    const result = this.powerUpManager.buyPowerUp(player, type)

    if (!result.success || !result.powerUp) {
      return { success: false, error: result.error }
    }

    // On pousse le power-up acheté (déclenche l'animation d'obtention) + le
    // nouveau solde ; le manager voit le solde à jour sur l'objet joueur.
    this.io.to(playerId).emit(EVENTS.POWER_UP.EARNED, result.powerUp)
    this.emitCoins(player)
    this.io.to(`manager-${this.gameId}`).emit(EVENTS.MANAGER.NEW_PLAYER, player)

    return { success: true }
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
      inviteCode: this.inviteCode,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      timer: this.cooldown.getTimeRemaining(),
      players: this.playerManager.getAll(),
      armedRoundEvent: this.round.getArmedRoundEvent(),
      isEveningMode: Boolean(this.eveningSession),
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
      console.log(
        `[TAKEOVER] Manager takeover: ${oldSocketId} -> ${newSocketId}`,
      )
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
      inviteCode: this.inviteCode,
      currentQuestion: this.round.getReconnectInfo(),
      status,
      timer: this.cooldown.getTimeRemaining(),
      players: this.playerManager.getAll(),
      armedRoundEvent: this.round.getArmedRoundEvent(),
      isEveningMode: Boolean(this.eveningSession),
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

    console.log(
      `[RECONNECT_START] clientId=${clientId.substring(0, 8)} newSocket=${newSocketId}`,
    )

    if (!player) {
      console.warn(
        `[RECONNECT_REJECT] Player not found for clientId=${clientId}`,
      )
      socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")

      return
    }

    const oldSocketId = player.id
    const isTimerActive = this.disconnectTimers.has(oldSocketId)

    console.log(
      `[RECONNECT_TRACE] player=${player.username} oldSocket=${oldSocketId} connected=${player.connected} timerActive=${isTimerActive}`,
    )

    if (player.connected && oldSocketId !== newSocketId) {
      console.log(
        `[TAKEOVER] Triggered for ${player.username} (${oldSocketId} -> ${newSocketId})`,
      )
      const oldSocket = this.io.sockets.sockets.get(oldSocketId)

      if (oldSocket) {
        console.log(`[TAKEOVER] Disconnecting old socket ${oldSocketId}`)
        // Pas de GAME.RESET ici : c'est le MÊME clientId qui se reconnecte (même
        // navigateur après un blip réseau). Émettre RESET renvoyait le joueur à
        // l'accueil = « déco sauvage ». On coupe juste le socket orphelin.
        oldSocket.disconnect(true)
      } else {
        console.log(
          `[TAKEOVER] Old socket ${oldSocketId} already gone from memory`,
        )
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
    // Idem pour l'inventaire de power-ups + effets actifs (indexés socket id),
    // sinon les power-ups achetés sont perdus au moindre blip réseau.
    this.powerUpManager.remap(oldSocketId, newSocketId)
    player.connected = true

    const MANAGER_ONLY_STATUSES: Status[] = [
      STATUS.SHOW_ROOM,
      STATUS.SHOW_LEADERBOARD,
    ]
    const playerSpecific = this.playerStatus.get(oldSocketId)
    const liveStatus = (() => {
      const last = this.lastBroadcastStatus

      if (!last || MANAGER_ONLY_STATUSES.includes(last.name)) {
        return {
          name: STATUS.WAIT,
          data: {
            text: this.started
              ? "game:waitingForAnswers"
              : "game:waitingForPlayers",
          },
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

    console.log(
      `[RECONNECT_SUCCESS] Emitting SUCCESS_RECONNECT to ${newSocketId}`,
    )
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

    if (this.powerUpsActive) {
      this.sendPlayerInventory(newSocketId)
    }

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

    this.logAndEmit(
      "warn",
      "Manager absent — reset dans 30s si pas de reconnexion",
    )
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

      this.logAndEmit(
        "error",
        "Manager non reconnecté après 30s — session fermée",
      )
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
      // Purge de l'inventaire / effets / wins pour éviter les entrées orphelines.
      this.powerUpManager.removePlayer(socketId)
      this.io
        .to(`manager-${this.gameId}`)
        .emit(EVENTS.MANAGER.REMOVE_PLAYER, player.id)
      this.io.to(this.gameId).emit(EVENTS.GAME.REMOVE_PLAYER, player.id)
      this.playerManager.broadcastCount()
      this.logAndEmit(
        "warn",
        `${player.username} retiré (30s sans reconnexion)`,
      )
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
  ): AnswerAckStatus {
    return this.round.selectAnswer(socket, payload)
  }

  submitTieBreakAnswer(socket: Socket, answerId: number) {
    return this.round.submitTieBreakAnswer(socket, answerId)
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

  armRoundEvent(eventType: RoundEventType | null) {
    this.round.armRoundEvent(eventType)
    this.logAndEmit(
      "info",
      eventType
        ? `Événement armé pour la prochaine question : ${ROUND_EVENT_LABELS[eventType]}`
        : "Événement de manche annulé",
    )
    this.io
      .to(`manager-${this.gameId}`)
      .emit(EVENTS.MANAGER.ROUND_EVENT_ARMED, { eventType })
  }

  showLeaderboard() {
    if (!this.acceptAdvance()) {
      return
    }

    // Garde contre un déclenchement manager/télécommande pendant qu'une
    // question est en cours de préparation/diffusion (avancerait l'index sans
    // que la question courante ait été jouée). Posé ici plutôt que dans
    // RoundManager.showLeaderboard() : cette méthode-là est aussi appelée en
    // interne (fin de quiz sur un slide titre) pendant que
    // questionInProgress est encore vrai, et ce chemin-là doit rester libre.
    if (this.round.isQuestionInProgress()) {
      return
    }

    this.round.showLeaderboard()
  }

  validateOpenAnswer(text: string) {
    this.round.validateOpenAnswer(text)
  }

  invalidateOpenAnswer(text: string) {
    this.round.invalidateOpenAnswer(text)
  }

  finalizeOpenAnswers() {
    this.round.finalizeOpenAnswers()
  }

  endGame() {
    this.logAndEmit("warn", "Session fermée manuellement par le manager")
    console.log(`[END_GAME] Force closing session game=${this.inviteCode}`)
    this.io
      .to(this.gameId)
      .emit(EVENTS.GAME.RESET, "game:sessionClosedByManager")
    registry.removeGame(this.gameId)
  }
}

export default Game
