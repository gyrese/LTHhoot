import type { Question } from "@rahoot/common/types/game"

/** Résumé lisible de la bonne réponse, pour valider une question d'un coup d'œil. */
export const summarizeAnswer = (question: Question): string => {
  switch (question.type) {
    case "mcq":
      return question.solutions
        .map((index) => question.answers[index])
        .filter(Boolean)
        .join(", ")

    case "true_false":
      return question.solution === 1 ? "Vrai" : "Faux"

    case "open":
      return question.correctAnswers.join(" / ")

    case "slider":
      return `${question.correctValue} (± ${question.tolerance})`

    case "date":
      return `${question.correctYear} (± ${question.tolerance} ans)`

    case "puzzle":
      return question.items.join(" → ")

    default:
      return ""
  }
}

/** Explication de la carte réponse, si la question en porte une. */
export const explanationOf = (question: Question): string | undefined =>
  "answerReveal" in question ? question.answerReveal?.text : undefined
