import { z } from "zod"

// Nombre maximal de questions par appel : le client découpe au-delà. Assez
// bas pour qu'une réponse tienne dans le délai IA, assez haut pour qu'un quiz
// courant parte en une seule requête (le quota IA est compté par requête).
export const EXPLANATIONS_BATCH_MAX = 25

export const explanationsRequestValidator = z.object({
  items: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(500),
        solutionText: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(EXPLANATIONS_BATCH_MAX),
})

export type ExplanationsRequest = z.infer<typeof explanationsRequestValidator>

export type ExplanationsReply = { explanations: string[] } | { error: string }
