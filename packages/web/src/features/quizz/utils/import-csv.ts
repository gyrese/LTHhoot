/**
 * Utilitaire d'import CSV pour les questions de quiz.
 *
 * FORMAT CSV RETENU
 * ─────────────────
 * En-tête obligatoire (première ligne non vide non commentaire) :
 *   type,question,time,cooldown,answers,correct,correctAnswers,min,max,correctValue,tolerance
 *
 * Séparateur : virgule `,` par défaut ; `;` si aucune virgule n'est détectée dans la 1re ligne.
 * Encoding  : UTF-8 avec BOM géré automatiquement.
 * Guillemets : RFC 4180 — un champ entre guillemets doubles peut contenir des virgules et des
 *              sauts de ligne ; `""` représente un guillemet littéral.
 *
 * Colonnes
 * ────────
 * | Colonne       | Types concernés | Obligatoire | Détail                                              |
 * |---------------|-----------------|-------------|-----------------------------------------------------|
 * | type          | tous            | oui         | `mcq`, `open`, `slider`                             |
 * | question      | tous            | oui         | Texte de la question                                |
 * | time          | tous            | non         | Secondes de réponse (défaut : 20, bornes 5–120)     |
 * | cooldown      | tous            | non         | Secondes d'affichage (défaut : 5, bornes 3–15)      |
 * | answers       | mcq             | oui (mcq)   | Réponses séparées par `|`, ex : `Paris|Lyon|Nice`   |
 * | correct       | mcq             | oui (mcq)   | Indices 0-based séparés par `|`, ex : `0` ou `0|2` |
 * | correctAnswers| open            | oui (open)  | Réponses correctes séparées par `|`                 |
 * | min           | slider          | oui (slider)| Valeur minimum du curseur                           |
 * | max           | slider          | oui (slider)| Valeur maximum du curseur                           |
 * | correctValue  | slider          | oui (slider)| Valeur correcte du curseur                          |
 * | tolerance     | slider          | oui (slider)| Tolérance ± autour de la valeur correcte            |
 *
 * EXEMPLES DE LIGNES
 * ──────────────────
 * mcq,Quelle est la capitale de la France ?,20,5,Paris|Lyon|Marseille|Bordeaux,0
 * open,Quel est le synonyme de "rapide" ?,30,5,,,"vite|rapide|prompt"
 * slider,En quelle année a été fondée Paris ?,20,5,,,,,0,2000,300,50
 */

import type { McqQuestion, OpenQuestion, Question, SliderQuestion } from "@rahoot/common/types/game"

export interface CsvImportResult {
  questions: Question[]
  errors: string[]
}

// ─── Parseur CSV RFC 4180 maison ─────────────────────────────────────────────

function detectSeparator(firstLine: string): string {
  // Si la première ligne contient au moins une virgule on l'utilise, sinon point-virgule
  return firstLine.includes(",") ? "," : ";"
}

function parseRow(line: string, sep: string): string[] {
  const fields: string[] = []
  let i = 0
  const len = line.length

  while (i <= len) {
    if (i === len) {
      fields.push("")
      break
    }

    if (line[i] === '"') {
      // Champ entre guillemets
      let field = ""
      i++ // saute le guillemet ouvrant
      while (i < len) {
        if (line[i] === '"') {
          if (i + 1 < len && line[i + 1] === '"') {
            // Guillemet échappé
            field += '"'
            i += 2
          } else {
            // Fin du champ entre guillemets
            i++
            break
          }
        } else {
          field += line[i]
          i++
        }
      }
      fields.push(field)
      // Saute le séparateur suivant si présent
      if (i < len && line[i] === sep) {
        i++
      }
    } else {
      // Champ sans guillemets
      const start = i
      while (i < len && line[i] !== sep) {
        i++
      }
      fields.push(line.slice(start, i))
      if (i < len) {
        i++ // saute le séparateur
      } else {
        break
      }
    }
  }

  return fields
}

