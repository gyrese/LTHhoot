import type {
  QuestionDifficulty,
  QuestionType,
} from "@rahoot/common/types/game"

// Types que l'IA sait produire sans média : `image_sequence` et `drop_pin`
// exigent des images, `title` n'est pas une question.
// Libellés repris des locales existantes (cf. QuestionEditorTypeSelector).
export const AI_QUESTION_TYPES: { type: QuestionType; key: string }[] = [
  { type: "mcq", key: "quizz:questionType.mcq" },
  { type: "true_false", key: "quizz:questionType.true_false" },
  { type: "open", key: "quizz:questionType.open" },
  { type: "slider", key: "quizz:questionType.slider" },
  { type: "date", key: "quizz:questionType.date" },
  { type: "puzzle", key: "quizz:questionType.puzzle" },
]

export type ToneOption = {
  value: string
  label: string
  hint: string
}

// Les instructions de prompt correspondantes vivent côté serveur
// (socket/services/ai-prompt.ts) : ici, uniquement l'habillage.
export const TONE_OPTIONS: ToneOption[] = [
  {
    value: "fun",
    label: "Fun & décalé",
    hint: "Moderne, léger, une pointe d'humour",
  },
  {
    value: "neutral",
    label: "Neutre & factuel",
    hint: "Sobre et direct, sans effet de style",
  },
  {
    value: "educational",
    label: "Pédagogique",
    hint: "Bienveillant, apporte un peu de contexte",
  },
  {
    value: "snarky",
    label: "Piquant",
    hint: "Taquin et ironique, chambre le joueur",
  },
  { value: "epic", label: "Épique", hint: "Solennel, façon bande-annonce" },
  {
    value: "absurd",
    label: "Absurde",
    hint: "Formulations WTF, faits toujours exacts",
  },
]

export type DifficultyOption = {
  value: QuestionDifficulty
  label: string
  hint: string
}

export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { value: "easy", label: "Facile", hint: "Grand public" },
  { value: "medium", label: "Intermédiaire", hint: "Culture générale" },
  { value: "hard", label: "Difficile", hint: "Connaisseurs" },
  { value: "expert", label: "Expert", hint: "Spécialistes" },
]

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: "Facile",
  medium: "Intermédiaire",
  hard: "Difficile",
  expert: "Expert",
}

// Teintes des badges de difficulté (preview). Volontairement distinctes de
// l'orange primaire, réservé à la sélection.
export const DIFFICULTY_BADGE_CLASSES: Record<QuestionDifficulty, string> = {
  easy: "bg-emerald-500/15 text-emerald-400",
  medium: "bg-sky-500/15 text-sky-400",
  hard: "bg-amber-500/15 text-amber-400",
  expert: "bg-rose-500/15 text-rose-400",
}

export const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto (langue du sujet)" },
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
]

export const TIME_OPTIONS = [
  { value: 0, label: "Auto (selon difficulté)" },
  { value: 10, label: "10 secondes" },
  { value: 15, label: "15 secondes" },
  { value: 20, label: "20 secondes" },
  { value: 30, label: "30 secondes" },
  { value: 45, label: "45 secondes" },
  { value: 60, label: "60 secondes" },
]

export const MIN_COUNT = 1
export const MAX_COUNT = 20

export type GeneratorSettings = {
  count: number
  difficulties: QuestionDifficulty[]
  tone: string
  questionTypes: string[]
  language: string
  time: number
  withExplanations: boolean
  instructions: string
}

export const DEFAULT_SETTINGS: GeneratorSettings = {
  count: 5,
  difficulties: ["medium"],
  tone: "fun",
  questionTypes: ["mcq", "true_false"],
  language: "auto",
  time: 0,
  withExplanations: false,
  instructions: "",
}

const STORAGE_KEY = "rahoot-ai-generator-settings"

export const loadSettings = (): GeneratorSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return DEFAULT_SETTINGS
    }

    const parsed = JSON.parse(raw) as Partial<GeneratorSettings>

    // Fusion avec les défauts : un réglage retiré d'une version à l'autre ne
    // doit pas casser la modale.
    const merged = { ...DEFAULT_SETTINGS, ...parsed }

    return {
      ...merged,
      // Le sujet est volontairement non persisté, mais ces deux listes le sont :
      // vides, elles bloqueraient le bouton Générer sans raison visible.
      difficulties: merged.difficulties.length
        ? merged.difficulties
        : DEFAULT_SETTINGS.difficulties,
      questionTypes: merged.questionTypes.length
        ? merged.questionTypes
        : DEFAULT_SETTINGS.questionTypes,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export const saveSettings = (settings: GeneratorSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Quota plein ou stockage désactivé : la persistance des réglages n'est pas
    // critique, on laisse la génération se poursuivre.
  }
}
