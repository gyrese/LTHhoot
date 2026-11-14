import { GoogleGenAI, ThinkingLevel } from "@google/genai"
import { AI_TIMEOUT_MS, withTimeout } from "@rahoot/socket/utils/timeout"
import type { Question } from "@rahoot/common/types/game"
import type {
  WorkshopOperation,
  WorkshopRequest,
  WorkshopResult,
  WorkshopStage,
} from "@rahoot/common/validators/ai-workshop"
import {
  applyReview,
  buildReviewSystemPrompt,
  buildReviewUserPrompt,
  reviewCandidates,
  withoutReview,
  type ReviewedWorkshop,
} from "./ai-review"
import { buildExplanationsPrompt, parseExplanations } from "./ai-explanations"
import type { ExplanationsRequest } from "@rahoot/common/validators/ai-explanations"
import {
  buildWorkshopSystemPrompt,
  buildWorkshopUserPrompt,
  parseWorkshopResult,
} from "./ai-workshop"
import {
  isUnsplashConfigured,
  searchUnsplash,
} from "@rahoot/socket/services/unsplash"

// Surchargeable par variable d'env pour tester un modèle plus capable
// sans redéployer de code. 3.8-flash : nettement meilleur que 2.5-flash sur la
// justesse des faits et l'intérêt des questions, pour une latence similaire.
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash"

// Réflexion de l'atelier : par défaut, celle du modèle. Mesuré le 2026-11-13
// (8 questions) : LOW ≈ 12-15 s mais une date fausse et des questions plus
// banales ; MEDIUM et défaut ≈ 27-38 s sans erreur relevée. L'exactitude
// prime. Surchargeable (MINIMAL, LOW, MEDIUM, HIGH) sans redéployer.
const WORKSHOP_THINKING =
  process.env.GEMINI_WORKSHOP_THINKING?.toUpperCase() as
    | ThinkingLevel
    | undefined

// Relecture des faits (2e appel). MEDIUM : ~20 s pour 8 questions, attrape
// les erreurs que LOW laisse passer. `GEMINI_WORKSHOP_REVIEW=off` la coupe.
const REVIEW_THINKING =
  (process.env.GEMINI_REVIEW_THINKING?.toUpperCase() as ThinkingLevel) ||
  ThinkingLevel.MEDIUM
const REVIEW_ENABLED = process.env.GEMINI_WORKSHOP_REVIEW !== "off"

export class AIService {
  private static genAI: GoogleGenAI | null = null

  public static async workshop(
    request: WorkshopRequest,
    onProgress: (_stage: WorkshopStage) => void = () => undefined,
  ): Promise<WorkshopResult> {
    onProgress("writing")
    const response = await withTimeout(
      this.getClient().models.generateContent({
        model: TEXT_MODEL,
        contents: buildWorkshopUserPrompt(request),
        config: {
          systemInstruction: buildWorkshopSystemPrompt(request),
          ...(WORKSHOP_THINKING
            ? { thinkingConfig: { thinkingLevel: WORKSHOP_THINKING } }
            : {}),
          responseMimeType: "application/json",
          temperature: 0.6,
          maxOutputTokens: 16000,
        },
      }),
      AI_TIMEOUT_MS,
    )

    const draft = parseWorkshopResult(
      JSON.parse(response.text || "{}"),
      request,
    )
    const candidates = reviewCandidates(draft)

    if (!candidates.length) {
      return withoutReview(draft, false)
    }

    if (!REVIEW_ENABLED) {
      return withoutReview(draft, false)
    }

    onProgress("reviewing")

    try {
      const review = await withTimeout(
        this.getClient().models.generateContent({
          model: TEXT_MODEL,
          contents: buildReviewUserPrompt(request, candidates),
          config: {
            systemInstruction: buildReviewSystemPrompt(),
            thinkingConfig: { thinkingLevel: REVIEW_THINKING },
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 16000,
          },
        }),
        AI_TIMEOUT_MS,
      )

      return await this.illustrate(
        applyReview(JSON.parse(review.text || "{}"), draft, request),
      )
    } catch (error) {
      // Une relecture ratée ne doit jamais faire perdre le tour.
      console.warn("AI workshop review failed, delivering unreviewed:", error)

      return withoutReview(draft)
    }
  }

  private static getClient(): GoogleGenAI {
    if (!this.genAI) {
      const apiKey =
        process.env.GEMINI_TEXT_API_KEY || process.env.GEMINI_API_KEY

      if (!apiKey) {
        throw new Error(
          "Neither GEMINI_TEXT_API_KEY nor GEMINI_API_KEY is configured on the server",
        )
      }

      this.genAI = new GoogleGenAI({ apiKey })
    }

    return this.genAI
  }

  /**
   * Illustre chaque question avec une photo Unsplash en fond de slide, à partir
   * des mots-clés proposés par le modèle. Best-effort : sans clé Unsplash, ou si
   * une recherche échoue / ne renvoie rien, la question reste sans image.
   */
  /**
   * Ajoute une photo Unsplash en fond de chaque question relue, d'après les
   * mots-clés de la relecture. Best-effort : sans photo, la question reste
   * telle quelle.
   */
  private static async illustrate({
    imageQueries,
    ...result
  }: ReviewedWorkshop): Promise<WorkshopResult> {
    const targets = result.operations.flatMap((operation, index) =>
      operation.type === "remove"
        ? []
        : [{ index, operation, query: imageQueries[index] }],
    )
    const questions = await this.attachImages(
      targets.map(({ operation }) => operation.question as Question),
      targets.map(({ query }) => query),
    )
    const operations = [...result.operations]

    targets.forEach(({ index, operation }, position) => {
      operations[index] = {
        ...operation,
        question: questions[position],
      } as WorkshopOperation
    })

    return { ...result, operations }
  }

