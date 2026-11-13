import { z } from "zod"
import { questionValidator } from "./quizz"

// Types que l'atelier sait produire sans média (`image_sequence` et `drop_pin`
// exigent des images, `title` n'est pas une question).
export const WORKSHOP_QUESTION_TYPES = [
  "mcq",
  "true_false",
  "open",
  "date",
  "slider",
  "puzzle",
] as const

export const WORKSHOP_HISTORY_LIMIT = 12
export const WORKSHOP_BRIEF_MAX = 1000

export const workshopSettingsValidator = z.object({
  count: z.number().int().min(1).max(20),
  difficulties: z
    .array(z.enum(["easy", "medium", "hard", "expert"]))
    .min(1)
    .max(4),
  tone: z.string().max(30),
  questionTypes: z.array(z.enum(WORKSHOP_QUESTION_TYPES)).min(1).max(6),
  language: z.enum(["auto", "fr", "en"]),
  time: z.number().int().min(5).max(120).nullable(),
  withExplanations: z.boolean(),
  instructions: z.string().max(2000).optional(),
})

export const workshopQuestionValidator = z.object({
  id: z.string().min(1).max(80),
  question: questionValidator,
  locked: z.boolean(),
})

export const workshopRequestValidator = z
  .object({
    message: z.string().trim().min(1).max(2000),
    // Préférences durables du quiz (sujet, public, angle, à éviter) : elles
    // survivent à la troncature de l'historique.
    brief: z.string().max(WORKSHOP_BRIEF_MAX).optional(),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          text: z.string().max(3000),
        }),
      )
      .max(WORKSHOP_HISTORY_LIMIT),
    questions: z.array(workshopQuestionValidator).max(20),
    existingQuestions: z.array(z.string().max(500)).max(100),
    targetIds: z.array(z.string().max(80)).max(20).optional(),
    settings: workshopSettingsValidator,
  })
  .superRefine((request, context) => {
    const ids = new Set(request.questions.map((q) => q.id))

    if (
      ids.size !== request.questions.length ||
      request.targetIds?.some((id) => !ids.has(id))
    ) {
      context.addIssue({ code: "custom", message: "Invalid draft ids" })
    }
  })

export type WorkshopQuestion = z.infer<typeof workshopQuestionValidator>
export type WorkshopRequest = z.infer<typeof workshopRequestValidator>
export type WorkshopOperation =
  | { type: "add"; question: WorkshopQuestion["question"] }
  | { type: "replace"; id: string; question: WorkshopQuestion["question"] }
  | { type: "remove"; id: string }
export type WorkshopResult = {
  message: string
  // Brief mis à jour par l'IA ; absent quand il n'a pas changé.
  brief?: string
  operations: WorkshopOperation[]
}
export type WorkshopReply = { result: WorkshopResult } | { error: string }
