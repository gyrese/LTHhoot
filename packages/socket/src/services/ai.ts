import { GoogleGenAI } from "@google/genai"
import { questionValidator } from "@rahoot/common/validators/quizz"
import type { Question, QuestionDifficulty } from "@rahoot/common/types/game"
import { buildGenerationPrompt } from "@rahoot/socket/services/ai-prompt"

export class AIService {
  private static genAI: GoogleGenAI | null = null

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

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.round(value), min), max)
  }

  /**
   * Aligne `time`/`cooldown` sur les bornes du validateur commun avant le
   * safeParse : sans ça, une durée mal calibrée par le modèle fait rejeter une
   * question par ailleurs parfaitement valide.
   * `requestedTime` non nul = durée imposée par l'auteur, elle écrase l'IA.
   */
  private static normalizeTimings(
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
      time: this.clamp(requestedTime ?? aiTime, 5, 120),
      cooldown: this.clamp(aiCooldown, 3, 15),
    }
  }

  /**
   * Generates quiz questions using Gemini 2.5 Flash.
   */
  public static async generateQuestions(params: {
    prompt: string
    count: number
    questionTypes: string[]
    difficulties: QuestionDifficulty[]
    tone: string
    language: string
    time: number | null
    withExplanations: boolean
    instructions?: string
  }): Promise<{ questions: Question[]; description: string }> {
    const client = this.getClient()

    const systemInstruction = buildGenerationPrompt(params)

    try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemInstruction,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      })

      const { text } = response

      if (!text) {
        throw new Error("Empty response received from Gemini")
      }

      const parsed = JSON.parse(text)

      // Le prompt demande { description, questions }, mais le modèle retombe
      // parfois sur un tableau nu : les deux formes sont acceptées.
      const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions
      const description = Array.isArray(parsed)
        ? ""
        : (parsed?.description ?? "")

      if (!Array.isArray(rawQuestions)) {
        throw new Error("Gemini response has no questions array")
      }

      // Validate each question using the common Zod validator
      const validatedQuestions: Question[] = []
      for (const rawQuestion of rawQuestions) {
        // Run Zod validator
        const parseResult = questionValidator.safeParse(
          this.normalizeTimings(rawQuestion, params.time),
        )

        if (parseResult.success) {
          validatedQuestions.push(parseResult.data as Question)
        } else {
          console.warn(
            "AI generated an invalid question object:",
            JSON.stringify(rawQuestion),
            "Errors:",
            parseResult.error.format(),
          )
        }
      }

      if (validatedQuestions.length === 0) {
        throw new Error(
          "None of the AI-generated questions matched the validation schema",
        )
      }

      return {
        questions: validatedQuestions,
        description: typeof description === "string" ? description.trim() : "",
      }
    } catch (error) {
      console.error("Error in AIService.generateQuestions:", error)
      throw error
    }
  }

  /**
   * Reformule une question existante (même sens, même langue, ton plus vif).
   */
  public static async rephraseQuestion(currentText: string): Promise<string> {
    const client = this.getClient()

    const systemInstruction = `You are a fun, cool quiz question writer. Reformulate the following quiz question, keeping the exact same meaning and the same language, but with a fresher, more engaging phrasing.

Question to reformulate: "${currentText}"

Output MUST be a valid JSON object: { "rephrased": "the reformulated question text" }`

    try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemInstruction,
        config: {
          responseMimeType: "application/json",
          temperature: 0.8,
        },
      })

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
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemInstruction,
        config: {
          responseMimeType: "application/json",
          temperature: 0.8,
        },
      })

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
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemInstruction,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      })

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
}
