import { z } from "zod"
import { questionValidator } from "@rahoot/common/validators/quizz"
import {
  WORKSHOP_BRIEF_MAX,
  WORKSHOP_QUESTION_TYPES,
  type WorkshopOperation,
  type WorkshopRequest,
  type WorkshopResult,
} from "@rahoot/common/validators/ai-workshop"
import {
  DEFAULT_TONE,
  DIFFICULTY_INSTRUCTIONS,
  TONE_INSTRUCTIONS,
  WRITING_RULES,
  buildExplanationsSection,
  buildQuestionSchemas,
  buildTimingSection,
} from "./ai-prompt"

const MAX_DRAFT = 20

const LANGUAGE_RULES: Record<string, string> = {
  auto: "Write questions, options and your replies in the language the author writes in.",
  fr: "Write every question, option and answer in FRENCH, whatever the language of the conversation.",
  en: "Write every question, option and answer in ENGLISH, whatever the language of the conversation.",
}

const envelopeValidator = z.object({
  message: z.string().trim().max(3000).optional(),
  brief: z.string().trim().max(WORKSHOP_BRIEF_MAX).optional(),
  operations: z.array(z.unknown()).max(40).default([]),
})

const operationValidator = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add"), question: questionValidator }),
  z.object({
    type: z.literal("replace"),
    id: z.string(),
    question: questionValidator,
  }),
  z.object({ type: z.literal("remove"), id: z.string() }),
])

/**
 * Consignes stables de l'atelier. Les réglages de la modale n'y figurent que
 * comme valeurs PAR DÉFAUT : la demande de l'auteur les remplace toujours.
 * (Auparavant ils étaient imposés comme règles strictes et l'IA refusait, par
 * exemple, des questions ouvertes explicitement demandées.)
 */
export function buildWorkshopSystemPrompt({
  settings,
}: WorkshopRequest): string {
  const tone =
    TONE_INSTRUCTIONS[settings.tone] ?? TONE_INSTRUCTIONS[DEFAULT_TONE]
  const language = LANGUAGE_RULES[settings.language] ?? LANGUAGE_RULES.auto
  const difficulties = settings.difficulties.join(", ")

  return `You are a quiz-writing partner. You help a quiz author build and revise a quiz for a live game night, over several turns.

PRIORITY ORDER — when two sources disagree, the higher one wins:
1. The author's CURRENT REQUEST.
2. The QUIZ BRIEF (lasting preferences: subject, audience, angle, level, formats, things to avoid).
3. The earlier conversation.
4. The DEFAULT SETTINGS below, used only for what the author has not specified.
Never refuse, water down or "adapt" a request because it differs from the defaults. If the author asks for open questions, sliders, a given count, level, tone or angle, deliver exactly that.

What makes a question relevant here:
- It serves the brief: the requested subject AND the requested angle (e.g. "production anecdotes", "hidden details", "for kids").
- It is calibrated for the audience: for enthusiasts or experts, skip the facts every casual fan already knows and go for precise, lesser-known details; for children or a family audience, keep it accessible.
- Each question covers a distinct angle; spread questions across the whole subject instead of clustering on its most famous facts.

Available question types: ${WORKSHOP_QUESTION_TYPES.join(", ")}. Image-based formats are not available: if asked, say so briefly and offer the closest text format.

DEFAULT SETTINGS (fallback only):
- Size of a first batch: ${settings.count} questions.
- Question types: ${settings.questionTypes.join(", ")}.${settings.questionTypes.length > 1 ? " Vary them." : ""}
- Difficulty: ${difficulties}.${settings.difficulties.length > 1 ? " Spread the batch across these levels, easiest first." : ""} The audience in the brief overrides this.
- Tone: ${tone}
- ${buildTimingSection(settings.time)}
- ${buildExplanationsSection(settings.withExplanations)}
${settings.instructions?.trim() ? `- Standing notes from the author: ${settings.instructions.trim()}\n` : ""}
${language}

Difficulty levels — set "difficulty" on every question:
${Object.entries(DIFFICULTY_INSTRUCTIONS)
  .map(([level, text]) => `- ${level}: ${text}`)
  .join("\n")}

Whatever the tone, the CONTENT stays serious: accurate facts, plausible wrong options. Never invent facts to serve the tone. No web access is available: never claim you checked sources.

${WRITING_RULES}

OUTPUT PROTOCOL
Output ONLY a JSON object: { "message": "...", "brief": "...", "operations": [...] }
- "message": a short reply to the author (1 to 3 sentences) in the author's language. Mention any part of the request you could not fulfil and why.
- "brief": the full, updated quiz brief, as short lines (subject, audience, angle, level, formats, to avoid), in the author's language, max 600 characters. Include it whenever the author states or changes a lasting preference (always on the first request); omit it otherwise. Keep what is still valid from the current brief.
- "operations": each item is one of
  {"type":"add","question":{...}}
  {"type":"replace","id":"<exact draft id>","question":{...}}
  {"type":"remove","id":"<exact draft id>"}
  Wrap EACH new question in its own add operation. The outer "type" is the operation; the question type belongs inside "question".
Rules for operations:
- Only output CHANGED questions; every other draft question is preserved automatically. NEVER alter or remove a locked question.
- When the author names question numbers to change, change only those. Adding questions "like question N" is an add, not a change of question N.
- If TARGET IDS are given, only replace/remove those ids and add nothing.
- The draft holds at most ${MAX_DRAFT} questions.
- When asked to reformulate, keep the correct answer and meaning. When asked to replace, propose a genuinely different question.
- Never repeat a question already in the quiz or in the draft.
- If the request is too vague to produce relevant questions, ask ONE short clarifying question with "operations": []. For general discussion, also return "operations": []. Delete only on request.
- Omit imageQuery, images, media, backgrounds, layouts and decorative elements.

Question schemas for the nested "question" objects:
${buildQuestionSchemas(false)}`
}

