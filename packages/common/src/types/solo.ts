import type {
  DropPinZone,
  GridCell,
  QuestionMedia,
  SlideBackground,
  SlideElement,
} from "@rahoot/common/types/game"

// ─── Solo public (/solo/:quizzId) ────────────────────────────────────────────
// Le solo alimente un tirage au sort : le client ne reçoit JAMAIS les
// solutions avant d'avoir répondu, et tout le chronométrage est fait côté
// serveur (horodatage de chaque question servie).

// Métadonnées publiques d'un quiz, sans aucune question.
export type SoloPublicQuizz = {
  id: string
  subject: string
  description?: string
  salonImage?: string
  listingImage?: string
  // Nombre de questions jouées en solo (slides titre exclus).
  totalQuestions: number
}

type SoloQuestionBase = {
  question: string
  media?: QuestionMedia
  background?: SlideBackground
  backgroundOpacity?: number
  elements?: SlideElement[]
  audio?: string
  // Temps de réponse accordé, en secondes.
  time: number
  revelationEnabled?: boolean
  revealDuration?: number
  gridCols?: number
  gridRows?: number
  revelationStyle?: string
}

// Question telle qu'envoyée au joueur solo : uniquement ce qu'il faut pour
// l'afficher et y répondre (aucun champ de solution).
export type SoloPublicQuestion = SoloQuestionBase &
  (
    | { type: "mcq"; answers: string[] }
    | { type: "true_false" }
    | { type: "open" }
    | { type: "image_sequence"; images: string[]; imageInterval?: number }
    | { type: "date"; tolerance: number; minYear?: number; maxYear?: number }
    | { type: "slider"; tolerance: number; min: number; max: number }
    // Éléments MÉLANGÉS : la réponse (`orderAnswer`) est l'ordre choisi des
    // index de CETTE liste, le serveur retrouve l'ordre d'origine.
    | { type: "puzzle"; items: string[] }
    | { type: "drop_pin"; pinImage: string }
    | { type: "grid"; cells: GridCell[]; cellsPerRow: number }
  )

// Correction renvoyée après une réponse (champs selon le type de question).
export type SoloSolution = {
  // QCM, vrai-faux, grille : index des propositions justes
  solutions?: number[]
  // Ouverte, séquence d’images : réponses acceptées
  correctAnswers?: string[]
  // Curseur
  correctValue?: number
  // Date
  correctYear?: number
  tolerance?: number
  // Puzzle : éléments dans le bon ordre
  items?: string[]
  // Placement d’épingle : zones cibles
  zones?: DropPinZone[]
}

export type SoloAnswerPayload = {
  answerId?: number
  textAnswer?: string
  numberAnswer?: number
  orderAnswer?: number[]
}

export type SoloStartPayload = {
  quizzId: string
  playerName: string
  socialContact?: string
  // Signaux anti-bot du formulaire public : honeypot.
  human?: { hp?: string }
}

export type SoloError = { ok: false; error: string }

export type SoloStartAck =
  | { ok: true; sessionId: string; totalQuestions: number }
  | SoloError

export type SoloNextAck =
  | {
      ok: true
      done: false
      questionIndex: number
      totalQuestions: number
      question: SoloPublicQuestion
      // Horodatages SERVEUR (ms) : début et fin de la fenêtre de réponse.
      servedAt: number
      endsAt: number
    }
  | { ok: true; done: true }
  | SoloError

export type SoloAnswerAck =
  | {
      ok: true
      correct: boolean
      // Points gagnés sur cette question et total cumulé de la session.
      points: number
      totalPoints: number
      // Réponse reçue hors délai (comptée fausse).
      late: boolean
      solution: SoloSolution
    }
  | SoloError

export type SoloSubmitResult = {
  totalPoints: number
  rank: number
  totalPlayers: number
  correctAnswersCount: number
  totalQuestions: number
}

export type SoloSubmitAck = ({ ok: true } & SoloSubmitResult) | SoloError