function parseCsvToRows(text: string): { headers: string[]; rows: string[][] } | null {
  // Supprime le BOM UTF-8 si présent
  const clean = text.startsWith("﻿") ? text.slice(1) : text

  // Découpe en lignes (gère \r\n et \n)
  const lines = clean.split(/\r?\n/)

  // Cherche la première ligne non vide
  const headerLineIndex = lines.findIndex((l) => l.trim().length > 0)
  if (headerLineIndex === -1) return null

  const headerLine = lines[headerLineIndex]
  const sep = detectSeparator(headerLine)
  const headers = parseRow(headerLine, sep).map((h) => h.trim().toLowerCase())

  const rows: string[][] = []
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.length === 0) continue
    rows.push(parseRow(line, sep).map((v) => v.trim()))
  }

  return { headers, rows }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getField(
  row: string[],
  headers: string[],
  name: string,
): string {
  const idx = headers.indexOf(name)
  if (idx === -1) return ""
  return (row[idx] ?? "").trim()
}

function parseInt10(value: string): number | null {
  const n = parseInt(value, 10)
  return isNaN(n) ? null : n
}

function parseFloatSafe(value: string): number | null {
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

// ─── Constructeurs de questions ───────────────────────────────────────────────

function buildMcq(
  row: string[],
  headers: string[],
  rowNum: number,
  errors: string[],
): McqQuestion | null {
  const answersRaw = getField(row, headers, "answers")
  const correctRaw = getField(row, headers, "correct")

  if (!answersRaw) {
    errors.push(`Ligne ${rowNum} : colonne "answers" manquante pour le type mcq.`)
    return null
  }
  if (!correctRaw && correctRaw !== "0") {
    errors.push(`Ligne ${rowNum} : colonne "correct" manquante pour le type mcq.`)
    return null
  }

  const answers = answersRaw.split("|").map((a) => a.trim()).filter((a) => a.length > 0)
  if (answers.length < 2) {
    errors.push(`Ligne ${rowNum} : au moins 2 réponses requises pour le type mcq (trouvé : ${answers.length}).`)
    return null
  }
  if (answers.length > 4) {
    errors.push(`Ligne ${rowNum} : maximum 4 réponses pour le type mcq (trouvé : ${answers.length}).`)
    return null
  }

  const solutions = correctRaw
    .split("|")
    .map((s) => parseInt10(s.trim()))
    .filter((n): n is number => n !== null)

  if (solutions.length === 0) {
    errors.push(`Ligne ${rowNum} : au moins 1 solution requise pour le type mcq.`)
    return null
  }

  for (const sol of solutions) {
    if (sol < 0 || sol >= answers.length) {
      errors.push(
        `Ligne ${rowNum} : indice de solution ${sol} hors limites (0–${answers.length - 1}).`,
      )
      return null
    }
  }

  return { type: "mcq", answers, solutions } as Omit<McqQuestion, keyof ReturnType<typeof buildBase>> & McqQuestion
}

function buildOpen(
  row: string[],
  headers: string[],
  rowNum: number,
  errors: string[],
): OpenQuestion | null {
  const correctAnswersRaw = getField(row, headers, "correctanswers")

  if (!correctAnswersRaw) {
    errors.push(`Ligne ${rowNum} : colonne "correctAnswers" manquante pour le type open.`)
    return null
  }

  const correctAnswers = correctAnswersRaw
    .split("|")
    .map((a) => a.trim())
    .filter((a) => a.length > 0)

  if (correctAnswers.length === 0) {
    errors.push(`Ligne ${rowNum} : au moins 1 réponse correcte requise pour le type open.`)
    return null
  }

  return { type: "open", correctAnswers } as Omit<OpenQuestion, keyof ReturnType<typeof buildBase>> & OpenQuestion
}

function buildSlider(
  row: string[],
  headers: string[],
  rowNum: number,
  errors: string[],
): SliderQuestion | null {
  const minRaw = getField(row, headers, "min")
  const maxRaw = getField(row, headers, "max")
  const correctValueRaw = getField(row, headers, "correctvalue")
  const toleranceRaw = getField(row, headers, "tolerance")

  const min = parseFloatSafe(minRaw)
  const max = parseFloatSafe(maxRaw)
  const correctValue = parseFloatSafe(correctValueRaw)
  const tolerance = parseFloatSafe(toleranceRaw)

  if (min === null) {
    errors.push(`Ligne ${rowNum} : colonne "min" manquante ou invalide pour le type slider.`)
    return null
  }
  if (max === null) {
    errors.push(`Ligne ${rowNum} : colonne "max" manquante ou invalide pour le type slider.`)
    return null
  }
  if (correctValue === null) {
    errors.push(`Ligne ${rowNum} : colonne "correctValue" manquante ou invalide pour le type slider.`)
    return null
  }
  if (tolerance === null) {
    errors.push(`Ligne ${rowNum} : colonne "tolerance" manquante ou invalide pour le type slider.`)
    return null
  }
  if (min >= max) {
    errors.push(`Ligne ${rowNum} : "min" (${min}) doit être inférieur à "max" (${max}).`)
    return null
  }

  return { type: "slider", min, max, correctValue, tolerance } as Omit<SliderQuestion, keyof ReturnType<typeof buildBase>> & SliderQuestion
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildBase(_placeholder: unknown) {
  // Utilisé uniquement pour l'inférence de type ci-dessus
  return { type: "" as const, question: "", cooldown: 0, time: 0 }
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

const SUPPORTED_TYPES = ["mcq", "open", "slider"] as const
type SupportedType = (typeof SUPPORTED_TYPES)[number]

/**
 * Parse un texte CSV et retourne les questions valides ainsi que les erreurs par ligne.
 *
 * @param text - Contenu brut du fichier CSV (UTF-8, BOM optionnel)
 * @returns `{ questions, errors }` — questions valides + messages d'erreur sur les lignes ignorées
 */
export function parseQuestionsCsv(text: string): CsvImportResult {
  const questions: Question[] = []
  const errors: string[] = []

  const parsed = parseCsvToRows(text)
  if (!parsed) {
    errors.push("Le fichier CSV est vide ou illisible.")
    return { questions, errors }
  }

  const { headers, rows } = parsed

  if (!headers.includes("type") || !headers.includes("question")) {
    errors.push('En-tête invalide : les colonnes "type" et "question" sont obligatoires.')
    return { questions, errors }
  }

  rows.forEach((row, i) => {
    const rowNum = i + 2 // ligne 1 = en-tête, donc data commence à 2

    const typeRaw = getField(row, headers, "type").toLowerCase() as SupportedType
    const question = getField(row, headers, "question")

    if (!question) {
      errors.push(`Ligne ${rowNum} : la colonne "question" est vide — ligne ignorée.`)
      return
    }

    if (!(SUPPORTED_TYPES as readonly string[]).includes(typeRaw)) {
      errors.push(
        `Ligne ${rowNum} : type "${typeRaw}" non supporté (valeurs acceptées : mcq, open, slider) — ligne ignorée.`,
      )
      return
    }

    const timeRaw = getField(row, headers, "time")
    const cooldownRaw = getField(row, headers, "cooldown")
    const time = clamp(parseInt10(timeRaw) ?? 20, 5, 120)
    const cooldown = clamp(parseInt10(cooldownRaw) ?? 5, 3, 15)

    const base = { question, cooldown, time }

    let specific: Partial<Question> | null = null

    if (typeRaw === "mcq") {
      specific = buildMcq(row, headers, rowNum, errors)
    } else if (typeRaw === "open") {
      specific = buildOpen(row, headers, rowNum, errors)
    } else if (typeRaw === "slider") {
      specific = buildSlider(row, headers, rowNum, errors)
    }

    if (specific === null) return

    questions.push({ ...base, ...specific } as Question)
  })

  return { questions, errors }
}

// ─── Modèle CSV téléchargeable ────────────────────────────────────────────────

/**
 * Génère un CSV exemple avec une ligne par type supporté.
 * Utilise l'approche Blob/URL identique à packages/web/src/features/manager/utils/csv.ts
 */
export function downloadCsvTemplate(): void {
  const lines = [
    "type,question,time,cooldown,answers,correct,correctAnswers,min,max,correctValue,tolerance",
    'mcq,Quelle est la capitale de la France ?,20,5,Paris|Lyon|Marseille|Bordeaux,0,,,,,',
    'open,Quel est le synonyme de « rapide » ?,30,5,,,vite|rapide|prompt,,,,',
    'slider,En quelle année a été fondée la ville de Paris ?,20,5,,,,,0,2000,300,50',
  ]

  const csvContent = lines.join("\n")
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", "modele-questions.csv")
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
