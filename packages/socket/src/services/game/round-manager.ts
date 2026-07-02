import { EVENTS } from "@rahoot/common/constants"
import type {
  Answer,
  GameResult,
  Player,
  Question,
  QuestionResult,
  Quizz,
} from "@rahoot/common/types/game"
import type {
  AnswerAckStatus,
  Server,
  Socket,
} from "@rahoot/common/types/game/socket"
import {
  type Status,
  STATUS,
  type StatusDataMap,
} from "@rahoot/common/types/game/status"
import { SHOP, type PowerUp } from "@rahoot/common/types/powerup"
import { CooldownTimer } from "@rahoot/socket/services/game/cooldown-timer"
import { PlayerManager } from "@rahoot/socket/services/game/player-manager"
import { PowerUpManager } from "@rahoot/socket/services/game/powerup-manager"
import { buildOpenAnswersList } from "@rahoot/socket/utils/open-answers"
import { checkAnswer, timeToPoint } from "@rahoot/socket/utils/game"
import sleep from "@rahoot/socket/utils/sleep"
import { nanoid } from "nanoid"

type BroadcastFn = <T extends Status>(
  _status: T,
  _data: StatusDataMap[T],
) => void
type SendFn = <T extends Status>(
  _target: string,
  _status: T,
  _data: StatusDataMap[T],
) => void

export interface RoundManagerOptions {
  quizz: Quizz
  players: PlayerManager
  cooldown: CooldownTimer
  io: Server
  gameId: string
  getManagerId: () => string
  broadcast: BroadcastFn
  send: SendFn
  onNewQuestion: () => void
  onGameFinished: (_result: GameResult) => void
  onEveningQuizFinished?: (_result: GameResult, _leaderboard: Player[]) => void
  powerUpManager?: PowerUpManager
  onPowerUpEarned?: (_playerId: string, _powerUp: PowerUp) => void
  onCoinsEarned?: (_playerId: string, _coins: number) => void
}

/** Types qui se comportent comme `open` pour la collecte/validation/scoring. */
function isOpenLike(type: string): boolean {
  return type === "open" || type === "image_sequence"
}

export class RoundManager {
  private readonly opts: RoundManagerOptions
  private started = false
  private questionInProgress = false
  private currentQuestion = 0
  private playersAnswers: Answer[] = []
  private startTime = 0
  private acceptingAnswers = false
  private leaderboard: Player[] = []
  private tempOldLeaderboard: Player[] | null = null
  private questionsHistory: QuestionResult[] = []
  private pendingOpenQuestion: Question | null = null
  private pendingOpenCorrectAnswers: string[] = []
  private demoMode = false

  constructor(opts: RoundManagerOptions) {
    this.opts = opts
  }

  isStarted(): boolean {
    return this.started
  }

  setDemoMode(enabled: boolean) {
    this.demoMode = enabled
  }

  private getNonTitleCount() {
    const total = this.opts.quizz.questions.filter(
      (q) => q.type !== "title",
    ).length
    const current = this.opts.quizz.questions
      .slice(0, this.currentQuestion + 1)
      .filter((q) => q.type !== "title").length

    return { current, total }
  }

  getReconnectInfo() {
    const { current, total } = this.getNonTitleCount()

    return { current, total }
  }

  // ── Persistance ───────────────────────────────────────────────────────────

  // Instantané sérialisable de la progression. `resumeIndex` = nombre de
  // questions déjà traitées (= prochaine question NON scorée). Le scoring n'a
  // lieu qu'à `showResults` (qui pousse dans `questionsHistory`), donc reprendre
  // à cet index ne peut jamais recompter une question.
  getCheckpoint() {
    return {
      quizz: this.opts.quizz,
      resumeIndex: this.questionsHistory.length,
      questionsHistory: this.questionsHistory,
    }
  }

  // Réinjecte une progression restaurée. La partie repart en état « non démarrée »
  // (started=false) : l'hôte relance via le flux Start habituel, qui repose la
  // question `resumeIndex` avec les scores cumulés intacts.
  restoreCheckpoint(state: {
    resumeIndex: number
    questionsHistory: QuestionResult[]
    leaderboard: Player[]
  }): void {
    const maxIndex = Math.max(0, this.opts.quizz.questions.length - 1)
    this.currentQuestion = Math.min(state.resumeIndex, maxIndex)
    this.questionsHistory = state.questionsHistory
    this.leaderboard = state.leaderboard
    this.started = false
    this.playersAnswers = []
    this.acceptingAnswers = false
    this.questionInProgress = false
  }