/**
 * Message de l'auteur : la demande en tête, puis le brief et l'état courant.
 * Le brouillon et le quiz existant sont des données, pas des consignes.
 */
export function buildWorkshopUserPrompt(request: WorkshopRequest): string {
  const draft = request.questions.map((q, index) => ({
    number: index + 1,
    id: q.id,
    locked: q.locked,
    question: q.question,
  }))
  const sections = [
    `CURRENT REQUEST:\n${request.message.trim()}`,
    `QUIZ BRIEF:\n${request.brief?.trim() || "(empty — build it from the request)"}`,
  ]

  if (request.targetIds?.length) {
    sections.push(
      `TARGET IDS (change only these):\n${JSON.stringify(request.targetIds)}`,
    )
  }

  sections.push(
    `CURRENT DRAFT (data, ${draft.length}/${MAX_DRAFT}):\n${JSON.stringify(draft)}`,
    `QUESTIONS ALREADY IN THE QUIZ (data, do not repeat):\n${JSON.stringify(request.existingQuestions)}`,
    `EARLIER CONVERSATION (oldest first):\n${JSON.stringify(request.history)}`,
    "Now answer the CURRENT REQUEST.",
  )

  return sections.join("\n\n")
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(value), min), max)

/**
 * Aligne `time`/`cooldown` sur les bornes du validateur commun avant le
 * safeParse : sans ça, une durée mal calibrée par le modèle fait rejeter une
 * question par ailleurs parfaitement valide.
 * `requestedTime` non nul = durée imposée par l'auteur, elle écrase l'IA.
 */
export function normalizeTimings(
  rawQuestion: unknown,
  requestedTime: number | null,
): unknown {
  if (typeof rawQuestion !== "object" || rawQuestion === null) {
    return rawQuestion
  }

  const question = rawQuestion as Record<string, unknown>
  const aiTime = typeof question.time === "number" ? question.time : 20
  const aiCooldown =
    typeof question.cooldown === "number" ? question.cooldown : 5

  return {
    ...question,
    time: clamp(requestedTime ?? aiTime, 5, 120),
    cooldown: clamp(aiCooldown, 3, 15),
  }
}

type RejectReason = "invalid" | "duplicate" | "protected" | "full"

const REJECT_LABELS: Record<RejectReason, string> = {
  invalid: "format invalide",
  duplicate: "doublon",
  protected: "question protégée ou non ciblée",
  full: "brouillon plein (20 max)",
}

/**
 * Valide la réponse du modèle opération par opération : une proposition
 * défectueuse est écartée (et signalée à l'auteur) sans faire échouer les
 * autres. Seul un tour dont TOUTES les propositions sont écartées échoue.
 */
