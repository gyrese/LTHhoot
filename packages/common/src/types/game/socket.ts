import { EVENTS } from "@rahoot/common/constants"
import type {
  GameResult,
  GameUpdateQuestion,
  Player,
  Quizz,
  QuizzWithId,
  Question,
  QuestionDifficulty,
} from "@rahoot/common/types/game"
import type { Status, StatusDataMap } from "@rahoot/common/types/game/status"
import type {
  PowerUp,
  PowerUpEffect,
  PowerUpType,
} from "@rahoot/common/types/powerup"
import type { RoundEventType } from "@rahoot/common/types/round-event"
import type { ManagerConfig } from "@rahoot/common/types/manager"
import { Server as ServerIO, Socket as SocketIO } from "socket.io"

export type Server = ServerIO<ClientToServerEvents, ServerToClientEvents>
export type Socket = SocketIO<ClientToServerEvents, ServerToClientEvents>

export type Message<K extends keyof StatusDataMap = keyof StatusDataMap> = {
  gameId?: string
  status: K
  data: StatusDataMap[K]
}

export type MessageWithoutStatus<T = any> = {
  gameId?: string
  data: T
}

export type MessageGameId = {
  gameId?: string
}

// Accusé de réception d'une réponse joueur. Le serveur répond TOUJOURS l'un de
// ces statuts pour que le client sache si sa réponse est réellement arrivée :
//  - ok        : réponse acceptée et comptabilisée
//  - duplicate : déjà reçue (renvoi après retry) → succès idempotent
//  - closed    : fenêtre de réponse fermée (trop tard / pas encore ouverte)
//  - no_player : socket non rattaché à un joueur de la partie
//  - not_found : partie introuvable (expirée / supprimée)
export type AnswerAckStatus =
  | "ok"
  | "duplicate"
  | "closed"
  | "no_player"
  | "not_found"
export type AnswerAck = { status: AnswerAckStatus }

// Accusé de réception d'une réponse de duel de départage — même philosophie
// que AnswerAck : le client ne verrouille sa saisie que sur confirmation.
//  - ok        : réponse enregistrée
//  - duplicate : déjà reçue (renvoi après retry) → succès idempotent
//  - closed    : duel terminé / pas de duel en cours
//  - no_player : le socket n'est pas un duelliste de ce duel
export type TieBreakAckStatus = "ok" | "duplicate" | "closed" | "no_player"
export type TieBreakAck = { status: TieBreakAckStatus }

export interface ServerToClientEvents {
  connect: () => void

  // Game events
  [EVENTS.GAME.STATUS]: (_data: {
    name: Status
    data: StatusDataMap[Status]
  }) => void
  [EVENTS.GAME.SUCCESS_ROOM]: (_data: string) => void
  [EVENTS.GAME.SUCCESS_JOIN]: (_gameId: string) => void
  [EVENTS.GAME.TOTAL_PLAYERS]: (_count: number) => void
  [EVENTS.GAME.ERROR_MESSAGE]: (_message: string) => void
  [EVENTS.GAME.START_COOLDOWN]: () => void
  [EVENTS.GAME.COOLDOWN]: (_count: number) => void
  [EVENTS.GAME.RESET]: (_message: string) => void
  [EVENTS.GAME.UPDATE_QUESTION]: (_data: {
    current: number
    total: number
  }) => void
  [EVENTS.GAME.PLAYER_ANSWER]: (_count: number) => void
  [EVENTS.GAME.NEW_PLAYER]: (_player: {
    id: string
    username: string
    avatar?: string
  }) => void
  [EVENTS.GAME.REMOVE_PLAYER]: (_playerId: string) => void

  // Player events
  [EVENTS.PLAYER.SUCCESS_RECONNECT]: (_data: {
    gameId: string
    status: { name: Status; data: StatusDataMap[Status] }
    player: { username: string; points: number; avatar?: string }
    currentQuestion: GameUpdateQuestion
    timer?: number
    players?: { id: string; username: string; avatar?: string }[]
  }) => void
  [EVENTS.PLAYER.UPDATE_LEADERBOARD]: (_data: { leaderboard: Player[] }) => void