  async start(socket: Socket): Promise<void> {
    if (!socket.rooms.has(`manager-${this.opts.gameId}`)) {
      return
    }

    if (this.started) {
      return
    }

    if (this.opts.players.count() === 0 && !this.demoMode) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.noPlayersConnected")

      return
    }

    if (this.opts.quizz.questions.length === 0) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.noQuestions")

      return
    }

    this.started = true

    this.opts.broadcast(STATUS.SHOW_START, {
      time: 3,
      subject: this.opts.quizz.subject,
    })

    await sleep(3)

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.START_COOLDOWN)
    await this.opts.cooldown.start(3)

    void this.newQuestion()
  }

  async newQuestion(): Promise<void> {
    if (this.questionInProgress) {
      return
    }

    this.questionInProgress = true

    try {
      if (!this.started) {
        return
      }

      const question = this.opts.quizz.questions[this.currentQuestion]

      this.opts.onNewQuestion()

      // Title slides skip the prepared/answer/results phases
      if (question.type === "title") {
        this.opts.broadcast(STATUS.SHOW_QUESTION, {
          question: question.question,
          type: question.type,
          media: question.media,
          background: question.background,
          backgroundOpacity: question.backgroundOpacity,
          elements: question.elements,
          audio: question.audio,
          cooldown: question.cooldown,
          pinImage: undefined,
          revelationEnabled: question.revelationEnabled,
          revealDuration: question.revealDuration,
          gridCols: question.gridCols,
          gridRows: question.gridRows,
          revelationStyle: question.revelationStyle,
        })

        await this.opts.cooldown.start(question.cooldown)

        if (!this.started) {
          return
        }

        // Store in history with no player answers
        this.questionsHistory.push({
          ...question,
          playerAnswers: [],
        })

        // Skip to leaderboard/next automatically
        const isLastRound =
          this.currentQuestion + 1 === this.opts.quizz.questions.length

        if (isLastRound) {
          this.showLeaderboard()
        } else {
          this.currentQuestion += 1
          setTimeout(() => {
            void this.newQuestion()
          }, 0)
        }

        return
      }

      const { current: questionNumber, total: questionTotal } =
        this.getNonTitleCount()

      this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.UPDATE_QUESTION, {
        current: questionNumber,
        total: questionTotal,
      })

      const totalAnswers = (() => {
        switch (question.type) {
          case "mcq":
            return question.answers.length

          case "true_false":
            return 2

          default:
            return 0
        }
      })()

      this.opts.broadcast(STATUS.SHOW_PREPARED, {
        totalAnswers,
        questionNumber,
        type: question.type,
      })

      await this.opts.cooldown.start(4)

      if (!this.started) {
        return
      }

      this.opts.broadcast(STATUS.SHOW_QUESTION, {
        question: question.question,
        type: question.type,
        media: question.media,
        background: question.background,
        backgroundOpacity: question.backgroundOpacity,
        elements: question.elements,
        audio: question.audio,
        cooldown: question.cooldown,
        pinImage: question.type === "drop_pin" ? question.pinImage : undefined,
        revelationEnabled: question.revelationEnabled,
        revealDuration: question.revealDuration,
        gridCols: question.gridCols,
        gridRows: question.gridRows,
        revelationStyle: question.revelationStyle,
        images: question.type === "image_sequence" ? question.images : undefined,
        imageInterval: question.type === "image_sequence" ? (question.imageInterval ?? 5) : undefined,
      })

      // Send solution to manager only
      this.opts.send(this.opts.getManagerId(), STATUS.SHOW_QUESTION, {
        question: question.question,
        type: question.type,
        media: question.media,
        background: question.background,
        backgroundOpacity: question.backgroundOpacity,
        elements: question.elements,
        audio: question.audio,
        cooldown: question.cooldown,
        pinImage: question.type === "drop_pin" ? question.pinImage : undefined,
        revelationEnabled: question.revelationEnabled,
        revealDuration: question.revealDuration,
        gridCols: question.gridCols,
        gridRows: question.gridRows,
        revelationStyle: question.revelationStyle,
        images: question.type === "image_sequence" ? question.images : undefined,
        imageInterval: question.type === "image_sequence" ? (question.imageInterval ?? 5) : undefined,
        ...RoundManager.getQuestionSolutionData(question),
      })

      await this.opts.cooldown.start(question.cooldown)

      if (!this.started) {
        return
      }

      this.startTime = Date.now()
      this.acceptingAnswers = true

      const selectAnswerBase = {
        question: question.question,
        type: question.type,
        media: question.media,
        background: question.background,
        backgroundOpacity: question.backgroundOpacity,
        elements: question.elements,
        audio: question.audio,
        time: question.time,
        totalPlayer: this.opts.players.countConnected(),
        revelationEnabled: question.revelationEnabled,
        revealDuration: question.revealDuration,
        gridCols: question.gridCols,
        gridRows: question.gridRows,
        revelationStyle: question.revelationStyle,
      }

      const selectAnswerExtra = (() => {
        switch (question.type) {
          case "mcq":
            return { answers: question.answers }

          case "true_false":
            return {}

          case "open":
            return {}

          case "image_sequence":
            return {
              images: question.images,
              imageInterval: question.imageInterval ?? 5,
            }

          case "date":
            return {
              minYear: question.minYear ?? question.correctYear - 30,
              maxYear: question.maxYear ?? question.correctYear + 30,
            }

          case "slider":
            return {
              min: question.min ?? 0,
              max: question.max ?? 100,
            }

          case "puzzle":
            return { items: question.items }

          case "drop_pin":
            return { pinImage: question.pinImage }

          default:
            return {}
        }
      })()

      // Send custom SELECT_ANSWER status to each player to convey frozen / scrambled states
      for (const player of this.opts.players.getAll()) {
        const isFrozen = this.opts.powerUpManager?.hasFrozen(player.id) ?? false
        const isScrambled = this.opts.powerUpManager?.hasScrambled(player.id) ?? false

        this.opts.send(player.id, STATUS.SELECT_ANSWER, {
          ...selectAnswerBase,
          ...selectAnswerExtra,
          isFrozen,
          isScrambled,
        } as any)
      }

      // Send solution to manager only
      this.opts.send(this.opts.getManagerId(), STATUS.SELECT_ANSWER, {
        ...selectAnswerBase,
        ...selectAnswerExtra,
        ...RoundManager.getQuestionSolutionData(question),
      })

      await this.opts.cooldown.start(question.time)
      this.acceptingAnswers = false

      if (!this.started) {
        return
      }

      if (isOpenLike(question.type)) {
        this.showOpenAnswers(question)
      } else {
        this.showResults(question)
      }
    } finally {
      this.acceptingAnswers = false
      this.questionInProgress = false
    }
  }

  private showOpenAnswers(question: Question): void {
    this.pendingOpenQuestion = question

    if (
      isOpenLike(question.type) &&
      this.pendingOpenCorrectAnswers.length === 0 &&
      "correctAnswers" in question
    ) {
      this.pendingOpenCorrectAnswers = [...question.correctAnswers]
    }

    const answers = buildOpenAnswersList(
      this.playersAnswers,
      this.opts.players.getAll(),
      this.pendingOpenCorrectAnswers,
    )

    const baseData = {
      question: question.question,
      answers,
      totalPlayers: this.opts.players.count(),
    }

    this.opts.broadcast(STATUS.SHOW_OPEN_ANSWERS, baseData)

    const originalCorrectAnswers =
      isOpenLike(question.type) && "correctAnswers" in question
        ? question.correctAnswers
        : []

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_OPEN_ANSWERS, {
      ...baseData,
      correctAnswers: this.pendingOpenCorrectAnswers,
      originalCorrectAnswers,
    })
  }

  validateOpenAnswer(text: string): void {
    if (!this.pendingOpenQuestion) {
      return
    }

    const normalized = text.trim().toLowerCase()
    const alreadyCorrect = this.pendingOpenCorrectAnswers.some(
      (ca) => ca.trim().toLowerCase() === normalized,
    )

    if (alreadyCorrect) {
      return
    }

    this.pendingOpenCorrectAnswers.push(text.trim())
    this.showOpenAnswers(this.pendingOpenQuestion)
  }

  invalidateOpenAnswer(text: string): void {
    if (!this.pendingOpenQuestion) {
      return
    }

    const normalized = text.trim().toLowerCase()

    // Les réponses d'origine du quiz sont verrouillées — on ne peut pas les désélectionner
    if (isOpenLike(this.pendingOpenQuestion.type) && "correctAnswers" in this.pendingOpenQuestion) {
      const isOrigin = this.pendingOpenQuestion.correctAnswers.some(
        (ca) => ca.trim().toLowerCase() === normalized,
      )

      if (isOrigin) {
        return
      }
    }

    const before = this.pendingOpenCorrectAnswers.length
    this.pendingOpenCorrectAnswers = this.pendingOpenCorrectAnswers.filter(
      (ca) => ca.trim().toLowerCase() !== normalized,
    )

    // Re-broadcaster uniquement si un élément a été retiré
    if (this.pendingOpenCorrectAnswers.length < before) {
      this.showOpenAnswers(this.pendingOpenQuestion)
    }
  }

  finalizeOpenAnswers(): void {
    if (!this.pendingOpenQuestion || !isOpenLike(this.pendingOpenQuestion.type)) {
      return
    }

    const question = {
      ...this.pendingOpenQuestion,
      correctAnswers: this.pendingOpenCorrectAnswers,
    }

    this.pendingOpenQuestion = null
    this.pendingOpenCorrectAnswers = []
    this.showResults(question)
  }

  private showResults(question: Question): void {
    const currentPlayers = this.opts.players.getAll()

    const oldLeaderboard = (() => {
      if (this.leaderboard.length === 0) {
        return currentPlayers.map((p) => ({ ...p }))
      }

      return this.leaderboard.map((p) => ({ ...p }))
    })()

    const totalType = this.playersAnswers.reduce(
      (acc: Record<number, number>, answer) => {
        const key = answer.answerId ?? -1
        acc[key] = (acc[key] || 0) + 1

        return acc
      },
      {},
    )

    const sortedPlayers = currentPlayers
      .map((player) => {
        const playerAnswer = this.playersAnswers.find(
          (a) => a.playerId === player.id,
        )

        const isCorrect = playerAnswer
          ? checkAnswer(question, playerAnswer)
          : false

        let points =
          playerAnswer && isCorrect ? Math.round(playerAnswer.points) : 0

        if (
          question.type === "drop_pin" &&
          playerAnswer &&
          isCorrect &&
          playerAnswer.textAnswer
        ) {
          const parts = playerAnswer.textAnswer.split(":")
          const px = parseFloat(parts[0])
          const py = parseFloat(parts[1])
          const correctZones = question.zones?.filter((z) => z.isCorrect) || []

          if (correctZones.length > 0 && !isNaN(px) && !isNaN(py)) {
            // Trouver la distance à la zone correcte la plus proche
            const distances = correctZones.map((z) =>
              Math.sqrt((px - z.x) ** 2 + (py - z.y) ** 2),
            )
            const minDistance = Math.min(...distances)

            // On utilise le même seuil que dans checkAnswer (20%)
            const threshold = 20

            // Accuracy scales linearly from 1.0 (exact) to 0.1 (at threshold)
            // If distance is very small (inside the 5x5 visual zone), we keep it near 1.0
            const accuracy = Math.max(0.1, 1 - minDistance / threshold)

            points = Math.round(playerAnswer.points * accuracy)
            points = Math.max(1, points)
          } else {
            points = 1
          }

          playerAnswer.points = points
        }

        points = this.opts.powerUpManager?.applyPointModifiers(player.id, points, isCorrect) ?? points

        player.points += points
        player.streak = isCorrect ? player.streak + 1 : 0

        // Boutique : on gagne des pièces proportionnelles aux points de la manche.
        if (this.opts.powerUpManager && points > 0) {
          player.goldCoins =
            (player.goldCoins ?? 0) + Math.round(points * SHOP.COIN_RATE)
        }

        return { ...player, lastCorrect: isCorrect, lastPoints: points }
      })
      .sort((a, b) => b.points - a.points)

    this.opts.players.replace(sortedPlayers)

    sortedPlayers.forEach((player, index) => {
      const rank = index + 1
      const aheadPlayer = sortedPlayers[index - 1]

      this.opts.send(player.id, STATUS.SHOW_RESULT, {
        correct: player.lastCorrect,
        message: player.lastCorrect ? "game:correct" : "game:wrong",
        points: player.lastPoints,
        myPoints: player.points,
        rank,
        aheadOfMe: aheadPlayer ? aheadPlayer.username : null,
      })
    })

    const responsesBase = {
      question: question.question,
      type: question.type,
      responses: totalType,
      media: question.media,
      background: question.background,
      backgroundOpacity: question.backgroundOpacity,
      elements: question.elements,
      audio: question.audio,
      answerReveal: question.answerReveal,
    }

    const responsesExtra = (() => {
      switch (question.type) {
        case "mcq":
          return { solutions: question.solutions, answers: question.answers }

        case "true_false":
          return { solutions: [question.solution] }

        case "open":
          return { correctAnswers: question.correctAnswers }

        case "image_sequence":
          return { correctAnswers: question.correctAnswers }

        case "date":
          return { correctYear: question.correctYear }

        case "slider":
          return {
            correctValue: question.correctValue,
            min: question.min,
            max: question.max,
          }

        case "puzzle":
          return { items: question.items }

        case "drop_pin":
          return { pinImage: question.pinImage, zones: question.zones }

        default:
          return {}
      }
    })()

    this.questionsHistory.push({
      ...question,
      playerAnswers: currentPlayers.map((player) => {
        const ans = this.playersAnswers.find((a) => a.playerId === player.id)

        return {
          playerName: player.username,
          answerId: ans?.answerId ?? null,
          textAnswer: ans?.textAnswer ?? null,
          numberAnswer: ans?.numberAnswer ?? null,
          orderAnswer: ans?.orderAnswer ?? null,
          points: ans?.points ?? 0,
        }
      }),
    })

    this.leaderboard = sortedPlayers
    this.tempOldLeaderboard = oldLeaderboard
    this.playersAnswers = []

    // Boutique : on ne distribue plus de power-ups par combo — on notifie chaque
    // joueur de son nouveau solde de pièces (crédité ci-dessus au scoring).
    if (this.opts.powerUpManager && this.opts.onCoinsEarned) {
      for (const player of sortedPlayers) {
        this.opts.onCoinsEarned(player.id, player.goldCoins ?? 0)
      }
    }

    // Les questions ouvertes sautent normalement l'écran SHOW_RESPONSES
    // (redondant avec la validation des réponses). On le réintroduit UNIQUEMENT
    // s'il y a une carte « réponse » à présenter (image / texte / YouTube),
    // sinon cette carte ne s'afficherait nulle part pour les questions ouvertes.
    const reveal = question.answerReveal
    const hasRevealCard = Boolean(
      reveal?.enabled && (reveal.image || reveal.videoId || reveal.text),
    )

    if (isOpenLike(question.type) && !hasRevealCard) {
      this.showLeaderboard()
    } else {
      this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
        ...responsesBase,
        ...responsesExtra,
      })
    }
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
    // Fenêtre de réponse fermée (avant le départ ou après expiration du temps) :
    // on ignore toute réponse tardive plutôt que de la comptabiliser au round.
    if (!this.acceptingAnswers) {
      return "closed"
    }

    const player = this.opts.players.findById(socket.id)
    const question = this.opts.quizz.questions[this.currentQuestion]

    if (!player) {
      return "no_player"
    }

    // Idempotence : un renvoi de la même réponse (retry réseau côté client) ne
    // doit pas être recompté, mais doit confirmer le succès au client pour qu'il
    // arrête de réessayer.
    if (this.playersAnswers.find((a) => a.playerId === socket.id)) {
      return "duplicate"
    }

    // Le gel bloque la saisie 3 s côté client : la pénalité de vitesse émerge
    // naturellement du temps réel écoulé. On consomme juste l'effet (nettoyage)
    // — plus de malus serveur `startTime - 3000` qui doublait la peine.
    this.opts.powerUpManager?.consumeFrozen(player.id)
    // Clear scrambled state upon answering
    this.opts.powerUpManager?.consumeScrambled(player.id)

    this.playersAnswers.push({
      playerId: player.id,
      answerId: payload.answerId,
      textAnswer: payload.textAnswer,
      numberAnswer: payload.numberAnswer,
      orderAnswer: payload.orderAnswer,
      points: timeToPoint(this.startTime, question.time),
    })

    this.opts.send(socket.id, STATUS.WAIT, {
      text: "game:waitingForAnswers",
    })

    socket
      .to(this.opts.gameId)
      .emit(EVENTS.GAME.PLAYER_ANSWER, this.playersAnswers.length)
    this.opts.players.broadcastCount()

    // On compare au nombre de joueurs CONNECTÉS : un joueur déconnecté pendant
    // la partie reste dans la liste (pour reconnexion) mais ne répondra jamais,
    // sinon la manche ne se termine jamais en avance et tourne le timer complet.
    if (this.playersAnswers.length >= this.opts.players.countConnected()) {
      this.opts.cooldown.abort()
    }

    return "ok"
  }

  /**
   * Réassocie une réponse déjà soumise au nouveau socket id d'un joueur qui se
   * reconnecte. Les réponses sont indexées par `playerId` = id du socket au
   * moment de la réponse ; or `PlayerManager.updateSocketId` fait muter
   * `player.id` lors d'une reconnexion. Sans ce remap, la réponse reste
   * orpheline et le joueur n'est pas crédité au scoring (`showResults` ne
   * retrouve plus sa réponse → 0 point). Le cas est surtout visible sur les
   * questions ouvertes : la fenêtre de repêchage laisse largement le temps à un
   * client mobile de se reconnecter avant la finalisation.
   */
  remapPlayerAnswer(oldId: string, newId: string): void {
    if (oldId === newId) {
      return
    }

    for (const answer of this.playersAnswers) {
      if (answer.playerId === oldId) {
        answer.playerId = newId
      }
    }
  }

  nextQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (!socket.rooms.has(`manager-${this.opts.gameId}`)) {
      return
    }

    // Filet anti-double-avancement : si une question est déjà en cours de
    // préparation/diffusion, on ignore tout nouveau « suivant » concurrent
    // (écran principal + télécommande) qui ferait sauter une question.
    if (this.questionInProgress) {
      return
    }

    if (!this.opts.quizz.questions[this.currentQuestion + 1]) {
      return
    }

    this.currentQuestion += 1
    void this.newQuestion()
  }

  abortQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (!socket.rooms.has(`manager-${this.opts.gameId}`)) {
      return
    }

    this.opts.cooldown.abort()
  }

  showLeaderboard(): void {
    const question = this.opts.quizz.questions[this.currentQuestion]
    const isLastRound =
      this.currentQuestion + 1 === this.opts.quizz.questions.length

    if (isLastRound) {
      this.started = false

      const top = this.leaderboard.slice(0, 3)
      const gameResult = {
        id: `${Date.now()}-${nanoid(8)}`,
        subject: this.opts.quizz.subject,
        date: new Date().toISOString(),
        players: this.leaderboard.map((player, index) => ({
          username: player.username,
          avatar: player.avatar,
          points: player.points,
          rank: index + 1,
        })),
        questions: this.questionsHistory,
      }

      // Mode soirée : déléguer sans émettre STATUS.FINISHED
      if (this.opts.onEveningQuizFinished) {
        this.opts.onEveningQuizFinished(gameResult, this.leaderboard)

        return
      }

      this.opts.onGameFinished(gameResult)

      this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top,
        totalPlayers: this.leaderboard.length,
      })

      this.leaderboard.forEach((player, index) => {
        this.opts.send(player.id, STATUS.FINISHED, {
          subject: this.opts.quizz.subject,
          top,
          rank: index + 1,
          totalPlayers: this.leaderboard.length,
        })
      })

      return
    }

    // Si showLeaderboard n'est pas activé sur cette question, on passe directement
    if (!question?.showLeaderboard) {
      this.tempOldLeaderboard = null
      this.currentQuestion += 1
      void this.newQuestion()

      return
    }

    const oldLeaderboard = this.tempOldLeaderboard ?? this.leaderboard

    const roundLeaderboard = [...this.leaderboard]
      .map((player) => {
        const oldPlayer = oldLeaderboard.find((p) => p.id === player.id)
        const roundPoints = player.points - (oldPlayer?.points ?? 0)

        return { ...player, roundPoints }
      })
      .sort((a, b) => b.roundPoints - a.roundPoints)

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_LEADERBOARD, {
      oldLeaderboard: oldLeaderboard.slice(0, 5),
      leaderboard: this.leaderboard.slice(0, 5),
      roundLeaderboard: roundLeaderboard.slice(0, 5),
      totalPlayers: this.leaderboard.length,
      background: question?.background,
      backgroundOpacity: question?.backgroundOpacity,
      elements: question?.elements,
    })

    this.tempOldLeaderboard = null
  }

  private static getQuestionSolutionData(question: Question) {
    switch (question.type) {
      case "mcq":
        return { solutions: question.solutions }

      case "true_false":
        return { solutions: [question.solution] }

      case "open":
        return { correctAnswers: question.correctAnswers }

      case "image_sequence":
        return { correctAnswers: question.correctAnswers }

      case "date":
        return { correctYear: question.correctYear }

      case "slider":
        return { correctValue: question.correctValue }

      case "puzzle":
        return { items: question.items }

      case "drop_pin":
        return { zones: question.zones }

      default:
        return {}
    }
  }
}
