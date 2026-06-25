import { STATUS, type Status } from "@rahoot/common/types/game/status"

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameStatus = { name: Status; data: Record<string, unknown> } | null
export type QuestionStates = { current: number; total: number } | null
export type RemoteTab = "jeu" | "joueurs" | "journal"

export interface PrimaryAction {
  label: string
  disabled: boolean
  variant: "orange" | "red" | "ghost"
}

// ─── Constantes ───────────────────────────────────────────────────────────────

export const QUESTION_TYPE_LABELS = new Map<string, string>([
  ["mcq", "QCM"],
  ["true_false", "Vrai / Faux"],
  ["open", "Réponse libre"],
  ["image_sequence", "Séquence d'images"],
  ["date", "Date"],
  ["slider", "Curseur"],
  ["puzzle", "Puzzle"],
  ["drop_pin", "Carte"],
  ["title", "Titre"],
])

export const MCQ_COLORS = [
  { bg: "bg-red-500", bar: "bg-red-500", letter: "A" },
  { bg: "bg-blue-500", bar: "bg-blue-500", letter: "B" },
  { bg: "bg-yellow-500", bar: "bg-yellow-500", letter: "C" },
  { bg: "bg-green-500", bar: "bg-green-500", letter: "D" },
]

export const STATUS_LABELS: Partial<Record<Status, string>> = {
  [STATUS.SHOW_ROOM]: "Attente",
  [STATUS.SHOW_START]: "Démarrage",
  [STATUS.SHOW_PREPARED]: "Préparation",
  [STATUS.SHOW_QUESTION]: "Lecture",
  [STATUS.SELECT_ANSWER]: "Réponses",
  [STATUS.SHOW_OPEN_ANSWERS]: "Réponses libres",
  [STATUS.SHOW_RESPONSES]: "Résultats",
  [STATUS.SHOW_LEADERBOARD]: "Classement",
  [STATUS.FINISHED]: "Terminé",
}

export const RANK_MEDALS = ["🥇", "🥈", "🥉"]
