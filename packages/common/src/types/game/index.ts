import type {
  MEDIA_TYPES,
  PODIUM_THEME_NEUTRAL,
  PODIUM_THEMES,
} from "@rahoot/common/constants"

// Thème concret du podium, jamais "random" (résolu côté serveur). "neutre"
// est le défaut : podium sobre sur l'image de couverture du quiz.
export type PodiumThemeId =
  | (typeof PODIUM_THEMES)[number]
  | typeof PODIUM_THEME_NEUTRAL

// Réglage stocké dans le quiz : un thème précis ou tirage au sort.
export type PodiumThemeSetting = PodiumThemeId | "random"

export type Player = {
  id: string
  clientId: string
  connected: boolean
  username: string
  avatar?: string
  points: number
  streak: number
  teamId?: string
  teamName?: string
  goldCoins?: number
  hasStreakShield?: boolean
}

export type Answer = {
  playerId: string
  answerId?: number
  textAnswer?: string
  numberAnswer?: number
  orderAnswer?: number[]
  points: number
  timeMs?: number
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
  isLocked?: boolean
  name?: string
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
  textBackground?: string
  stroke?: string
  strokeWidth?: number
}

export type ShapeElement = SlideElementBase & {
  type: "shape"
  shapeType: "rect" | "circle" | "triangle" | "star"
  fill: string
  cornerRadius?: number
  stroke?: string
  strokeWidth?: number
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

export type AnswerReveal = {
  enabled: boolean
  image?: string
  videoId?: string
  text?: string
}

// ─── Types de questions ───────────────────────────────────────────────────────

export type QuestionType =
  | "mcq"
  | "true_false"
  | "open"
  | "image_sequence"
  | "date"
  | "slider"
  | "puzzle"
  | "drop_pin"
  | "grid"
  | "title"

// Niveau d'exigence d'une question. Renseigné par la génération IA (qui peut
// mélanger plusieurs niveaux dans un même lot) ; optionnel ailleurs.
export type QuestionDifficulty = "easy" | "medium" | "hard" | "expert"

type BaseQuestion = {
  question: string
  type: QuestionType
  difficulty?: QuestionDifficulty
  media?: QuestionMedia
  // Canvas slide
  background?: SlideBackground
  backgroundOpacity?: number
  elements?: SlideElement[]
  audio?: string
  showLeaderboard?: boolean
  answerReveal?: AnswerReveal
  // Mort subite : la manche s'arrête dès la première bonne réponse (au lieu
  // d'attendre que tout le monde ait répondu ou le temps imparti).
  suddenDeath?: boolean
  cooldown: number
  time: number
  revelationEnabled?: boolean
  revealDuration?: number
  gridCols?: number
  gridRows?: number
  revelationStyle?: string
  // Multiplicateur de points (par ex. 2 pour doubler les points de la question)
  pointsMultiplier?: number
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

export type ImageSequenceQuestion = BaseQuestion & {
  type: "image_sequence"
  images: string[]
  correctAnswers: string[]
  imageInterval?: number
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

// Une case de la grille : une image et, facultativement, un libellé affiché
// sous l'image (nommage des propositions, accessibilité).
export type GridCell = {
  image: string
  label?: string
}

// Grille de propositions visuelles : le joueur tape la case qu'il pense juste.
// `cells` est stocké à plat, ligne par ligne — le nombre de lignes se déduit de
// `cells.length / cellsPerRow`. À ne pas confondre avec `gridCols`/`gridRows` de
// `BaseQuestion`, qui pilotent la révélation progressive du fond.
export type GridQuestion = BaseQuestion & {
  type: "grid"
  cells: GridCell[]
  cellsPerRow: number
  correctIndexes: number[]
}

export type Question =
  | McqQuestion
  | TrueFalseQuestion
  | OpenQuestion
  | ImageSequenceQuestion
  | DateQuestion
  | SliderQuestion
  | PuzzleQuestion
  | DropPinQuestion
  | GridQuestion
  | TitleQuestion

export type Quizz = {
  subject: string
  // Nom affiché aux joueurs (écran solo, salon, podium). Optionnel : quand il
  // est vide, `subject` — le titre interne, souvent technique — fait foi.
  publicName?: string
  description?: string
  folder?: string
  tags?: string[]
  salonImage?: string
  listingImage?: string
  podiumTheme?: PodiumThemeSetting
  questions: Question[]
  updatedAt?: number
}

export type QuizzWithId = Quizz & { id: string }

export type QuizzMeta = {
  id: string
  subject: string
  publicName?: string
  description?: string
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
  // Temps de réponse en ms — optionnel/additif, absent des anciens résultats
  // persistés sur disque avant son introduction. Sert au calcul des awards de
  // fin de soirée (« le plus rapide »).
  timeMs?: number | null
}

export type QuestionResult = Question & {
  playerAnswers: PlayerAnswerRecord[]
}

export type GameResultPlayer = {
  username: string
  avatar?: string
  points: number
  rank: number
  socialContact?: string
}

export type LogEntry = {
  id: string
  timestamp: number
  level: "info" | "warn" | "error"
  message: string
}

export type GameResult = {
  id: string
  subject: string
  date: string
  players: GameResultPlayer[]
  questions: QuestionResult[]
  logs?: LogEntry[]
}

// Récap "Wrapped" de fin de soirée — awards calculés sur l'ensemble des quiz
// joués (cf. calculateAwards côté serveur).
export type AwardType = "fastest" | "comeback" | "loser" | "sniper"

export type Award = {
  type: AwardType
  playerName: string
  value?: number
}

export type GameResultMeta = {
  id: string
  subject: string
  date: string
  playerCount: number
}
