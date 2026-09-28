import type {
  Question,
  QuestionLayout,
  QuestionLayoutBox,
} from "@rahoot/common/types/game"
import {
  resolveQuestionFont,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
} from "@rahoot/common/utils/question-layout"

// ─── Mise en page libre du titre et des réponses ──────────────────────────────
// Toutes les boîtes sont exprimées dans le repère logique 1920×1080 des
// diapositives. Par défaut, titre et réponses occupent presque toute la
// largeur (comme la mise en page historique vue sur un écran d'ordinateur) :
// c'est ce que l'éditeur affiche tant que l'auteur n'a rien déplacé, et ce que
// l'écran hôte reproduit à l'identique.

export { resolveQuestionFont, SLIDE_HEIGHT, SLIDE_WIDTH }

// Marge latérale et largeur utile des boîtes par défaut.
const SIDE_MARGIN = 32
const CONTENT_W = SLIDE_WIDTH - SIDE_MARGIN * 2
const CONTENT_X = SIDE_MARGIN
const EDGE = 16
// Le titre démarre sous le HUD du haut de l'écran hôte (compteur de question,
// boutons son / suivant) pour ne pas passer dessous en pleine largeur.
const TITLE_TOP = 100
const ANSWER_GAP = 8
// Hauteur d'un bouton de réponse de l'écran hôte (py-6 + ligne text-4xl).
const ANSWER_ROW_H = 88

// Tailles de texte historiques (Tailwind) : titre `lg:text-4xl`, réponses
// `text-4xl` / `text-2xl` / `text-lg` selon la longueur (cf. AnswerButton).
export const DEFAULT_TITLE_FONT_SIZE = 36
export const MIN_BOX_WIDTH = 60
export const MIN_BOX_HEIGHT = 40

// Couleurs des réponses en hexadécimal (≈ `bg-red-500`… de Tailwind 4) : le
// rendu par défaut garde les classes Tailwind, ces valeurs ne servent qu'à
// pré-remplir les sélecteurs de couleur de l'éditeur.
export const ANSWERS_HEX = ["#fb2c36", "#2b7fff", "#f0b100", "#00c950"]
export const DARK_ANSWER_TEXT = "#0f172a"
export const DEFAULT_TITLE_FILL_HEX = "#000000"

// Types dont les cases de réponse sont positionnables.
export const hasLayoutAnswers = (type: Question["type"]) =>
  type === "mcq" || type === "true_false"

// Nombre de cases de réponse positionnables d'une question.
export const layoutAnswerCount = (question: Question): number => {
  if (question.type === "mcq") {
    return question.answers.length
  }

  return question.type === "true_false" ? 2 : 0
}

export const defaultTitleBox = (): QuestionLayoutBox => ({
  x: CONTENT_X,
  y: TITLE_TOP,
  width: CONTENT_W,
  height: 120,
})

// Grille 2 colonnes ancrée en bas, comme `McqAnswers` : la dernière case d'un
// nombre impair reste dans la colonne de gauche.
export const defaultAnswerBoxes = (count: number): QuestionLayoutBox[] => {
  const rows = Math.ceil(count / 2)
  const innerX = CONTENT_X + ANSWER_GAP
  const colW = (CONTENT_W - ANSWER_GAP * 2 - ANSWER_GAP) / 2
  const bottom = SLIDE_HEIGHT - EDGE

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 2)
    const col = index % 2

    return {
      x: innerX + col * (colW + ANSWER_GAP),
      y: bottom - (rows - row) * ANSWER_ROW_H - (rows - 1 - row) * ANSWER_GAP,
      width: colW,
      height: ANSWER_ROW_H,
    }
  })
}

// Boîte effective d'une réponse : celle du layout si présente, sinon la boîte
// par défaut (layout incomplet ou incohérent → jamais de case perdue).
export const answerBoxAt = (
  layout: QuestionLayout | undefined,
  index: number,
  count: number,
): QuestionLayoutBox =>
  layout?.answers?.[index] ?? defaultAnswerBoxes(count)[index]!

// Layout complet (titre + toutes les réponses) prêt à être modifié : au
// premier déplacement / redimensionnement / stylage, la boîte par défaut est
// matérialisée pour que l'hôte affiche exactement ce que l'éditeur montrait.
export const materializeLayout = (question: Question): QuestionLayout => {
  const count = layoutAnswerCount(question)
  const layout = question.layout ?? {}

  return {
    title: layout.title ?? defaultTitleBox(),
    answers:
      count > 0
        ? Array.from({ length: count }, (_, i) => answerBoxAt(layout, i, count))
        : undefined,
  }
}

// Boîte désignée : le titre, ou l'index d'origine d'une réponse.
export type LayoutBoxKey = "title" | number

