import type { QuestionDifficulty } from "@rahoot/common/types/game"
import {
  distributeDifficulties,
  type DifficultySlice,
} from "@rahoot/common/utils/difficulty"

// Catalogue des registres de ton proposés dans la modale de génération.
// Chaque instruction est bilingue : la variante FR cadre nettement mieux le
// registre quand le quiz est produit en français (cas majoritaire).
const TONE_INSTRUCTIONS: Record<string, string> = {
  fun: `Adopt a cool, fun, dynamic and lighthearted tone. Use modern, entertaining phrasing and avoid dry, pedantic or academic wording. Add subtle humor or a witty spin where appropriate.
(En français : ton cool, sympa et dynamique. Évite les formulations scolaires, austères ou poussiéreuses. Tournures modernes, engageantes et parfois amusantes.)`,

  neutral: `Adopt a neutral, factual and precise tone. Phrase questions plainly and directly, with no humor, no dramatization and no rhetorical flourish. Clarity above all.
(En français : ton neutre, factuel et précis. Formulations sobres et directes, sans humour ni effet de style.)`,

  educational: `Adopt a warm, pedagogical tone, like a teacher who wants players to actually learn something. Give just enough context in the question for it to be instructive on its own, without giving the answer away.
(En français : ton pédagogique et bienveillant. Apporte un petit contexte instructif dans la question, sans jamais divulguer la réponse.)`,

  snarky: `Adopt a cheeky, snarky, slightly provocative tone, teasing the player without ever being insulting. Sharp, punchy phrasing with a hint of irony.
(En français : ton piquant, taquin et légèrement provocateur. Chambre le joueur sans jamais être insultant. Formulations courtes, incisives, un brin ironiques.)`,

  epic: `Adopt an epic, dramatic, grandiloquent tone, like a movie trailer voice-over. Solemn phrasing and high stakes, while staying perfectly readable.
(En français : ton épique et dramatique, façon bande-annonce de film. Formulations solennelles et enjeux dramatisés, tout en restant lisible.)`,

  absurd: `Adopt an absurd, offbeat, deadpan-surreal tone in the PHRASING of the questions. The framing may be delightfully weird, but the facts, options and answers must remain strictly accurate and verifiable.
(En français : ton absurde et décalé dans la FORMULATION uniquement. Les faits, les options et les réponses restent rigoureusement exacts et vérifiables.)`,
}

const DEFAULT_TONE = "fun"

const DIFFICULTY_INSTRUCTIONS: Record<QuestionDifficulty, string> = {
  easy: `general public, common knowledge; the answer comes to mind almost instantly and the wrong options are clearly distinguishable`,
  medium: `solid general knowledge; requires a moment of thought, wrong options are credible`,
  hard: `demands real familiarity with the topic; precise facts and close, genuinely tempting distractors`,
  expert: `specialist level; sharp details, dates, figures or little-known facts that only an enthusiast would know`,
}

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  auto: `Write the questions, options and answers in the SAME language as the topic above (French if the topic is written in French).`,
  fr: `Write every question, option and answer in FRENCH, whatever the language of the topic.`,
  en: `Write every question, option and answer in ENGLISH, whatever the language of the topic.`,
}

const buildDifficultySection = (slices: DifficultySlice[]): string => {
  const lines = slices.map(
    ({ difficulty, count }) =>
      `- exactly ${count} question(s) with "difficulty": "${difficulty}" (${DIFFICULTY_INSTRUCTIONS[difficulty]})`,
  )

  const mixNote =
    slices.length > 1
      ? `\nOrder the questions from the easiest level to the hardest, so the quiz ramps up. Keep the TONE identical across all levels: only the required knowledge gets harder, never the writing style.`
      : ``

  return `Difficulty distribution — respect these counts exactly:
${lines.join("\n")}
Every question object MUST carry its "difficulty" field with the matching value.${mixNote}`
}

const buildExplanationsSection = (withExplanations: boolean): string => {
  if (!withExplanations) {
    return `Do NOT include an "answerReveal" field.`
  }

  return `Every question MUST also carry an explanation card:
"answerReveal": { "enabled": true, "text": "..." }
The text explains WHY the answer is correct in 1 to 2 sentences, adds a memorable detail, and follows the same tone and language as the questions. Never merely restate the answer.`
}

