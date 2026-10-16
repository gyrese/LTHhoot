import type { Question, PodiumThemeSetting } from "@rahoot/common/types/game"

export type DraftBackup = {
  savedId?: string | null
  baseUpdatedAt?: number
  savedAt?: number
  subject?: string
  publicName?: string
  description?: string
  folder?: string
  tags?: string[]
  salonImage?: string
  listingImage?: string
  podiumTheme?: PodiumThemeSetting
  fontFamily?: string
  questions: Question[]
}

export type DraftCandidate = { key: string; backup: DraftBackup }

const questionTypes = new Set([
  "title",
  "mcq",
  "true_false",
  "open",
  "date",
  "slider",
  "puzzle",
  "drop_pin",
  "image_sequence",
  "grid",
])

export const parseDraftBackup = (raw: string | null): DraftBackup | null => {
  if (!raw) {
    return null
  }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") {
      return null
    }
    const draft = value as Record<string, unknown>
    if (
      !Array.isArray(draft.questions) ||
      draft.questions.length === 0 ||
      !draft.questions.every(
        (question: unknown) =>
          question &&
          typeof question === "object" &&
          typeof (question as Record<string, unknown>).question === "string" &&
          questionTypes.has(
            (question as Record<string, unknown>).type as string,
          ),
      )
    ) {
      return null
    }
    const stringFields = [
      "subject",
      "publicName",
      "description",
      "folder",
      "salonImage",
      "listingImage",
      "fontFamily",
    ]
    if (
      stringFields.some(
        (field) =>
          draft[field] !== undefined && typeof draft[field] !== "string",
      )
    ) {
      return null
    }
    if (
      draft.tags !== undefined &&
      (!Array.isArray(draft.tags) ||
        !draft.tags.every((tag: unknown) => typeof tag === "string"))
    ) {
      return null
    }
    if (
      draft.savedId !== undefined &&
      draft.savedId !== null &&
      typeof draft.savedId !== "string"
    ) {
      return null
    }
    if (
      draft.baseUpdatedAt !== undefined &&
      (typeof draft.baseUpdatedAt !== "number" ||
        !Number.isFinite(draft.baseUpdatedAt))
    ) {
      return null
    }
    if (
      draft.savedAt !== undefined &&
      (typeof draft.savedAt !== "number" || !Number.isFinite(draft.savedAt))
    ) {
      return null
    }
    return draft as DraftBackup
  } catch {
    return null
  }
}

export const findDraftBackup = (
  storage: Storage,
  currentKey: string,
  clientPrefix: string,
  quizId?: string,
): DraftCandidate | null => {
  const keys = [currentKey]
  if (quizId) {
    keys.push(`rahoot-backup-${quizId}`)
  }
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(clientPrefix) && !keys.includes(key)) {
      keys.push(key)
    }
  }

  const candidates = keys.flatMap((key) => {
    const backup = parseDraftBackup(storage.getItem(key))
    if (!backup) {
      return []
    }
    if (quizId) {
      const ownKey = key === currentKey || key === `rahoot-backup-${quizId}`
      if (backup.savedId !== quizId && !(ownKey && !backup.savedId)) {
        return []
      }
    } else if (backup.savedId) {
      return []
    }
    return [{ key, backup }]
  })
  return (
    candidates.sort(
      (a, b) => (b.backup.savedAt ?? 0) - (a.backup.savedAt ?? 0),
    )[0] ?? null
  )
}