// Retire les surcharges de style (undefined) d'une boîte : garde le JSON
// stocké propre après une remise à zéro d'un champ.
export const cleanBox = (box: QuestionLayoutBox): QuestionLayoutBox =>
  Object.fromEntries(
    Object.entries(box).filter(([, value]) => value !== undefined),
  ) as QuestionLayoutBox

// Met à jour une boîte (titre ou réponse) en matérialisant le reste. Une
// modification du titre seul ne matérialise pas les réponses : elles gardent
// la mise en page historique tant qu'on n'y touche pas (et inversement).
export const updateLayoutBox = (
  question: Question,
  key: LayoutBoxKey,
  patch: Partial<QuestionLayoutBox>,
): QuestionLayout => {
  const full = materializeLayout(question)
  const current = question.layout ?? {}

  if (key === "title") {
    return { ...current, title: cleanBox({ ...full.title!, ...patch }) }
  }

  const answers = (full.answers ?? []).map((box, i) =>
    i === key ? cleanBox({ ...box, ...patch }) : box,
  )

  return { ...current, answers }
}

// Ajout / retrait d'une réponse de QCM : `layout.answers` reste aligné sur les
// index des réponses. Une nouvelle case prend sa place par défaut dans la
// nouvelle grille.
export const resizeLayoutAnswers = (
  layout: QuestionLayout | undefined,
  count: number,
): QuestionLayout | undefined => {
  if (!layout?.answers) {
    return layout
  }

  const defaults = defaultAnswerBoxes(count)
  const answers = Array.from(
    { length: count },
    (_, i) => layout.answers![i] ?? defaults[i]!,
  )

  return { ...layout, answers }
}

// Taille de texte par défaut d'une réponse, selon sa longueur (mêmes paliers
// que `AnswerButton`, en pixels du repère 1920×1080).
export const defaultAnswerFontSize = (text: string): number => {
  if (text.length > 50) {
    return 18
  }

  if (text.length > 25) {
    return 24
  }

  return 36
}

// Valeur CSS `font-family` d'une police de quiz, avec repli générique.
export const fontFamilyCss = (font?: string): string | undefined =>
  font ? `"${font}", sans-serif` : undefined

// ─── Déplacement / redimensionnement (éditeur) ────────────────────────────────

// Poignée saisie : "move" pour le corps de la boîte, sinon bord(s) tiré(s).
export type BoxHandle =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"

// Tolérance d'aimantation au centre de la slide (repère 1920×1080).
const SNAP_DISTANCE = 12

const snapCenter = (start: number, size: number, target: number) =>
  Math.abs(start + size / 2 - target) <= SNAP_DISTANCE
    ? target - size / 2
    : start

const clampCoord = (value: number) =>
  Math.min(SLIDE_WIDTH * 2, Math.max(-SLIDE_WIDTH, value))

// Nouvelle géométrie d'une boîte après un geste de (dx, dy) pixels logiques
// depuis `start`. Tailles minimales garanties, bord opposé fixe lors d'un
// redimensionnement, aimantation au centre lors d'un déplacement.
export const moveResizeBox = (
  start: QuestionLayoutBox,
  handle: BoxHandle,
  dx: number,
  dy: number,
): QuestionLayoutBox => {
  if (handle === "move") {
    return {
      ...start,
      x: Math.round(
        clampCoord(snapCenter(start.x + dx, start.width, SLIDE_WIDTH / 2)),
      ),
      y: Math.round(
        clampCoord(snapCenter(start.y + dy, start.height, SLIDE_HEIGHT / 2)),
      ),
    }
  }

  let { x, y, width, height } = start

  if (handle.includes("e")) {
    width = Math.max(MIN_BOX_WIDTH, start.width + dx)
  }

  if (handle.includes("s")) {
    height = Math.max(MIN_BOX_HEIGHT, start.height + dy)
  }

  if (handle.includes("w")) {
    width = Math.max(MIN_BOX_WIDTH, start.width - dx)
    x = start.x + start.width - width
  }

  if (handle.includes("n")) {
    height = Math.max(MIN_BOX_HEIGHT, start.height - dy)
    y = start.y + start.height - height
  }

  return {
    ...start,
    x: Math.round(clampCoord(x)),
    y: Math.round(clampCoord(y)),
    width: Math.round(Math.min(SLIDE_WIDTH * 2, width)),
    height: Math.round(Math.min(SLIDE_HEIGHT * 2, height)),
  }
}

// Libellés des cases positionnables d'une question telle que reçue par l'hôte
// (QCM : ses réponses ; vrai-faux : [Faux, Vrai]) ; `null` pour les autres
// types, dont les réponses gardent leur mise en page propre.
export const layoutAnswerLabels = (
  type: Question["type"],
  answers: string[] | undefined,
  trueFalseLabels: [falseLabel: string, trueLabel: string],
): string[] | null => {
  if (type === "mcq") {
    return answers ?? null
  }

  return type === "true_false" ? trueFalseLabels : null
}
