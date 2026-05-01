import type {
  DropPinZone,
  Player,
  QuestionMedia,
  QuestionType,
  SlideBackground,
  SlideElement,
} from "@rahoot/common/types/game"

export const STATUS = {
  SHOW_ROOM: "SHOW_ROOM",
  SHOW_START: "SHOW_START",
  SHOW_PREPARED: "SHOW_PREPARED",
  SHOW_QUESTION: "SHOW_QUESTION",
  SELECT_ANSWER: "SELECT_ANSWER",
  SHOW_RESULT: "SHOW_RESULT",
  SHOW_RESPONSES: "SHOW_RESPONSES",
  SHOW_LEADERBOARD: "SHOW_LEADERBOARD",
  FINISHED: "FINISHED",
  WAIT: "WAIT",
} as const

export type Status = (typeof STATUS)[keyof typeof STATUS]

export type CommonStatusDataMap = {
  SHOW_START: { time: number; subject: string }
  SHOW_PREPARED: { totalAnswers: number; questionNumber: number; type: QuestionType }
  SHOW_QUESTION: {
    question: string
    type: QuestionType
    media?: QuestionMedia
    background?: SlideBackground
    backgroundOpacity?: number
    elements?: SlideElement[]
    audio?: string
    cooldown: number
  }
  SELECT_ANSWER: {
    question: string
    type: QuestionType
    answers?: string[]
    media?: QuestionMedia
    background?: SlideBackground
    backgroundOpacity?: number
    elements?: SlideElement[]
    audio?: string
    time: number
    totalPlayer: number
    min?: number
    max?: number
    minYear?: number
    maxYear?: number
    items?: string[]
    pinImage?: string
  }
  SHOW_RESULT: {
    correct: boolean
    message: string
    points: number
    myPoints: number
    rank: number
    aheadOfMe: string | null
  }
  WAIT: { text: string }
  FINISHED: { subject: string; top: Player[]; rank?: number }
}

type ManagerExtraStatus = {
  SHOW_ROOM: { text: string; inviteCode?: string; salonImage?: string }
  SHOW_RESPONSES: {
    question: string
    type: QuestionType
    responses: Record<number, number>
    solutions?: number[]
    correctAnswers?: string[]
    correctYear?: number
    correctValue?: number
    min?: number
    max?: number
    answers?: string[]
    media?: QuestionMedia
    items?: string[]
    pinImage?: string
    zones?: DropPinZone[]
  }
  SHOW_LEADERBOARD: { oldLeaderboard: Player[]; leaderboard: Player[] }
}

export type PlayerStatusDataMap = CommonStatusDataMap
export type ManagerStatusDataMap = CommonStatusDataMap & ManagerExtraStatus
export type StatusDataMap = PlayerStatusDataMap & ManagerStatusDataMap
