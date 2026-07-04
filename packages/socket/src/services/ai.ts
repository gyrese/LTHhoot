import { GoogleGenAI } from "@google/genai"
import { questionValidator } from "@rahoot/common/validators/quizz"
import type { Question } from "@rahoot/common/types/game"

export class AIService {
  private static genAI: GoogleGenAI | null = null

  private static getClient(): GoogleGenAI {
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY

      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured on the server")
      }

      this.genAI = new GoogleGenAI({ apiKey })
    }

    return this.genAI
  }

  /**
   * Generates quiz questions using Gemini 2.5 Flash.
   */
  public static async generateQuestions(params: {
    prompt: string
    count: number
    questionTypes: string[]
    level: string
  }): Promise<Question[]> {
    const client = this.getClient()
    
    // Constructing a detailed prompt for Gemini
    const systemInstruction = `You are a fun, cool, and engaging quiz generator. Your task is to output a JSON array containing exactly ${params.count} quiz questions about the topic: "${params.prompt}".
The target audience or difficulty level is: "${params.level}".
Only generate questions of the following types: ${params.questionTypes.join(", ")}.

Ensure that the questions, options, and explanations are written in the same language as the prompt (French if the prompt is in French).

Tone and Style Guidelines:
- Adopt a cool, fun, and dynamic tone. The questions should be modern, entertaining, and lighthearted, avoiding dry, pedantic, or overly academic phrasing.
- Keep the questions serious on the facts and content (accurate facts, plausible incorrect options, valid scientific/historical/cultural background).
- Add interesting context, subtle humor, or a witty spin where appropriate.
- (En français si applicable) : Adopte un ton cool, sympa et dynamique. Évite les formulations trop scolaires, austères ou poussiéreuses. Le contenu doit rester exact et intéressant (pas de fausses réponses absurdes), mais avec une tournure de phrase moderne, engageante et parfois amusante.

The output MUST be a valid JSON array of question objects. Every object must strictly conform to one of the following schemas:

1. MCQ ("mcq"):
   {
     "type": "mcq",
     "question": "The question text",
     "answers": ["Option A", "Option B", "Option C", "Option D"], // Between 2 and 4 strings. Must not be empty.
     "solutions": [0], // Array of correct answer index/indices (0-indexed)
     "cooldown": 5,
     "time": 20
   }

2. True/False ("true_false"):
   {
     "type": "true_false",
     "question": "The statement text",
     "solution": 0, // 0 for False, 1 for True
     "cooldown": 5,
     "time": 20
   }

3. Open Answer ("open"):
   {
     "type": "open",
     "question": "The question text",
     "correctAnswers": ["answer1", "answer2"], // Array of acceptable short string answers (lowercase preferred)
     "cooldown": 5,
     "time": 20
   }

4. Slider ("slider"):
   {
     "type": "slider",
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
     "question": "The question text instructing to order elements",
     "items": ["Item 1 (First)", "Item 2 (Second)", "Item 3 (Third)", "Item 4 (Fourth)"], // Elements in their CORRECT final order
     "cooldown": 5,
     "time": 20
   }
`

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

      if (!Array.isArray(parsed)) {
        throw new Error("Gemini response is not a JSON array")
      }

      // Validate each question using the common Zod validator
      const validatedQuestions: Question[] = []
      for (const rawQuestion of parsed) {
        // Run Zod validator
        const parseResult = questionValidator.safeParse(rawQuestion)

        if (parseResult.success) {
          validatedQuestions.push(parseResult.data as Question)
        } else {
          console.warn(
            "AI generated an invalid question object:",
            JSON.stringify(rawQuestion),
            "Errors:",
            parseResult.error.format()
          )
        }
      }

      if (validatedQuestions.length === 0) {
        throw new Error("None of the AI-generated questions matched the validation schema")
      }

      return validatedQuestions
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
        throw new Error("Gemini response missing a valid 'wrongAnswers' array of 3 strings")
      }

      return wrongAnswers
    } catch (error) {
      console.error("Error in AIService.generateWrongAnswers:", error)
      throw error
    }
  }
}
