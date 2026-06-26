import { EVENTS } from "@rahoot/common/constants"
import type {
  GameResult,
  GameUpdateQuestion,
  Player,
  Quizz,
  QuizzWithId,
  Question,
} from "@rahoot/common/types/game"
import type { Status, StatusDataMap } from "@rahoot/common/types/game/status"
import type { PowerUp, PowerUpEffect, PowerUpType } from "@rahoot/common/types/powerup"
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
    status: { name: Status; data: StatusDataMap[Status] }
    players: Player[]
    currentQuestion: GameUpdateQuestion
    timer?: number
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
  [EVENTS.QUIZZ.SAVE_SUCCESS]: (_data: { id: string }) => void
  [EVENTS.QUIZZ.UPDATE_SUCCESS]: (_data: { id: string }) => void
  [EVENTS.QUIZZ.ERROR]: (_message: string) => void
  [EVENTS.QUIZZ.AI_GENERATE_SUCCESS]: (_data: { questions: Question[] }) => void

  // Results events
  [EVENTS.RESULTS.DATA]: (_result: GameResult) => void

  // Evening events
  [EVENTS.EVENING.QUIZ_COMPLETE]: (_data: {
    quizIndex: number
    totalQuizzes: number
    subject: string
    leaderboard: { id: string; username: string; avatar?: string; points: number; rank: number }[]
  }) => void
  [EVENTS.EVENING.COMPLETE]: (_data: {
    leaderboard: { id: string; username: string; avatar?: string; points: number; rank: number }[]
  }) => void

  // Power-up events
  [EVENTS.POWER_UP.EARNED]: (_powerUp: PowerUp) => void
  [EVENTS.POWER_UP.EFFECT]: (_effect: PowerUpEffect) => void
  [EVENTS.POWER_UP.BLOCKED]: (_data: { powerUpType: PowerUpType; defenderId: string }) => void
  [EVENTS.POWER_UP.INVENTORY]: (_powerUps: PowerUp[]) => void
}

export interface ClientToServerEvents {
  // Manager actions
  [EVENTS.GAME.CREATE]: (
    _payload: string | { quizId: string; powerUpsEnabled?: boolean },
  ) => void
  [EVENTS.MANAGER.AUTH]: (_password: string) => void
  [EVENTS.MANAGER.RECONNECT]: (_message: { gameId: string }) => void
  [EVENTS.MANAGER.KICK_PLAYER]: (_message: {
    gameId: string
    playerId: string
  }) => void
  [EVENTS.MANAGER.START_GAME]: (_message: MessageGameId) => void
  [EVENTS.MANAGER.START_DEMO]: (_message: MessageGameId) => void
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

  // Quizz actions
  [EVENTS.QUIZZ.GET]: (_id: string) => void
  [EVENTS.QUIZZ.SAVE]: (_quizz: Quizz) => void
  [EVENTS.QUIZZ.UPDATE]: (_data: QuizzWithId) => void
  [EVENTS.QUIZZ.DELETE]: (_id: string) => void
  [EVENTS.QUIZZ.MOVE_FOLDER]: (_data: {
    id: string
    folder: string | null
  }) => void
  [EVENTS.QUIZZ.AI_GENERATE]: (
    _data: {
      prompt: string
      count: number
      questionTypes: string[]
      level: string
    },
  ) => void

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

  // Manager actions supplémentaires
  [EVENTS.MANAGER.GET_LOGS]: (_message: { gameId: string }) => void
  [EVENTS.MANAGER.END_GAME]: (_message: { gameId: string }) => void

  // Results actions
  [EVENTS.RESULTS.GET]: (_id: string) => void
  [EVENTS.RESULTS.DELETE]: (_id: string) => void

  // Evening actions
  [EVENTS.EVENING.START]: (_data: { quizIds: string[]; powerUpsEnabled?: boolean }) => void
  [EVENTS.EVENING.NEXT]: (_data: { gameId: string }) => void

  // Power-up actions
  [EVENTS.POWER_UP.USE]: (_data: { gameId: string; powerUpId: string; targetIds?: string[] }) => void
  [EVENTS.POWER_UP.GET_INVENTORY]: () => void

  // Common
  disconnect: () => void
}
