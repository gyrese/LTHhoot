import type { ExplanationsRequest } from "@rahoot/common/validators/ai-explanations"

// Prompt et lecture de la réponse pour générer les explications de plusieurs
// questions en un seul appel. Isolés du client Gemini pour être testables.

export const buildExplanationsPrompt = (
  items: ExplanationsRequest["items"],
): string => {
  const list = items
    .map((item, index) =>
      JSON.stringify({
        index,
        question: item.question,
        ...(item.solutionText ? { correctAnswer: item.solutionText } : {}),
      }),
    )
    .join("\n")

  return `You are a fun, engaging, and clear quiz explanation writer.
For EACH quiz question below, write a concise (1 to 2 sentences) explanation of WHY the correct answer is correct, adding an interesting or memorable detail. Write each explanation in the exact same language as its question. Never invent a different answer than the one given.

Questions (one JSON object per line):
${list}

Output MUST be a valid JSON object with exactly ${items.length} entries, in the same order as the questions:
{ "explanations": ["explanation for question 0", "explanation for question 1", ...] }`
}

export const parseExplanations = (text: string, count: number): string[] => {
  const parsed: unknown = JSON.parse(text)
  const list =
    parsed && typeof parsed === "object" && "explanations" in parsed
      ? parsed.explanations
      : undefined

  if (!Array.isArray(list) || list.length !== count) {
    throw new Error("Gemini response has an unexpected number of explanations")
  }

  return list.map((entry) => (typeof entry === "string" ? entry.trim() : ""))
}