  // Manager events
  [EVENTS.MANAGER.SUCCESS_RECONNECT]: (_data: {
    gameId: string
    inviteCode?: string
    status: { name: Status; data: StatusDataMap[Status] }
    players: Player[]
    currentQuestion: GameUpdateQuestion
    timer?: number
    armedRoundEvent?: RoundEventType | null
    isEveningMode?: boolean
  }) => void
  [EVENTS.MANAGER.ROUND_EVENT_ARMED]: (_data: {
    eventType: RoundEventType | null
  }) => void
  [EVENTS.MANAGER.CONFIG]: (_config: ManagerConfig) => void
  [EVENTS.QUIZZ.DATA]: (_quizz: QuizzWithId) => void
  [EVENTS.MANAGER.GAME_CREATED]: (_data: {
    gameId: string
    inviteCode: string
    salonImage?: string
  }) => void
  [EVENTS.MANAGER.STATUS_UPDATE]: (_data: {
    status: Status
    data: StatusDataMap[Status]
  }) => void
  [EVENTS.MANAGER.NEW_PLAYER]: (_player: Player) => void
  [EVENTS.MANAGER.REMOVE_PLAYER]: (_playerId: string) => void
  [EVENTS.MANAGER.ERROR_MESSAGE]: (_message: string) => void
  [EVENTS.MANAGER.PLAYER_KICKED]: (_playerId: string) => void
  [EVENTS.MANAGER.UNAUTHORIZED]: () => void
  [EVENTS.MANAGER.LOG_ENTRY]: (_entry: {
    id: string
    timestamp: number
    level: "info" | "warn" | "error"
    message: string
  }) => void

  // Quizz events
  [EVENTS.QUIZZ.SAVE_SUCCESS]: (_data: {
    id: string
    updatedAt: number
  }) => void
  [EVENTS.QUIZZ.UPDATE_SUCCESS]: (_data: {
    id: string
    updatedAt: number
  }) => void
  [EVENTS.QUIZZ.ERROR]: (_message: string) => void
  [EVENTS.QUIZZ.AI_ERROR]: (_message: string) => void
  [EVENTS.QUIZZ.AI_GENERATE_SUCCESS]: (_data: {
    questions: Question[]
    // Description du quiz proposée par l'IA (vide si le modèle l'a omise).
    description: string
  }) => void
  [EVENTS.QUIZZ.AI_REPHRASE_SUCCESS]: (_data: { rephrased: string }) => void
  [EVENTS.QUIZZ.AI_SUGGEST_WRONG_ANSWERS_SUCCESS]: (_data: {
    wrongAnswers: string[]
  }) => void
  [EVENTS.QUIZZ.AI_GENERATE_EXPLANATION_SUCCESS]: (_data: {
    explanation: string
  }) => void

  // Results events
  [EVENTS.RESULTS.DATA]: (_result: GameResult) => void

  // Async quiz events
  [EVENTS.ASYNC_QUIZ.DATA]: (_quizz: any) => void
  [EVENTS.ASYNC_QUIZ.SUBMIT_SUCCESS]: (_data: {
    totalPoints: number
    rank: number
    totalPlayers: number
    correctAnswersCount: number
    totalQuestions: number
  }) => void

  // Evening events
  [EVENTS.EVENING.QUIZ_COMPLETE]: (_data: {
    quizIndex: number
    totalQuizzes: number
    subject: string
    leaderboard: {
      id: string
      username: string
      avatar?: string
      points: number
      rank: number
    }[]
  }) => void
  [EVENTS.EVENING.COMPLETE]: (_data: {
    leaderboard: {
      id: string
      username: string
      avatar?: string
      points: number
      rank: number
    }[]
  }) => void

  // Power-up events
  [EVENTS.POWER_UP.EARNED]: (_powerUp: PowerUp) => void
  [EVENTS.POWER_UP.EFFECT]: (_effect: PowerUpEffect) => void
  [EVENTS.POWER_UP.BLOCKED]: (_data: {
    powerUpType: PowerUpType
    defenderId: string
  }) => void
  [EVENTS.POWER_UP.INVENTORY]: (_powerUps: PowerUp[]) => void
  [EVENTS.POWER_UP.COINS]: (_data: {
    coins: number
    disabledPowerUps?: string[]
  }) => void
}

