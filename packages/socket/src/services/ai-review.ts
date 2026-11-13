import { z } from "zod"
import { questionValidator } from "@rahoot/common/validators/quizz"
import {
  WORKSHOP_QUESTION_TYPES,
  type WorkshopOperation,
  type WorkshopRequest,
  type WorkshopResult,
} from "@rahoot/common/validators/ai-workshop"
import { buildQuestionSchemas } from "./ai-prompt"
import {
  normalizeTimings,
  sanitizeQuestion,
  type ParsedWorkshop,
} from "./ai-workshop"

/**
 * Relecture des propositions de l'atelier par un second appel : vérification
 * des faits (garder / corriger / écarter) puis sélection des meilleures.
 * Mesuré le 2026-11-13 : en réflexion MEDIUM, ~20 s pour 8 questions, et elle
 * attrape les erreurs que la rédaction laisse passer (date fausse, mythe
 * présenté comme un fait, option ambiguë).
 */

type ReviewOperation = Extract<WorkshopOperation, { question: unknown }>
type Candidate = { id: string; operation: ReviewOperation }

const reviewValidator = z.object({
  reviews: z
    .array(
      z.object({
        id: z.string(),
        verdict: z.enum(["keep", "fix", "drop"]),
        reason: z.string().max(400).nullish(),
        question: z.unknown().nullish(),
      }),
    )
    .max(60),
  selected: z.array(z.string()).max(60).default([]),
})

// Raisons citées à l'auteur dans le message : au-delà, c'est du bruit.
const MAX_REASONS = 3

export const reviewCandidates = (result: ParsedWorkshop): Candidate[] =>
  result.operations.flatMap((operation, index) =>
    operation.type === "remove"
      ? []
      : [{ id: `c${index + 1}`, operation: operation as ReviewOperation }],
  )

export function buildReviewSystemPrompt(): string {
  return `You are the fact-checker and editor of a live quiz game. Candidate questions were drafted for a quiz author; you decide which ones are good enough to show.

For EVERY candidate, return a verdict:
- "keep": the question, its correct answer AND every wrong option are accurate, and exactly one answer is defensible.
- "fix": a small correction makes it accurate: wrong date, number or name; an over-absolute claim ("le seul", "le premier", "toujours"); ambiguous wording; a "wrong" option that is actually also correct; an answer given away by the question. Return the FULL corrected question in "question", same type and schema, same language.
- "drop": the premise is false, a popular myth, disputed, or something you cannot confirm with high confidence. When in doubt, drop: a wrong answer in front of a room ruins the game.
Give a short "reason" (one sentence, in the author's language) for every fix and drop; null for keep.

Then return "selected": the ids of the kept or fixed candidates, best first. Best means: most relevant to the brief and its audience, most surprising and fun to discover, and together covering varied angles. Leave out candidates that are dull, too well known for the audience, or too close to another one.

If a SOURCE TEXT is given, it is the reference for facts drawn from it.

Output ONLY JSON: {"reviews":[{"id":"c1","verdict":"keep","reason":null,"question":null}],"selected":["c1"]}

Question schemas for corrected questions:
${buildQuestionSchemas(false)}`
}

export function buildReviewUserPrompt(
  request: WorkshopRequest,
  candidates: Candidate[],
): string {
  const sections = [
    `QUIZ BRIEF:\n${request.brief?.trim() || "(none)"}`,
    `AUTHOR REQUEST:\n${request.message.trim()}`,
  ]

  if (request.source?.trim()) {
    sections.push(`SOURCE TEXT (data):\n${request.source.trim()}`)
  }

  sections.push(
    `CANDIDATES (data):\n${JSON.stringify(
      candidates.map(({ id, operation }) => ({ id, ...operation.question })),
    )}`,
  )

  return sections.join("\n\n")
}

const allowed = new Set<string>(WORKSHOP_QUESTION_TYPES)

