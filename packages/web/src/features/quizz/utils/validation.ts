import type { Question } from "@rahoot/common/types/game"
import type { ZodIssue } from "zod"
import {
  questionValidator,
  quizzValidator,
} from "@rahoot/common/validators/quizz"

export type EditorIssue = {
  path: string
  questionIndex?: number
  field: string
  message: string
}

const labels: Record<string, string> = {
  subject: "Titre du quiz",
  question: "Énoncé",
  answers: "Réponse",
  solutions: "Bonnes réponses",
  solution: "Bonne réponse",
  correctAnswers: "Réponse acceptée",
  items: "Élément du puzzle",
  images: "Images",
  imageInterval: "Intervalle des images",
  pinImage: "Image à pointer",
  zones: "Zones de réponse",
  cells: "Cases de la grille",
  correctIndexes: "Cases correctes",
  cellsPerRow: "Colonnes",
  min: "Minimum",
  max: "Maximum",
  correctValue: "Valeur correcte",
  correctYear: "Année correcte",
  minYear: "Année minimum",
  maxYear: "Année maximum",
  tolerance: "Tolérance",
  cooldown: "Durée d’affichage",
  time: "Temps de réponse",
  media: "Média",
  audio: "Audio",
  background: "Arrière-plan",
  elements: "Élément visuel",
  layout: "Mise en page",
  fontFamily: "Police",
  backgroundOpacity: "Opacité du fond",
  revealDuration: "Durée de révélation",
  gridCols: "Colonnes de révélation",
  gridRows: "Lignes de révélation",
  pointsMultiplier: "Multiplicateur de points",
  questions: "Diapositives",
  answerReveal: "Correction",
}

export const getEditorIssues = (document: unknown): EditorIssue[] => {
  const result = quizzValidator.safeParse(document)
  if (result.success) {
    return []
  }
  return formatEditorIssues(result.error.issues)
}

const formatEditorIssues = (issues: ZodIssue[]): EditorIssue[] =>
  issues.map((issue) => {
    const questionIndex =
      issue.path[0] === "questions" && typeof issue.path[1] === "number"
        ? issue.path[1]
        : undefined
    const local = questionIndex === undefined ? issue.path : issue.path.slice(2)
    const key = String(local[0] ?? "questions")
    const field =
      (labels[key] ?? "Paramètre") +
      (typeof local[1] === "number" ? ` ${local[1] + 1}` : "")
    let { message } = issue
    const instructions: Record<string, string> = {
      "errors:quizz.subjectEmpty": "Donnez un titre au quiz.",
      "errors:quizz.questionEmpty": "Écrivez l’énoncé de cette question.",
      "errors:quizz.answerEmpty": "Renseignez le texte de cette réponse.",
      "errors:quizz.tooFewAnswers": "Ajoutez au moins deux propositions.",
      "errors:quizz.tooManyAnswers": "Gardez au maximum quatre propositions.",
      "errors:quizz.tooFewCorrectAnswers":
        "Ajoutez au moins une réponse acceptée.",
      "errors:quizz.tooFewImages": "Ajoutez au moins une image à révéler.",
      "errors:quizz.noQuestions": "Ajoutez au moins une diapositive au quiz.",
    }
    if (instructions[message]) {
      message = instructions[message]
    } else if (issue.code !== "custom" && !message.startsWith("errors:")) {
      if (key === "solutions" || key === "correctIndexes") {
        message = "Sélectionnez au moins une bonne réponse valide."
      } else if (key === "pinImage" || key === "images") {
        message = "Ajoutez une image."
      } else if (key === "zones") {
        message = "Ajoutez au moins une zone de réponse."
      } else if (key === "cells" && issue.code === "too_small") {
        message = `Ajoutez au moins ${issue.minimum} cases à la grille.`
      } else if (key === "cells" && issue.code === "too_big") {
        message = `Gardez au maximum ${issue.maximum} cases dans la grille.`
      } else if (
        issue.code === "invalid_type" &&
        ["time", "cooldown", "revealDuration", "imageInterval"].includes(key)
      ) {
        message = "Saisissez une durée en secondes entières."
      } else if (issue.code === "too_small") {
        message = [
          "time",
          "cooldown",
          "revealDuration",
          "imageInterval",
        ].includes(key)
          ? `Choisissez une durée d’au moins ${issue.minimum} secondes.`
          : `Saisissez une valeur supérieure ou égale à ${issue.minimum}.`
      } else if (issue.code === "too_big") {
        message = [
          "time",
          "cooldown",
          "revealDuration",
          "imageInterval",
        ].includes(key)
          ? `Choisissez une durée de ${issue.maximum} secondes maximum.`
          : `Saisissez une valeur inférieure ou égale à ${issue.maximum}.`
      } else {
        message = "Vérifiez la valeur de ce champ."
      }
    }
    return { path: issue.path.join("."), questionIndex, field, message }
  })

const quizMetadataValidator = quizzValidator.omit({ questions: true })

// Editor updates replace modified question objects. Untouched questions reuse
// their validation result; WeakMap entries disappear with discarded objects.
export const createEditorValidator = () => {
  const cache = new WeakMap<object, ZodIssue[]>()
  return (document: unknown): EditorIssue[] => {
    if (
      typeof document !== "object" ||
      document === null ||
      !("questions" in document) ||
      !Array.isArray(document.questions) ||
      document.questions.length === 0
    ) {
      return getEditorIssues(document)
    }
    const metadata = quizMetadataValidator.safeParse(document)
    const issues: ZodIssue[] = metadata.success
      ? []
      : [...metadata.error.issues]
    document.questions.forEach((question: unknown, index: number) => {
      const cacheable = typeof question === "object" && question !== null
      let local = cacheable ? cache.get(question) : undefined
      if (!local) {
        const result = questionValidator.safeParse(question)
        local = result.success ? [] : result.error.issues
        if (cacheable) {
          cache.set(question, local)
        }
      }
      issues.push(
        ...local.map((issue) => ({
          ...issue,
          path: ["questions", index, ...issue.path],
        })),
      )
    })
    return formatEditorIssues(issues)
  }
}

// Same rules for manual save, autosave, thumbnails and the server.
export const validateQuestion = (question: Question): string[] => {
  const result = questionValidator.safeParse(question)
  return result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => issue.message))]
}
