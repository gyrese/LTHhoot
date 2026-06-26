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
    const systemInstruction = `You are a professional quiz generator. Your task is to output a JSON array containing exactly ${params.count} quiz questions about the topic: "${params.prompt}".
The target audience or difficulty level is: "${params.level}".
Only generate questions of the following types: ${params.questionTypes.join(", ")}.

Ensure that the questions, options, and explanations are written in the same language as the prompt (French if the prompt is in French).

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

      const text = response.text
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
}