  private static async attachImages(
    questions: Question[],
    imageQueries: (string | undefined)[],
  ): Promise<Question[]> {
    if (!isUnsplashConfigured()) {
      return questions
    }

    const usedUrls = new Set<string>()
    const candidates = await Promise.all(
      imageQueries.map(async (query) => {
        if (!query) {
          return []
        }

        try {
          return await searchUnsplash(query, { perPage: 5, landscape: true })
        } catch (error) {
          console.warn(`Unsplash search failed for "${query}":`, error)

          return []
        }
      }),
    )

    return questions.map((question, index) => {
      // Premier résultat pas encore utilisé : deux questions proches ne
      // partagent pas la même photo.
      const photo = candidates[index].find(({ url }) => !usedUrls.has(url))

      if (!photo) {
        return question
      }

      usedUrls.add(photo.url)

      return { ...question, background: { type: "image", value: photo.url } }
    })
  }

  /**
   * Reformule une question existante (même sens, même langue, ton plus vif).
   */
  public static async rephraseQuestion(currentText: string): Promise<string> {
    const client = this.getClient()

    const systemInstruction = `You are a professional quiz author and a native speaker of the question's language. Rewrite the following quiz question so it reads naturally, like on a TV quiz show: same meaning, same language, same answer, shorter or equally short. No "Lequel des éléments suivants", no "Selon vous", no forced jokes or preambles.

Question to reformulate: "${currentText}"

Output MUST be a valid JSON object: { "rephrased": "the reformulated question text" }`

    try {
      const response = await withTimeout(
        client.models.generateContent({
          model: TEXT_MODEL,
          contents: systemInstruction,
          config: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        }),
        AI_TIMEOUT_MS,
      )

      const { text } = response

      if (!text) {
        throw new Error("Empty response received from Gemini")
      }

      const parsed = JSON.parse(text)

      if (typeof parsed.rephrased !== "string" || !parsed.rephrased.trim()) {
        throw new Error("Gemini response missing a valid 'rephrased' string")
      }

      return parsed.rephrased
    } catch (error) {
      console.error("Error in AIService.rephraseQuestion:", error)
      throw error
    }
  }

  /**
   * Génère 3 mauvaises réponses plausibles pour une bonne réponse donnée.
   */
  public static async generateWrongAnswers(
    correctAnswer: string,
    questionContext: string,
  ): Promise<string[]> {
    const client = this.getClient()

    const systemInstruction = `You are a fun, cool quiz question writer. Given a quiz question and its correct answer, generate exactly 3 plausible but INCORRECT answer options, in the same language as the question.

Question: "${questionContext}"
Correct answer: "${correctAnswer}"

The wrong answers must be plausible, distinct from each other and from the correct answer, and appropriate in tone and difficulty.

Output MUST be a valid JSON object: { "wrongAnswers": ["wrong 1", "wrong 2", "wrong 3"] }`

    try {
      const response = await withTimeout(
        client.models.generateContent({
          model: TEXT_MODEL,
          contents: systemInstruction,
          config: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        }),
        AI_TIMEOUT_MS,
      )

      const { text } = response

      if (!text) {
        throw new Error("Empty response received from Gemini")
      }

      const parsed = JSON.parse(text)
      const { wrongAnswers } = parsed

      if (
        !Array.isArray(wrongAnswers) ||
        wrongAnswers.length !== 3 ||
        !wrongAnswers.every((a: unknown) => typeof a === "string" && a.trim())
      ) {
        throw new Error(
          "Gemini response missing a valid 'wrongAnswers' array of 3 strings",
        )
      }

      return wrongAnswers
    } catch (error) {
      console.error("Error in AIService.generateWrongAnswers:", error)
      throw error
    }
  }

  /**
   * Génère une explication claire et concise de la réponse.
   */
  public static async generateExplanation(
    question: string,
    solutionText?: string,
  ): Promise<string> {
    const client = this.getClient()

    const systemInstruction = `You are a fun, engaging, and clear quiz explanation writer.
Given a quiz question and its correct answer/solution, write a concise (1 to 2 sentences) explanation explaining WHY the answer is correct, adding an interesting or memorable detail, in the exact same language as the question.

Question: "${question}"
${solutionText ? `Correct answer / Solution: "${solutionText}"` : ""}

Output MUST be a valid JSON object: { "explanation": "the explanation text" }`

    try {
      const response = await withTimeout(
        client.models.generateContent({
          model: TEXT_MODEL,
          contents: systemInstruction,
          config: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
        AI_TIMEOUT_MS,
      )

      const { text } = response

      if (!text) {
        throw new Error("Empty response received from Gemini")
      }

      const parsed = JSON.parse(text)

      if (
        typeof parsed.explanation !== "string" ||
        !parsed.explanation.trim()
      ) {
        throw new Error("Gemini response missing a valid 'explanation' string")
      }

      return parsed.explanation
    } catch (error) {
      console.error("Error in AIService.generateExplanation:", error)
      throw error
    }
  }

  /**
   * Génère l'explication de plusieurs questions en un seul appel (une entrée
   * par question, dans l'ordre ; chaîne vide si l'IA n'a rien produit).
   */
  public static async generateExplanations(
    items: ExplanationsRequest["items"],
  ): Promise<string[]> {
    const client = this.getClient()

    const response = await withTimeout(
      client.models.generateContent({
        model: TEXT_MODEL,
        contents: buildExplanationsPrompt(items),
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
      AI_TIMEOUT_MS,
    )

    if (!response.text) {
      throw new Error("Empty response received from Gemini")
    }

    return parseExplanations(response.text, items.length)
  }
}
