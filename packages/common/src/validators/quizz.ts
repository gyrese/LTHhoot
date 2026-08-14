import {
  MEDIA_TYPES,
  PODIUM_THEME_NEUTRAL,
  PODIUM_THEMES,
} from "@rahoot/common/constants"
import { z } from "zod"

export const questionMediaValidator = z.object({
  type: z
    .enum([MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO])
    .optional(),
  url: z.string().min(1),
})

const slideElementBaseValidator = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  opacity: z.number(),
  isLocked: z.boolean().optional(),
  name: z.string().optional(),
})

const textElementValidator = slideElementBaseValidator.extend({
  type: z.literal("text"),
  text: z.string(),
  fontSize: z.number(),
  fontFamily: z.string(),
  fontStyle: z.string(),
  textDecoration: z.string(),
  fill: z.string(),
  align: z.enum(["left", "center", "right"]),
  textBackground: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
})

const shapeElementValidator = slideElementBaseValidator.extend({
  type: z.literal("shape"),
  shapeType: z.enum(["rect", "circle", "triangle", "star"]),
  fill: z.string(),
  cornerRadius: z.number().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
})

const imageElementValidator = slideElementBaseValidator.extend({
  type: z.literal("image"),
  url: z.string(),
})

const youtubeElementValidator = slideElementBaseValidator.extend({
  type: z.literal("youtube"),
  videoId: z.string(),
  autoplay: z.boolean(),
  mute: z.boolean(),
  loop: z.boolean(),
  controls: z.boolean(),
  startTime: z.number(),
  endTime: z.number(),
})

export const slideElementValidator = z.discriminatedUnion("type", [
  textElementValidator,
  shapeElementValidator,
  imageElementValidator,
  youtubeElementValidator,
])

const slideBackgroundValidator = z.object({
  type: z.enum(["color", "image"]),
  value: z.string(),
})

export const answerRevealValidator = z.object({
  enabled: z.boolean(),
  image: z.string().optional(),
  videoId: z.string().optional(),
  text: z.string().optional(),
})

const difficultyValidator = z.enum(["easy", "medium", "hard", "expert"])

const baseQuestionValidator = z.object({
  question: z.string().min(1, "errors:quizz.questionEmpty"),
  difficulty: difficultyValidator.optional(),
  media: questionMediaValidator.optional(),
  background: slideBackgroundValidator.optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  elements: z.array(slideElementValidator).optional(),
  audio: z.string().optional(),
  showLeaderboard: z.boolean().optional(),
  answerReveal: answerRevealValidator.optional(),
  suddenDeath: z.boolean().optional(),
  cooldown: z.number().int().min(3).max(15),
  time: z.number().int().min(5).max(120),
  revelationEnabled: z.boolean().optional(),
  revealDuration: z.number().int().min(3).max(120).optional(),
  gridCols: z.number().int().min(2).max(30).optional(),
  gridRows: z.number().int().min(2).max(30).optional(),
  revelationStyle: z.string().optional(),
})

const mcqValidator = baseQuestionValidator.extend({
  type: z.literal("mcq"),
  answers: z
    .array(z.string().min(1, "errors:quizz.answerEmpty"))
    .min(2, "errors:quizz.tooFewAnswers")
    .max(4, "errors:quizz.tooManyAnswers"),
  solutions: z
    .union([z.number().int().min(0), z.array(z.number().int().min(0)).min(1)])
    .transform((v) => (Array.isArray(v) ? v : [v])),
})

const trueFalseValidator = baseQuestionValidator.extend({
  type: z.literal("true_false"),
  solution: z.union([z.literal(0), z.literal(1)]),
})

const openValidator = baseQuestionValidator.extend({
  type: z.literal("open"),
  correctAnswers: z
    .array(z.string().min(1, "errors:quizz.answerEmpty"))
    .min(1, "errors:quizz.tooFewCorrectAnswers"),
})

const imageSequenceValidator = baseQuestionValidator.extend({
  type: z.literal("image_sequence"),
  images: z.array(z.string().min(1)).min(1, "errors:quizz.tooFewImages"),
  correctAnswers: z
    .array(z.string().min(1, "errors:quizz.answerEmpty"))
    .min(1, "errors:quizz.tooFewCorrectAnswers"),
  imageInterval: z.number().int().min(2).max(60).optional(),
})

