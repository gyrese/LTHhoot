import { z } from "zod"
import {
  WORKSHOP_BRIEF_MAX,
  WORKSHOP_FEEDBACK_LIMIT,
  WORKSHOP_SOURCE_MAX,
  workshopFeedbackValidator,
  workshopQuestionValidator,
  type WorkshopFeedback,
  type WorkshopOperation,
  type WorkshopQuestion,
} from "@rahoot/common/validators/ai-workshop"

export type DraftQuestion = WorkshopQuestion & { selected: boolean }
export type ChatMessage = { role: "user" | "assistant"; text: string }
export type WorkshopSession = {
  questions: DraftQuestion[]
  messages: ChatMessage[]
  input: string
  // Préférences durables du quiz, tenues à jour par l'IA et modifiables.
  brief: string
  // Texte collé par l'auteur, base factuelle des questions.
  source: string
  // Propositions remplacées ou retirées, avec la raison (les plus récentes).
  feedback: WorkshopFeedback[]
}

// Raisons proposées quand l'auteur remplace une question : elles orientent
// la proposition suivante et restent en mémoire pour les tours d'après.
export const FEEDBACK_REASONS = [
  "Trop facile",
  "Trop difficile",
  "Hors sujet",
  "Trop connue",
  "Inexacte",
  "Autre angle",
] as const

export const REMOVED_REASON = "Retirée par l’auteur"

export const rememberFeedback = (
  feedback: WorkshopFeedback[],
  question: string,
  reason: string,
): WorkshopFeedback[] =>
  [
    ...feedback.filter((entry) => entry.question !== question),
    { question: question.slice(0, 300), reason },
  ].slice(-WORKSHOP_FEEDBACK_LIMIT)

const sessionValidator = z.object({
  questions: z
    .array(workshopQuestionValidator.extend({ selected: z.boolean() }))
    .max(20),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(3000),
      }),
    )
    .max(24),
  input: z.string().max(2000),
  brief: z.string().max(WORKSHOP_BRIEF_MAX).optional(),
  source: z.string().max(WORKSHOP_SOURCE_MAX).optional(),
  feedback: z
    .array(workshopFeedbackValidator)
    .max(WORKSHOP_FEEDBACK_LIMIT)
    .optional(),
  // Ancien champ « Public visé » : repris dans le brief au chargement.
  audience: z.string().max(150).optional(),
})

export const emptySession = (): WorkshopSession => ({
  questions: [],
  messages: [],
  input: "",
  brief: "",
  source: "",
  feedback: [],
})

export function loadSession(key: string): WorkshopSession {
  try {
    const { audience, brief, source, feedback, ...session } =
      sessionValidator.parse(JSON.parse(localStorage.getItem(key) || "null"))
    const legacy = audience?.trim() ? `Public visé : ${audience.trim()}` : ""

    return {
      ...session,
      brief: brief ?? legacy,
      source: source ?? "",
      feedback: feedback ?? [],
    }
  } catch {
    return emptySession()
  }
}

export function applyWorkshopOperations(
  questions: DraftQuestion[],
  operations: WorkshopOperation[],
): DraftQuestion[] {
  // Apply atomically, preserving stable ids, selection and all untouched objects.
  const touched = new Set<string>()
  for (const op of operations) {
    if (op.type === "add") {
      continue
    }
    const item = questions.find((q) => q.id === op.id)
    if (!item || item.locked || touched.has(op.id)) {
      throw new Error(
        "Une question protégée a été ciblée. Votre brouillon est conservé.",
      )
    }
    touched.add(op.id)
  }
  let next = [...questions]
  for (const op of operations) {
    if (op.type === "add") {
      next.push({
        id: crypto.randomUUID(),
        question: op.question,
        locked: false,
        selected: true,
      })
    } else if (op.type === "remove") {
      next = next.filter((q) => q.id !== op.id)
    } else {
      next = next.map((q) =>
        q.id === op.id ? { ...q, question: op.question } : q,
      )
    }
  }
  if (next.length > 20) {
    throw new Error("Le brouillon est limité à 20 questions.")
  }
  return next
}
