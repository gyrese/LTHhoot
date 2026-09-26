import { FAST_MODE_INTENSITY } from "@rahoot/common/types/fast-mode"
import { z } from "zod"

// Schémas des payloads socket du jeu (cf. utils/validate). Bornes volontairement
// larges : elles ne visent que les payloads absurdes ou malveillants, jamais un
// usage légitime.

const id = z.string().min(1).max(200)
const optionalId = id.optional()
// Tolère `null` (sérialisation JSON d'un champ vide) en plus de l'absence.
const nullish = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? undefined)

const fastModeIntensity = z.enum(FAST_MODE_INTENSITY)
const disabledPowerUps = z.array(z.string().max(50)).max(50)

export const gameIdSchema = z.object({ gameId: id })

export const kickPlayerSchema = z.object({ gameId: id, playerId: id })

export const createGameSchema = z.union([
  id,
  z.object({
    quizId: id,
    powerUpsEnabled: z.boolean().optional(),
    disabledPowerUps: disabledPowerUps.optional(),
    questionIndex: z.number().int().min(0).optional(),
    noSpeedMode: z.boolean().optional(),
    fastMode: z.boolean().optional(),
    fastModeIntensity: fastModeIntensity.optional(),
  }),
])

export const loginSchema = z.object({
  gameId: id,
  data: z.object({
    // Longueur fine vérifiée par usernameValidator (messages i18n dédiés).
    username: z.string().max(100),
    // Graine d'avatar : une courte chaîne, jamais une image encodée.
    avatar: nullish(z.string().max(200)),
  }),
})

export const selectedAnswerSchema = z.object({
  gameId: optionalId,
  data: z.object({
    answerId: nullish(z.number().int().min(0).max(1000)),
    textAnswer: nullish(z.string().max(500)),
    numberAnswer: nullish(z.number()),
    orderAnswer: nullish(z.array(z.number().int().min(0).max(1000)).max(100)),
  }),
})

export const tieBreakAnswerSchema = z.object({
  answerId: z.number().int().min(0).max(100),
})

export const openAnswerSchema = z.object({
  gameId: id,
  data: z.object({ text: z.string().max(500) }),
})

export const videoDurationSchema = z.object({
  gameId: id,
  duration: z.number().positive(),
})

export const eveningStartSchema = z.object({
  quizIds: z.array(id).max(50),
  powerUpsEnabled: z.boolean().optional(),
  disabledPowerUps: disabledPowerUps.optional(),
  noSpeedMode: z.boolean().optional(),
  fastMode: z.boolean().optional(),
  fastModeIntensity: fastModeIntensity.optional(),
})

export const powerUpUseSchema = z.object({
  gameId: optionalId,
  powerUpId: z.string().min(1).max(50),
  targetIds: z.array(id).max(10).optional(),
})

export const buyPowerUpSchema = z.object({
  gameId: optionalId,
  data: z.object({ powerUpType: z.string().max(50) }),
})