const dateValidator = baseQuestionValidator.extend({
  type: z.literal("date"),
  correctYear: z.number().int().min(-9999).max(2200),
  tolerance: z.number().int().min(1),
  minYear: z.number().int().optional(),
  maxYear: z.number().int().optional(),
})

const sliderValidator = baseQuestionValidator.extend({
  type: z.literal("slider"),
  correctValue: z.number(),
  min: z.number(),
  max: z.number(),
  tolerance: z.number().min(0),
})

const puzzleValidator = baseQuestionValidator.extend({
  type: z.literal("puzzle"),
  items: z
    .array(z.string().min(1, "errors:quizz.answerEmpty"))
    .min(2, "errors:quizz.tooFewAnswers"),
})

const dropPinZoneValidator = z.object({
  id: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  label: z.string(),
  isCorrect: z.boolean(),
})

const dropPinValidator = baseQuestionValidator.extend({
  type: z.literal("drop_pin"),
  pinImage: z.string().min(1),
  zones: z.array(dropPinZoneValidator).min(1),
})

const gridCellValidator = z.object({
  image: z.string(),
  label: z.string().optional(),
})

const gridValidator = baseQuestionValidator.extend({
  type: z.literal("grid"),
  cellsPerRow: z.number().int().min(2).max(6),
  cells: z.array(gridCellValidator).min(2).max(36),
  correctIndexes: z.array(z.number().int().min(0)).min(1),
})

const titleValidator = z.object({
  type: z.literal("title"),
  question: z.string().optional().default(""),
  difficulty: difficultyValidator.optional(),
  media: questionMediaValidator.optional(),
  background: slideBackgroundValidator.optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  elements: z.array(slideElementValidator).optional(),
  audio: z.string().optional(),
  showLeaderboard: z.boolean().optional(),
  cooldown: z.number().int().min(3).max(120),
  time: z.number().int().min(5).max(120),
  revelationEnabled: z.boolean().optional(),
  revealDuration: z.number().int().min(3).max(120).optional(),
  gridCols: z.number().int().min(2).max(30).optional(),
  gridRows: z.number().int().min(2).max(30).optional(),
  revelationStyle: z.string().optional(),
})

const legacyMcqValidator = baseQuestionValidator
  .extend({
    answers: z
      .array(z.string().min(1, "errors:quizz.answerEmpty"))
      .min(2, "errors:quizz.tooFewAnswers")
      .max(4, "errors:quizz.tooManyAnswers"),
    solutions: z
      .union([z.number().int().min(0), z.array(z.number().int().min(0)).min(1)])
      .transform((v) => (Array.isArray(v) ? v : [v])),
  })
  .transform((v) => ({ ...v, type: "mcq" as const }))

export const questionValidator = z.preprocess(
  (val) => {
    if (typeof val === "object" && val !== null && !("type" in val)) {
      return { ...val, type: "mcq" }
    }

    return val
  },
  z.discriminatedUnion("type", [
    mcqValidator,
    trueFalseValidator,
    openValidator,
    imageSequenceValidator,
    dateValidator,
    sliderValidator,
    puzzleValidator,
    dropPinValidator,
    gridValidator,
    titleValidator,
  ]),
)

export const quizzValidator = z.object({
  subject: z.string().min(1, "errors:quizz.subjectEmpty"),
  publicName: z.string().optional(),
  description: z.string().optional(),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
  salonImage: z.string().optional(),
  listingImage: z.string().optional(),
  // .catch(undefined) : un thème retiré du catalogue déjà stocké sur disque
  // retombe sur le défaut (neutre) au lieu d'invalider le quiz.
  podiumTheme: z
    .enum(["random", PODIUM_THEME_NEUTRAL, ...PODIUM_THEMES])
    .optional()
    .catch(undefined),
  questions: z.array(questionValidator).min(1, "errors:quizz.noQuestions"),
  updatedAt: z.number().optional(),
})

export type QuizzValidated = z.infer<typeof quizzValidator>

export {
  mcqValidator,
  trueFalseValidator,
  openValidator,
  imageSequenceValidator,
  dateValidator,
  sliderValidator,
  puzzleValidator,
  dropPinValidator,
  gridValidator,
  legacyMcqValidator,
}