// Une correction n'est retenue que si elle reste une question valide, du
// même type que l'originale ; sinon le candidat fautif est écarté.
function validCorrection(
  raw: unknown,
  operation: ReviewOperation,
  request: WorkshopRequest,
) {
  const parsed = questionValidator.safeParse(
    normalizeTimings(raw, request.settings.time),
  )

  return parsed.success &&
    parsed.data.type === operation.question.type &&
    allowed.has(parsed.data.type)
    ? parsed.data
    : null
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? "s" : ""}`

/**
 * Applique la relecture. Les candidats écartés disparaissent (un remplacement
 * écarté n'est pas appliqué : la question d'origine reste), les corrections
 * passent le validateur commun, puis on garde les `keep` meilleurs ajouts —
 * dans leur ordre de rédaction, qui suit la montée en difficulté.
 */
export function applyReview(
  raw: unknown,
  result: ParsedWorkshop,
  request: WorkshopRequest,
  random: () => number = Math.random,
): WorkshopResult {
  const review = reviewValidator.parse(raw)
  const candidates = reviewCandidates(result)
  const byId = new Map(review.reviews.map((entry) => [entry.id, entry]))
  const reasons: string[] = []
  let fixed = 0
  let dropped = 0
  const accepted = new Map<string, ReviewOperation>()

  for (const { id, operation } of candidates) {
    const entry = byId.get(id)

    // Candidat oublié par la relecture : on le garde tel quel.
    if (!entry || entry.verdict === "keep") {
      accepted.set(id, operation)

      continue
    }

    const correction =
      entry.verdict === "fix"
        ? validCorrection(entry.question, operation, request)
        : null

    if (correction) {
      fixed += 1
      accepted.set(id, {
        ...operation,
        question: sanitizeQuestion(correction, random),
      } as ReviewOperation)

      if (entry.reason) {
        reasons.push(`corrigée — ${entry.reason}`)
      }

      continue
    }

    dropped += 1

    if (entry.reason) {
      reasons.push(`écartée — ${entry.reason}`)
    }
  }

  // Rang de chaque ajout dans la sélection ; les non classés passent après.
  const rank = new Map(review.selected.map((id, index) => [id, index]))
  const adds = [...accepted.entries()].filter(
    ([, operation]) => operation.type === "add",
  )
  const keep = result.keep ?? adds.length
  const chosen = new Set(
    adds
      .map(([id], index) => ({ id, score: rank.get(id) ?? 1000 + index }))
      .sort((a, b) => a.score - b.score)
      .slice(0, keep)
      .map(({ id }) => id),
  )

  const operations = result.operations.flatMap<WorkshopOperation>(
    (operation, index) => {
      if (operation.type === "remove") {
        return [operation]
      }

      const id = `c${index + 1}`
      const reviewed = accepted.get(id)

      if (!reviewed || (reviewed.type === "add" && !chosen.has(id))) {
        return []
      }

      return [reviewed]
    },
  )

  return {
    message: `${result.message}${reviewNote({
      fixed,
      dropped,
      reasons,
      shortfall: result.keep ? result.keep - chosen.size : 0,
    })}`,
    ...(result.brief ? { brief: result.brief } : {}),
    operations,
  }
}

function reviewNote({
  fixed,
  dropped,
  reasons,
  shortfall,
}: {
  fixed: number
  dropped: number
  reasons: string[]
  shortfall: number
}): string {
  const lines: string[] = []

  if (fixed || dropped) {
    const parts = [
      fixed ? plural(fixed, "correction") : "",
      dropped
        ? `${plural(dropped, "proposition")} écartée${dropped > 1 ? "s" : ""}`
        : "",
    ].filter(Boolean)

    lines.push(`Relecture des faits : ${parts.join(", ")}.`)
    lines.push(...reasons.slice(0, MAX_REASONS).map((reason) => `• ${reason}`))
  }

  if (shortfall > 0) {
    lines.push(
      `${plural(shortfall, "question")} de moins que demandé après relecture : redemande-les si besoin.`,
    )
  }

  return lines.length ? `\n\n${lines.join("\n")}` : ""
}

/**
 * Livraison sans relecture (désactivée, rien à relire, ou relecture en échec) :
 * tronquée au nombre demandé ; en cas d'échec (`warn`), l'auteur est prévenu.
 */
export function withoutReview(
  result: ParsedWorkshop,
  warn = true,
): WorkshopResult {
  let remaining = result.keep ?? Number.POSITIVE_INFINITY
  const operations = result.operations.filter((operation) => {
    if (operation.type !== "add") {
      return true
    }

    remaining -= 1

    return remaining >= 0
  })

  return {
    message: warn
      ? `${result.message}\n\n(Relecture des faits indisponible pour ce tour : vérifie les propositions avant de les ajouter.)`
      : result.message,
    ...(result.brief ? { brief: result.brief } : {}),
    operations,
  }
}