export interface ClientToServerEvents {
  // Manager actions
  [EVENTS.GAME.CREATE]: (
    _payload:
      | string
      | {
          quizId: string
          powerUpsEnabled?: boolean
          disabledPowerUps?: string[]
          questionIndex?: number
        },
  ) => void
  [EVENTS.MANAGER.AUTH]: (_password: string) => void
  [EVENTS.MANAGER.RECONNECT]: (_message: { gameId: string }) => void
  [EVENTS.MANAGER.KICK_PLAYER]: (_message: {
    gameId: string
    playerId: string
  }) => void
  [EVENTS.MANAGER.START_GAME]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.START_DEMO]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.ARM_ROUND_EVENT]: (_message: {
    gameId?: string
    eventType: RoundEventType | null
  }) => void
  [EVENTS.MANAGER.ABORT_QUIZ]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.NEXT_QUESTION]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.SHOW_LEADERBOARD]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.GET_CONFIG]: () => void
  [EVENTS.MANAGER.LOGOUT]: () => void
  [EVENTS.MANAGER.VALIDATE_OPEN_ANSWER]: (
    _message: MessageWithoutStatus<{ text: string }>,
  ) => void
  [EVENTS.MANAGER.INVALIDATE_OPEN_ANSWER]: (
    _message: MessageWithoutStatus<{ text: string }>,
  ) => void
  [EVENTS.MANAGER.FINALIZE_OPEN_ANSWERS]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.PAUSE_GAME]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.RESUME_GAME]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.GUEST_AUTH]: (_data: {
    name: string
    password: string
  }) => void
  [EVENTS.MANAGER.GUEST_CREATE]: (_data: {
    name: string
    password: string
  }) => void
  [EVENTS.MANAGER.GUEST_DELETE]: (_id: string) => void

  // Quizz actions
  [EVENTS.QUIZZ.GET]: (_id: string) => void
  [EVENTS.QUIZZ.SAVE]: (_quizz: Quizz) => void
  [EVENTS.QUIZZ.UPDATE]: (_data: QuizzWithId) => void
  [EVENTS.QUIZZ.DELETE]: (_id: string) => void
  [EVENTS.QUIZZ.MOVE_FOLDER]: (_data: {
    id: string
    folder: string | null
  }) => void
  [EVENTS.QUIZZ.SET_PUBLIC_NAME]: (_data: {
    id: string
    publicName: string | null
  }) => void
  [EVENTS.QUIZZ.AI_GENERATE]: (_data: {
    prompt: string
    count: number
    questionTypes: string[]
    // Plusieurs niveaux = lot mélangé, réparti équitablement par le serveur.
    difficulties: QuestionDifficulty[]
    tone: string
    // Valeur "auto" : langue déduite du sujet saisi.
    language: string
    // Valeur nulle : l'IA module la durée selon la difficulté.
    time: number | null
    // Remplit la carte réponse (answerReveal) de chaque question.
    withExplanations: boolean
    instructions?: string
  }) => void
  [EVENTS.QUIZZ.AI_REPHRASE]: (_data: { currentText: string }) => void
  [EVENTS.QUIZZ.AI_SUGGEST_WRONG_ANSWERS]: (_data: {
    correctAnswer: string
    questionContext: string
  }) => void
  [EVENTS.QUIZZ.AI_GENERATE_EXPLANATION]: (_data: {
    question: string
    solutionText?: string
    type?: string
  }) => void

  // Player actions
  [EVENTS.PLAYER.JOIN]: (_inviteCode: string) => void
  [EVENTS.PLAYER.LOGIN]: (
    _message: MessageWithoutStatus<{ username: string; avatar?: string }>,
  ) => void
  [EVENTS.PLAYER.RECONNECT]: (_message: { gameId: string }) => void
  [EVENTS.PLAYER.SELECTED_ANSWER]: (
    _message: MessageWithoutStatus<{
      answerId?: number
      textAnswer?: string
      numberAnswer?: number
      orderAnswer?: number[]
    }>,
    _ack: (_res: AnswerAck) => void,
  ) => void
  [EVENTS.PLAYER.JOIN_TEAM]: (
    _message: MessageWithoutStatus<{ teamName: string }>,
  ) => void
  [EVENTS.PLAYER.BUY_POWER_UP]: (
    _message: MessageWithoutStatus<{ powerUpType: PowerUpType }>,
    _ack: (_res: { success: boolean; error?: string }) => void,
  ) => void
  [EVENTS.PLAYER.TIE_BREAK_ANSWER]: (
    _data: { answerId: number },
    _ack: (_res: TieBreakAck) => void,
  ) => void

  // Manager actions supplémentaires
  [EVENTS.MANAGER.GET_LOGS]: (_message: { gameId: string }) => void
  [EVENTS.MANAGER.END_GAME]: (_message: { gameId: string }) => void

  // Results actions
  [EVENTS.RESULTS.GET]: (_id: string) => void
  [EVENTS.RESULTS.DELETE]: (_id: string) => void

  // Async quiz actions
  [EVENTS.ASYNC_QUIZ.GET_PUBLIC]: (_quizzId: string) => void
  [EVENTS.ASYNC_QUIZ.SUBMIT]: (_payload: {
    quizzId: string
    playerName: string
    socialContact?: string
    answers: Array<{
      questionIndex: number
      answerId?: number | null
      textAnswer?: string | null
      numberAnswer?: number | null
      timeMs?: number
    }>
  }) => void

  // Evening actions
  [EVENTS.EVENING.START]: (_data: {
    quizIds: string[]
    powerUpsEnabled?: boolean
    disabledPowerUps?: string[]
  }) => void
  [EVENTS.EVENING.NEXT]: (_data: { gameId: string }) => void

  // Power-up actions
  [EVENTS.POWER_UP.USE]: (_data: {
    gameId: string
    powerUpId: string
    targetIds?: string[]
  }) => void
  [EVENTS.POWER_UP.GET_INVENTORY]: () => void

  // Sonde de vivacité (watchdog client au retour de premier plan) : le serveur
  // acquitte immédiatement, sans réponse dans le timeout le client recycle sa
  // connexion au lieu d'attendre le ping timeout Engine.IO.
  [EVENTS.CONNECTION.PING]: (_ack: () => void) => void

  // Common
  disconnect: () => void
}
