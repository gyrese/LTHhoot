import { EVENTS } from "@rahoot/common/constants"
import type {
  Answer,
  GameResult,
  Player,
  Question,
  QuestionResult,
  Quizz,
} from "@rahoot/common/types/game"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import {
  type Status,
  STATUS,
  type StatusDataMap,
} from "@rahoot/common/types/game/status"
import { CooldownTimer } from "@rahoot/socket/services/game/cooldown-timer"
import { PlayerManager } from "@rahoot/socket/services/game/player-manager"
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
}

export class RoundManager {
  private readonly opts: RoundManagerOptions
  private started = false
  private questionInProgress = false
  private currentQuestion = 0
  private playersAnswers: Answer[] = []
  private startTime = 0
  private leaderboard: Player[] = []
  private tempOldLeaderboard: Player[] | null = null
  private questionsHistory: QuestionResult[] = []

  constructor(opts: RoundManagerOptions) {
    this.opts = opts
  }

  isStarted(): boolean {
    return this.started
  }

  private getNonTitleCount() {
    const total = this.opts.quizz.questions.filter((q) => q.type !== "title").length
    const current = this.opts.quizz.questions
      .slice(0, this.currentQuestion + 1)
      .filter((q) => q.type !== "title").length

    return { current, total }
  }

  getReconnectInfo() {
    const { current, total } = this.getNonTitleCount()

    return { current, total }
  }

  async start(socket: Socket): Promise<void> {
    if (this.opts.getManagerId() !== socket.id) {
      return
    }

    if (this.started) {
      return
    }

    if (this.opts.players.count() === 0) {
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
    if (this.questionInProgress) {return}

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
          pinImage: question.type === "drop_pin" ? question.pinImage : undefined,
        })

        await sleep(question.cooldown)

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
          setTimeout(() => { void this.newQuestion() }, 0)
        }

        return
      }

      const { current: questionNumber, total: questionTotal } = this.getNonTitleCount()

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

      await sleep(4)

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
      })

      await sleep(question.cooldown)

      if (!this.started) {
        return
      }

      this.startTime = Date.now()

      const selectAnswerBase = {
        question: question.question,
        type: question.type,
        media: question.media,
        background: question.background,
        backgroundOpacity: question.backgroundOpacity,
        elements: question.elements,
        audio: question.audio,
        time: question.time,
        totalPlayer: this.opts.players.count(),
      }

      const selectAnswerExtra = (() => {
        switch (question.type) {
          case "mcq":
            return { answers: question.answers }

          case "true_false":
            return {}

          case "open":
            return {}

          case "date":
            return { minYear: question.minYear, maxYear: question.maxYear }

          case "slider":
            return { min: question.min, max: question.max }

          case "puzzle":
            return { items: question.items }

          case "drop_pin":
            return { pinImage: question.pinImage }

          default:
            return {}
        }
      })()

      this.opts.broadcast(STATUS.SELECT_ANSWER, {
        ...selectAnswerBase,
        ...selectAnswerExtra,
      })

      await this.opts.cooldown.start(question.time)

      if (!this.started) {
        return
      }

      this.showResults(question)
    } finally {
      this.questionInProgress = false
    }
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

        if (question.type === "drop_pin" && playerAnswer && isCorrect && playerAnswer.textAnswer) {
          const parts = playerAnswer.textAnswer.split(":")
          const px = parseFloat(parts[0])
          const py = parseFloat(parts[1])
          const z = question.zones?.[0]

          if (z && !isNaN(px) && !isNaN(py)) {
            const distance = Math.sqrt(Math.pow(px - z.x, 2) + Math.pow(py - z.y, 2))
            const maxDistance = 141.42 // Diagonal of 100x100 square
            
            // Accuracy scales from 0.1 (farthest) to 1.0 (exact match)
            const accuracy = Math.max(0.1, 1 - (distance / maxDistance))
            points = Math.round(playerAnswer.points * accuracy)
            points = Math.max(1, points) // Minimum 1 point just for answering
          } else {
            points = 1
          }
          playerAnswer.points = points // Update answer record with final points
        }

        player.points += points
        player.streak = isCorrect ? player.streak + 1 : 0

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
    }

    const responsesExtra = (() => {
      switch (question.type) {
        case "mcq":
          return { solutions: question.solutions, answers: question.answers }

        case "true_false":
          return { solutions: [question.solution] }

        case "open":
          return { correctAnswers: question.correctAnswers }

        case "date":
          return { correctYear: question.correctYear }

        case "slider":
          return { correctValue: question.correctValue, min: question.min, max: question.max }

        case "puzzle":
          return { items: question.items }

        case "drop_pin":
          return { pinImage: question.pinImage, zones: question.zones }

        default:
          return {}
      }
    })()

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
      ...responsesBase,
      ...responsesExtra,
    })

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
  }

  selectAnswer(
    socket: Socket,
    payload: {
      answerId?: number
      textAnswer?: string
      numberAnswer?: number
      orderAnswer?: number[]
    },
  ): void {
    const player = this.opts.players.findById(socket.id)
    const question = this.opts.quizz.questions[this.currentQuestion]

    if (!player) {
      return
    }

    if (this.playersAnswers.find((a) => a.playerId === socket.id)) {
      return
    }

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

    if (this.playersAnswers.length === this.opts.players.count()) {
      this.opts.cooldown.abort()
    }
  }

  nextQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
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

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    this.opts.cooldown.abort()
  }

  showLeaderboard(): void {
    const isLastRound =
      this.currentQuestion + 1 === this.opts.quizz.questions.length

    if (isLastRound) {
      this.started = false

      const top = this.leaderboard.slice(0, 3)

      this.opts.onGameFinished({
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
      })

      this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top,
      })

      this.leaderboard.forEach((player, index) => {
        this.opts.send(player.id, STATUS.FINISHED, {
          subject: this.opts.quizz.subject,
          top,
          rank: index + 1,
        })
      })

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
    })

    this.tempOldLeaderboard = null
  }
}
