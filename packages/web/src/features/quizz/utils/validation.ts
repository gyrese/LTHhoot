import type { Question } from "@rahoot/common/types/game"

export const validateQuestion = (q: Question): string[] => {
  const errors: string[] = []

  if (!q.question || !q.question.trim()) {
    errors.push("Le texte de la question est vide.")
  }

  if (q.type === "mcq") {
    const validAnswers = q.answers?.filter((a) => a.trim().length > 0) || []

    if (validAnswers.length < 2) {
      errors.push("Un QCM requiert au moins 2 propositions de réponse.")
    }

    if (!q.solutions || q.solutions.length === 0) {
      errors.push("Veuillez sélectionner au moins une bonne réponse.")
    }
  } else if (q.type === "true_false") {
    if (q.solution !== 0 && q.solution !== 1) {
      errors.push("Veuillez choisir si la réponse correcte est Vrai ou Faux.")
    }
  } else if (q.type === "open") {
    const validCorrect =
      q.correctAnswers?.filter((a) => a.trim().length > 0) || []

    if (validCorrect.length === 0) {
      errors.push("Veuillez indiquer au moins une réponse textuelle acceptée.")
    }
  } else if (q.type === "slider") {
    if (q.correctValue === undefined || q.correctValue === null) {
      errors.push("Veuillez indiquer la valeur correcte.")
    }

    if (q.min === undefined || q.max === undefined || q.min >= q.max) {
      errors.push("Intervalle de valeurs du curseur invalide (Min >= Max).")
    }
  } else if (q.type === "date") {
    if (q.correctYear === undefined || q.correctYear === null) {
      errors.push("Veuillez indiquer l'année correcte.")
    }

    if (
      q.minYear !== undefined &&
      q.maxYear !== undefined &&
      q.minYear >= q.maxYear
    ) {
      errors.push(
        "Intervalle d'années du curseur temporel invalide (Min >= Max).",
      )
    }
  } else if (q.type === "puzzle") {
    const validItems = q.items?.filter((a) => a.trim().length > 0) || []

    if (validItems.length < 4) {
      errors.push("Un puzzle requiert exactement 4 éléments ordonnés.")
    }
  } else if (q.type === "drop_pin") {
    if (!q.pinImage) {
      errors.push("Veuillez choisir une image d'arrière-plan.")
    }

    if (!q.zones || q.zones.length === 0) {
      errors.push("Veuillez dessiner au moins une zone sur l'image.")
    }
  }

  return errors
}
