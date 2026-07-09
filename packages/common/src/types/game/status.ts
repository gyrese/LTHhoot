import type {
  AnswerReveal,
  Award,
  DropPinZone,
  Player,
  PodiumThemeId,
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
  SHOW_OPEN_ANSWERS: "SHOW_OPEN_ANSWERS",
  SHOW_LEADERBOARD: "SHOW_LEADERBOARD",
  FINISHED: "FINISHED",
  WAIT: "WAIT",
  PAUSED: "PAUSED",
  SHOW_TIE_BREAK: "SHOW_TIE_BREAK",
  SHOW_TIE_BREAK_SPECTATE: "SHOW_TIE_BREAK_SPECTATE",
  SHOW_TIE_BREAK_RESULT: "SHOW_TIE_BREAK_RESULT",
} as const

export type Status = (typeof STATUS)[keyof typeof STATUS]

export type CommonStatusDataMap = {
  SHOW_START: { time: number; subject: string }
  SHOW_PREPARED: {
    totalAnswers: number
    questionNumber: number
    type: QuestionType
  }
  SHOW_QUESTION: {
    question: string
    type: QuestionType
    media?: QuestionMedia
    background?: SlideBackground
    backgroundOpacity?: number
    elements?: SlideElement[]
    audio?: string
    cooldown: number
    pinImage?: string
    revelationEnabled?: boolean
    revealDuration?: number
    gridCols?: number
    gridRows?: number
    revelationStyle?: string
    images?: string[]
    imageInterval?: number
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
    isFrozen?: boolean
    isScrambled?: boolean
    revelationEnabled?: boolean
    revealDuration?: number
    gridCols?: number
    gridRows?: number
    revelationStyle?: string
    images?: string[]
    imageInterval?: number
  }
  SHOW_RESULT: {
    correct: boolean
    message: string
    points: number
    myPoints: number
    rank: number
    aheadOfMe: string | null
    streak: number
  }
  SHOW_OPEN_ANSWERS: {
    question: string
    answers: Array<{ text: string; playerName: string; isCorrect: boolean }>
    totalPlayers: number
    correctAnswers?: string[]
    originalCorrectAnswers?: string[]
  }
  WAIT: { text: string }
  FINISHED: {
    subject: string
    top: Player[]
    rank?: number
    totalPlayers?: number
    awards?: Award[]
    // Thème visuel du podium, résolu côté serveur (jamais "random").
    podiumTheme?: PodiumThemeId
    // Image de couverture du quiz — fond du podium "neutre".
    coverImage?: string
  }
  PAUSED: { text: string }
  SHOW_TIE_BREAK: { statement: string; opponents: string[] }
  SHOW_TIE_BREAK_SPECTATE: { duelPlayerNames: string[] }
  SHOW_TIE_BREAK_RESULT: { winnerName: string | null }
}

type ManagerExtraStatus = {
  SHOW_ROOM: { text: string; inviteCode?: string; salonImage?: string }
  SHOW_QUESTION: {
    solutions?: number[]
    correctYear?: number
    correctValue?: number
    correctAnswers?: string[]
    items?: string[]
    zones?: DropPinZone[]
  }
  SELECT_ANSWER: {
    solutions?: number[]
    correctYear?: number
    correctValue?: number
    correctAnswers?: string[]
    items?: string[]
    zones?: DropPinZone[]
  }
  SHOW_RESPONSES: {
    question: string
    type: QuestionType
    responses: Record<number, number>
    correctCount: number
    totalAnswered: number
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
    background?: SlideBackground
    backgroundOpacity?: number
    elements?: SlideElement[]
    audio?: string
    answerReveal?: AnswerReveal
  }
  SHOW_LEADERBOARD: {
    oldLeaderboard: Player[]
    leaderboard: Player[]
    roundLeaderboard: (Player & { roundPoints: number })[]
    totalPlayers: number
    background?: SlideBackground
    backgroundOpacity?: number
    elements?: SlideElement[]
  }
}

export type PlayerStatusDataMap = CommonStatusDataMap
export type ManagerStatusDataMap = CommonStatusDataMap & ManagerExtraStatus
export type StatusDataMap = PlayerStatusDataMap & ManagerStatusDataMap