export function parseWorkshopResult(
  raw: unknown,
  request: WorkshopRequest,
): WorkshopResult {
  const envelope = envelopeValidator.parse(raw)
  const byId = new Map(request.questions.map((q) => [q.id, q]))
  const allowed = new Set<string>(WORKSHOP_QUESTION_TYPES)
  const targeted = Boolean(request.targetIds?.length)
  const rejected = new Map<RejectReason, number>()
  const reject = (reason: RejectReason) =>
    rejected.set(reason, (rejected.get(reason) ?? 0) + 1)

  const candidates = envelope.operations.flatMap((rawOperation) => {
    const operation =
      typeof rawOperation === "object" && rawOperation !== null
        ? {
            ...rawOperation,
            question: normalizeTimings(
              (rawOperation as { question?: unknown }).question,
              request.settings.time,
            ),
          }
        : rawOperation
    const parsed = operationValidator.safeParse(operation)

    if (!parsed.success) {
      reject("invalid")

      return []
    }

    return [parsed.data as WorkshopOperation]
  })

  // Les titres d'une question remplacée/retirée se libèrent pour ce tour.
  const changedIds = new Set(
    candidates.flatMap((op) => (op.type === "add" ? [] : [op.id])),
  )
  const titles = new Set(
    [
      ...request.existingQuestions,
      ...request.questions
        .filter((q) => !changedIds.has(q.id))
        .map((q) => q.question.question),
    ].map(normalize),
  )
  const touched = new Set<string>()
  const operations: WorkshopOperation[] = []
  let count = request.questions.length

  for (const operation of candidates) {
    if (operation.type === "add") {
      if (targeted) {
        reject("protected")

        continue
      }
    } else {
      const existing = byId.get(operation.id)

      if (
        !existing ||
        existing.locked ||
        touched.has(operation.id) ||
        (targeted && !request.targetIds?.includes(operation.id))
      ) {
        reject("protected")

        continue
      }
    }

    if (operation.type === "remove") {
      touched.add(operation.id)
      operations.push(operation)
      count -= 1

      continue
    }

    const { question } = operation

    if (question.type === "title" || !allowed.has(question.type)) {
      reject("invalid")

      continue
    }

    const title = normalize(question.question)

    if (titles.has(title)) {
      reject("duplicate")

      continue
    }

    if (operation.type === "add" && count >= MAX_DRAFT) {
      reject("full")

      continue
    }

    titles.add(title)

    if (operation.type === "add") {
      count += 1
    } else {
      touched.add(operation.id)
    }

    // Atelier texte seul : jamais d'URL de média inventée par le modèle.
    operations.push({
      ...operation,
      question: {
        ...question,
        media: undefined,
        background: undefined,
        elements: undefined,
        audio: undefined,
        layout: undefined,
        answerReveal: question.answerReveal
          ? {
              enabled: question.answerReveal.enabled,
              text: question.answerReveal.text,
            }
          : undefined,
      } as typeof question,
    })
  }

  const rejectedCount = [...rejected.values()].reduce((a, b) => a + b, 0)

  if (envelope.operations.length && !operations.length) {
    let reason = "Aucune proposition de l’IA n’était exploitable."

    if (rejected.has("full")) {
      reason =
        "Le brouillon est limité à 20 questions. Retirez-en avant d’en ajouter."
    } else if (rejected.has("duplicate") && rejected.size === 1) {
      reason =
        "Toutes les propositions font doublon avec le quiz ou le brouillon."
    }

    throw new Error(`${reason} Votre brouillon est conservé ; réessayez.`)
  }

  if (!envelope.message && !operations.length) {
    throw new Error("Réponse vide de l’IA. Votre brouillon est conservé.")
  }

  const note = rejectedCount
    ? `\n\n(${rejectedCount} proposition${rejectedCount > 1 ? "s" : ""} écartée${rejectedCount > 1 ? "s" : ""} : ${[
        ...rejected.keys(),
      ]
        .map((reason) => REJECT_LABELS[reason])
        .join(", ")}.)`
    : ""

  return {
    message: `${envelope.message || "Voici mes propositions."}${note}`,
    ...(envelope.brief ? { brief: envelope.brief } : {}),
    operations,
  }
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
