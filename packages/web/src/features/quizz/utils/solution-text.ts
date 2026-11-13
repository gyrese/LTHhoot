import type { Question } from "@rahoot/common/types/game"

// Bonne réponse lisible d'une question, transmise à l'IA pour rédiger son
// explication. `undefined` si la question n'a pas de solution exploitable.
export const getSolutionText = (q: Question): string | undefined => {
  if (q.type === "mcq") {
    const solutions = Array.isArray(q.solutions) ? q.solutions : []

    return solutions
      .map((i) => q.answers?.[i])
      .filter((a): a is string => Boolean(a && a.trim()))
      .join(", ")
  }

  if (q.type === "true_false") {
    return q.solution === 0 ? "Vrai" : "Faux"
  }

  if (q.type === "open") {
    return q.correctAnswers?.filter(Boolean).join(", ")
  }

  if (q.type === "date") {
    return q.correctYear !== undefined ? String(q.correctYear) : undefined
  }

  if (q.type === "slider") {
    return q.correctValue !== undefined ? String(q.correctValue) : undefined
  }

  if (q.type === "puzzle") {
    return q.items?.filter(Boolean).join(" -> ")
  }

  if (q.type === "drop_pin") {
    return q.zones
      ?.filter((z) => z.isCorrect)
      .map((z) => z.label)
      .filter(Boolean)
      .join(", ")
  }

  if (q.type === "image_sequence") {
    return q.correctAnswers?.filter(Boolean).join(", ")
  }

  if (q.type === "grid") {
    return q.correctIndexes
      ?.map((i) => q.cells?.[i]?.label || `Case ${i + 1}`)
      .join(", ")
  }

  return undefined
}
