import { MEDIA_TYPES } from "@rahoot/common/constants"
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
})

const shapeElementValidator = slideElementBaseValidator.extend({
  type: z.literal("shape"),
  shapeType: z.enum(["rect", "circle", "triangle", "star"]),
  fill: z.string(),
  cornerRadius: z.number().optional(),
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

const baseQuestionValidator = z.object({
  question: z.string().min(1, "errors:quizz.questionEmpty"),
  media: questionMediaValidator.optional(),
  background: slideBackgroundValidator.optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  elements: z.array(slideElementValidator).optional(),
  audio: z.string().optional(),
  cooldown: z.number().int().min(3).max(15),
  time: z.number().int().min(5).max(120),
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

const titleValidator = z.object({
  type: z.literal("title"),
  question: z.string().optional().default(""),
  media: questionMediaValidator.optional(),
  background: slideBackgroundValidator.optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  elements: z.array(slideElementValidator).optional(),
  audio: z.string().optional(),
  cooldown: z.number().int().min(3).max(15),
  time: z.number().int().min(5).max(120),
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

const questionValidator = z.preprocess(
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
    dateValidator,
    sliderValidator,
    puzzleValidator,
    dropPinValidator,
    titleValidator,
  ]),
)

export const quizzValidator = z.object({
  subject: z.string().min(1, "errors:quizz.subjectEmpty"),
  description: z.string().optional(),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
  salonImage: z.string().optional(),
  listingImage: z.string().optional(),
  questions: z.array(questionValidator).min(1, "errors:quizz.noQuestions"),
})

export type QuizzValidated = z.infer<typeof quizzValidator>

export {
  mcqValidator,
  trueFalseValidator,
  openValidator,
  dateValidator,
  sliderValidator,
  puzzleValidator,
  dropPinValidator,
  legacyMcqValidator,
}