const buildTimingSection = (time: number | null): string => {
  if (time === null) {
    return `For each question, set "time" to a duration in seconds that fits its difficulty (easy ≈ 15s, medium ≈ 20s, hard ≈ 30s, expert ≈ 40s; longer for questions with a lot to read). Always set "cooldown" to 5.`
  }

  return `For every question, set "time" to exactly ${time} and "cooldown" to exactly 5.`
}

export const buildGenerationPrompt = (params: {
  prompt: string
  count: number
  questionTypes: string[]
  difficulties: readonly QuestionDifficulty[]
  tone: string
  language: string
  time: number | null
  withExplanations: boolean
  instructions?: string
}): string => {
  const tone = TONE_INSTRUCTIONS[params.tone] ?? TONE_INSTRUCTIONS[DEFAULT_TONE]
  const language =
    LANGUAGE_INSTRUCTIONS[params.language] ?? LANGUAGE_INSTRUCTIONS.auto
  const slices = distributeDifficulties(params.count, params.difficulties)
  const extra = params.instructions?.trim()

  return `You are a quiz generator. Output a JSON object about the topic: "${params.prompt}", containing:
- "description": a short, appealing one-sentence description of the quiz as a whole (max 140 characters), written in the same tone and language as the questions. It presents the quiz to its players — never mention that it was AI-generated.
- "questions": an array of exactly ${params.count} quiz questions.

Only generate questions of the following types: ${params.questionTypes.join(", ")}. Vary the types across the list rather than repeating a single one.

${language}

Tone and style — this is important:
${tone}
Whatever the tone, the CONTENT stays serious: accurate facts, plausible wrong options, valid scientific, historical or cultural background. Never invent facts to serve the tone.

${buildDifficultySection(slices)}

${buildTimingSection(params.time)}

${buildExplanationsSection(params.withExplanations)}
${extra ? `\nAdditional instructions from the quiz author (follow them closely):\n${extra}\n` : ``}
Avoid near-duplicate questions: each one must cover a distinct angle of the topic.

The output MUST be a valid JSON object shaped like:
{ "description": "...", "questions": [ ... ] }

Every object inside "questions" must strictly conform to one of the following schemas:

1. MCQ ("mcq"):
   {
     "type": "mcq",
     "difficulty": "easy",
     "question": "The question text",
     "answers": ["Option A", "Option B", "Option C", "Option D"], // Between 2 and 4 strings. Must not be empty.
     "solutions": [0], // Array of correct answer index/indices (0-indexed)
     "cooldown": 5,
     "time": 20
   }

2. True/False ("true_false"):
   {
     "type": "true_false",
     "difficulty": "easy",
     "question": "The statement text",
     "solution": 0, // 0 for False, 1 for True
     "cooldown": 5,
     "time": 20
   }

3. Open Answer ("open"):
   {
     "type": "open",
     "difficulty": "medium",
     "question": "The question text",
     "correctAnswers": ["answer1", "answer2"], // Array of acceptable short string answers (lowercase preferred)
     "cooldown": 5,
     "time": 20
   }

4. Slider ("slider"):
   {
     "type": "slider",
     "difficulty": "medium",
     "question": "The question requesting a numerical value",
     "correctValue": 42, // The correct number
     "min": 0, // Minimum boundary
     "max": 100, // Maximum boundary
     "tolerance": 2, // Allowed margin of error
     "cooldown": 5,
     "time": 20
   }

5. Date ("date"):
   {
     "type": "date",
     "difficulty": "hard",
     "question": "The question asking for a year",
     "correctYear": 1789, // The correct year (negative for BCE)
     "tolerance": 5, // Allowed margin of error in years
     "minYear": 1700, // Optional
     "maxYear": 1800, // Optional
     "cooldown": 5,
     "time": 20
   }

6. Puzzle ("puzzle"):
   {
     "type": "puzzle",
     "difficulty": "hard",
     "question": "The question text instructing to order elements",
     "items": ["Item 1 (First)", "Item 2 (Second)", "Item 3 (Third)", "Item 4 (Fourth)"], // Elements in their CORRECT final order
     "cooldown": 5,
     "time": 20
   }
`
}
