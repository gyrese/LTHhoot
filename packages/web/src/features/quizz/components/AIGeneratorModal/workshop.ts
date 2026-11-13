import { z } from "zod"
import {
  WORKSHOP_BRIEF_MAX,
  workshopQuestionValidator,
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
}

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
  // Ancien champ « Public visé » : repris dans le brief au chargement.
  audience: z.string().max(150).optional(),
})

export const emptySession = (): WorkshopSession => ({
  questions: [],
  messages: [],
  input: "",
  brief: "",
})

export function loadSession(key: string): WorkshopSession {
  try {
    const { audience, brief, ...session } = sessionValidator.parse(
      JSON.parse(localStorage.getItem(key) || "null"),
    )
    const legacy = audience?.trim() ? `Public visé : ${audience.trim()}` : ""

    return { ...session, brief: brief ?? legacy }
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
