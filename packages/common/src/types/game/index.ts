import type { MEDIA_TYPES } from "@rahoot/common/constants"

export type Player = {
  id: string
  clientId: string
  connected: boolean
  username: string
  points: number
  streak: number
}

export type Answer = {
  playerId: string
  answerId?: number
  textAnswer?: string
  numberAnswer?: number
  orderAnswer?: number[]
  points: number
}

export type QuestionMediaType =
  | (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES]
  | undefined

export type QuestionMedia = {
  type?: QuestionMediaType
  url: string
}

// ─── Éléments du canvas slide ────────────────────────────────────────────────

type SlideElementBase = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

export type TextElement = SlideElementBase & {
  type: "text"
  text: string
  fontSize: number
  fontFamily: string
  fontStyle: string
  textDecoration: string
  fill: string
  align: "left" | "center" | "right"
}

export type ShapeElement = SlideElementBase & {
  type: "shape"
  shapeType: "rect" | "circle" | "triangle" | "star"
  fill: string
  cornerRadius?: number
}

export type ImageElement = SlideElementBase & {
  type: "image"
  url: string
}

export type YoutubeElement = SlideElementBase & {
  type: "youtube"
  videoId: string
  autoplay: boolean
  mute: boolean
  loop: boolean
  controls: boolean
  startTime: number
  endTime: number
}

export type SlideElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | YoutubeElement

export type SlideBackground = {
  type: "color" | "image"
  value: string
}

// ─── Types de questions ───────────────────────────────────────────────────────

export type QuestionType = "mcq" | "true_false" | "open" | "date" | "slider" | "puzzle" | "drop_pin" | "title"

type BaseQuestion = {
  question: string
  type: QuestionType
  media?: QuestionMedia
  // Canvas slide
  background?: SlideBackground
  backgroundOpacity?: number
  elements?: SlideElement[]
  audio?: string
  cooldown: number
  time: number
}

export type McqQuestion = BaseQuestion & {
  type: "mcq"
  answers: string[]
  solutions: number[]
}

export type TrueFalseQuestion = BaseQuestion & {
  type: "true_false"
  solution: 0 | 1
}

export type OpenQuestion = BaseQuestion & {
  type: "open"
  correctAnswers: string[]
}

export type DateQuestion = BaseQuestion & {
  type: "date"
  correctYear: number
  tolerance: number
  minYear?: number
  maxYear?: number
}

export type SliderQuestion = BaseQuestion & {
  type: "slider"
  correctValue: number
  min: number
  max: number
  tolerance: number
}

export type TitleQuestion = BaseQuestion & {
  type: "title"
}

export type DropPinZone = {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  isCorrect: boolean
}

export type PuzzleQuestion = BaseQuestion & {
  type: "puzzle"
  items: string[]
}

export type DropPinQuestion = BaseQuestion & {
  type: "drop_pin"
  pinImage: string
  zones: DropPinZone[]
}

export type Question =
  | McqQuestion
  | TrueFalseQuestion
  | OpenQuestion
  | DateQuestion
  | SliderQuestion
  | PuzzleQuestion
  | DropPinQuestion
  | TitleQuestion

export type Quizz = {
  subject: string
  description?: string
  folder?: string
  tags?: string[]
  salonImage?: string
  listingImage?: string
  questions: Question[]
}

export type QuizzWithId = Quizz & { id: string }

export type QuizzMeta = {
  id: string
  subject: string
  folder?: string
  tags?: string[]
  salonImage?: string
  listingImage?: string
}

export type GameUpdateQuestion = {
  current: number
  total: number
}

export type PlayerAnswerRecord = {
  playerName: string
  answerId?: number | null
  textAnswer?: string | null
  numberAnswer?: number | null
  orderAnswer?: number[] | null
  points: number
}

export type QuestionResult = Question & {
  playerAnswers: PlayerAnswerRecord[]
}

export type GameResultPlayer = {
  username: string
  points: number
  rank: number
}

export type GameResult = {
  id: string
  subject: string
  date: string
  players: GameResultPlayer[]
  questions: QuestionResult[]
}

export type GameResultMeta = {
  id: string
  subject: string
  date: string
  playerCount: number
}
