import type { QuestionDifficulty } from "@rahoot/common/types/game"
import {
  distributeDifficulties,
  type DifficultySlice,
} from "@rahoot/common/utils/difficulty"

// Catalogue des registres de ton proposés dans la modale de génération.
// Volontairement sobres : les consignes « witty / humour » poussaient le modèle
// vers des tournures forcées et des calembours laborieux. Le ton colore la
// formulation, il ne doit jamais la rendre plus longue ni moins claire.
const TONE_INSTRUCTIONS: Record<string, string> = {
  fun: `Friendly, relaxed and lively, like a good pub-quiz host. Short, natural sentences. Humor only when it comes naturally — no forced puns, no "Accrochez-vous !", no exclamation overload, no emojis.`,

  neutral: `Neutral, factual and precise. Phrase questions plainly and directly, with no humor, no dramatization and no rhetorical flourish. Clarity above all.`,

  educational: `Warm and pedagogical, like a teacher who wants players to actually learn something. Give just enough context in the question for it to be instructive on its own, without giving the answer away.`,

  snarky: `Cheeky and slightly provocative, teasing the player without ever being insulting. Sharp, punchy phrasing with a hint of irony — at most one short teasing clause per question.`,

  epic: `An epic, dramatic, grandiloquent tone, like a movie trailer voice-over. Solemn phrasing and high stakes, while staying short and perfectly readable.`,

  absurd: `Absurd, offbeat, deadpan-surreal in the PHRASING only. The framing may be delightfully weird, but the facts, options and answers must remain strictly accurate and verifiable.`,
}

// Règles de rédaction : c'est ce qui manquait le plus. Sans elles, le modèle
// écrit comme une traduction de l'anglais (« Lequel des éléments suivants… »)
// et privilégie la trivia scolaire sans intérêt.
const WRITING_RULES = `Writing quality — this matters more than anything else:
- Write like a professional quiz author who is a NATIVE speaker of the output language (TV quiz show, pub quiz). Idiomatic, natural sentences — never a word-for-word translation from English.
- One clear question per item, ideally under 100 characters, ending with "?". For "true_false", write a plain affirmative statement (no "?", no "Vrai ou faux :").
- Each question has exactly ONE indisputable answer that a reliable source confirms. No opinions, no vague superlatives ("le meilleur", "le plus célèbre"), no facts that may have changed recently.
- Forbidden phrasings: "Which of the following…", "Lequel des éléments suivants…", "Parmi les propositions suivantes…", "Selon vous…", "Saviez-vous que…", "Pouvez-vous…", double negations, rhetorical preambles before the actual question.
- Only use facts you are highly confident about. Be especially wary of absolute claims ("le seul", "jamais", "toujours", "le premier") and popular myths: if in doubt, choose another fact.
- Never leak the answer in the question (no shared rare word, no obvious hint).
- Pick facts players ENJOY discovering — surprising, concrete, memorable — over dry textbook trivia. A good question makes the room react, yet stays fair.
- MCQ options: same category, same format, similar length, short (1 to 5 words). No "Toutes ces réponses" / "Aucune", no joke option. Vary the position of the correct answer across questions.
- Open answers: expect one short answer (1 to 3 words); list the usual spellings and variants in "correctAnswers".
- Slider / date: choose a quantity people can reasonably estimate; min/max frame the answer without centering on it; tolerance around 5 to 10 % of the range.
- Puzzle: exactly 4 items with an objective order (chronology, size, distance…); state the ordering criterion explicitly in the question.
- True/false: mix true and false statements; false ones must be credible, never absurd.

Examples (French):
BAD:  "Lequel des éléments suivants est la capitale de l'Australie ?"
GOOD: "Quelle est la capitale de l'Australie ?"
BAD:  "Selon vous, quel animal est réputé pour être le plus rapide sur la terre ferme ?"
GOOD: "Quel est l'animal terrestre le plus rapide ?"
BAD:  "Accrochez-vous : quelle planète, véritable reine aux anneaux, ferait des ronds dans l'eau ?"
GOOD: "Quelle planète du Système solaire flotterait sur l'eau ?"

Before answering, silently review every question against these rules and rewrite any that breaks one.`

const IMAGE_RULES = `Every question MUST also carry an "imageQuery" field: 2 to 4 ENGLISH keywords for a stock-photo search (Unsplash) that illustrates the question with a concrete, photographable subject (e.g. "cheetah running savanna", "saturn rings space"). The picture must NEVER show or give away the correct answer: illustrate the context, not the solution (for "Quelle est la capitale de l'Australie ?" use "australia outback kangaroo", not "canberra").`

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

${WRITING_RULES}

Tone:
${tone}
Whatever the tone, the CONTENT stays serious: accurate facts, plausible wrong options, valid scientific, historical or cultural background. Never invent facts to serve the tone.

${buildDifficultySection(slices)}

${buildTimingSection(params.time)}

${buildExplanationsSection(params.withExplanations)}
${extra ? `\nAdditional instructions from the quiz author (follow them closely):\n${extra}\n` : ``}
Avoid near-duplicate questions: each one must cover a distinct angle of the topic.

${IMAGE_RULES}

The output MUST be a valid JSON object shaped like:
{ "description": "...", "questions": [ ... ] }

Every object inside "questions" must strictly conform to one of the following schemas:

1. MCQ ("mcq"):
   {
     "type": "mcq",
     "difficulty": "easy",
     "question": "The question text",
     "imageQuery": "english keywords",
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
     "imageQuery": "english keywords",
     "solution": 0, // 0 for False, 1 for True
     "cooldown": 5,
     "time": 20
   }

3. Open Answer ("open"):
   {
     "type": "open",
     "difficulty": "medium",
     "question": "The question text",
     "imageQuery": "english keywords",
     "correctAnswers": ["answer1", "answer2"], // Array of acceptable short string answers (lowercase preferred)
     "cooldown": 5,
     "time": 20
   }

4. Slider ("slider"):
   {
     "type": "slider",
     "difficulty": "medium",
     "question": "The question requesting a numerical value",
     "imageQuery": "english keywords",
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
     "imageQuery": "english keywords",
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
     "imageQuery": "english keywords",
     "items": ["Item 1 (First)", "Item 2 (Second)", "Item 3 (Third)", "Item 4 (Fourth)"], // Elements in their CORRECT final order
     "cooldown": 5,
     "time": 20
   }
`
}
