import { z } from "zod"
import {
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
  audience: string
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
  audience: z.string().max(150),
})

export const emptySession = (): WorkshopSession => ({
  questions: [],
  messages: [],
  input: "",
  audience: "",
})

export function numberedTargets(message: string, questions: DraftQuestion[]) {
  const matches = [
    ...message.matchAll(
      /questions?\s*(?:n[°o]\s*)?(\d+(?:\s*(?:,|et|&)\s*\d+)*)/giu,
    ),
  ]
  if (!matches.length) {
    return undefined
  }
  const numbers = [
    ...new Set(
      matches.flatMap((match) => match[1].match(/\d+/gu)!.map(Number)),
    ),
  ]
  if (numbers.some((number) => !questions[number - 1])) {
    throw new Error("Une question demandée n’existe pas dans le brouillon.")
  }
  return numbers.map((number) => questions[number - 1].id)
}

export function loadSession(key: string): WorkshopSession {
  try {
    return sessionValidator.parse(
      JSON.parse(localStorage.getItem(key) || "null"),
    )
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
