import {
  type SlideElement,
  type TextElement,
  type ShapeElement,
} from "@rahoot/common/types/game"
import { generateElementId } from "@rahoot/web/features/quizz/utils/id"

// Repère du canvas de slide : les coordonnées des éléments sont ABSOLUES dans
// ce repère (aucune normalisation), et `SlideCanvas` se contente de le mettre à
// l'échelle de l'espace disponible. Un élément mal dimensionné à la création
// reste donc mal dimensionné en présentation : c'est ici que se joue le rendu.
const CANVAS_W = 1920
const CANVAS_H = 1080

// Décalage en cascade des ajouts successifs sur une même slide. Sans lui, deux
// éléments créés à la suite se superposeraient exactement et le second
// masquerait le premier ; avec, ils restent tous saisissables à la souris.
const STACK_OFFSET = 40
// Au-delà, la cascade repart de zéro pour ne pas pousser les éléments hors du
// canvas sur les slides très chargées.
const STACK_WRAP = 8

// Centre un bloc de `width`×`height` dans le canvas, décalé en cascade selon le
// nombre d'éléments déjà posés sur la slide. Le résultat est borné au canvas :
// un élément plus grand que celui-ci est ancré en haut à gauche plutôt que de
// déborder en négatif.
const centeredPosition = (width: number, height: number, existingCount = 0) => {
  const step = (existingCount % STACK_WRAP) * STACK_OFFSET

  return {
    x: Math.max(0, Math.round((CANVAS_W - width) / 2 + step)),
    y: Math.max(0, Math.round((CANVAS_H - height) / 2 + step)),
  }
}

// ─── Texte ────────────────────────────────────────────────────────────────────

// Moitié de la largeur du canvas : une ligne de titre y tient sans se replier,
// tout en laissant des marges franches de part et d'autre.
const TEXT_WIDTH = Math.round(CANVAS_W / 2)
// Taille pensée pour une projection : lisible depuis le fond d'une salle.
const TEXT_FONT_SIZE = 72
// La hauteur suit la police (deux lignes de confort) au lieu d'être figée :
// une hauteur constante tronquait le texte dès qu'il se repliait.
const TEXT_LINE_HEIGHT = 1.2
const TEXT_HEIGHT = Math.round(TEXT_FONT_SIZE * TEXT_LINE_HEIGHT * 2)

export const createTextElement = (
  overrides: Partial<TextElement> = {},
  existingCount = 0,
): TextElement => ({
  id: generateElementId(),
  type: "text",
  text: "Texte",
  ...centeredPosition(TEXT_WIDTH, TEXT_HEIGHT, existingCount),
  width: TEXT_WIDTH,
  height: TEXT_HEIGHT,
  rotation: 0,
  opacity: 1,
  fontSize: TEXT_FONT_SIZE,
  fontFamily: "Arial",
  fontStyle: "bold",
  textDecoration: "none",
  // Blanc cerné de noir : lisible aussi bien sur les fonds sombres par défaut
  // que sur une image de fond claire, sans réglage de la part de l'utilisateur.
  fill: "#ffffff",
  stroke: "#000000",
  strokeWidth: 4,
  align: "center",
  ...overrides,
})

// ─── Forme ────────────────────────────────────────────────────────────────────

const SHAPE_WIDTH = 480
const SHAPE_HEIGHT = 360

export const createShapeElement = (
  overrides: Partial<ShapeElement> = {},
  existingCount = 0,
): ShapeElement => ({
  id: generateElementId(),
  type: "shape",
  shapeType: "rect",
  ...centeredPosition(SHAPE_WIDTH, SHAPE_HEIGHT, existingCount),
  width: SHAPE_WIDTH,
  height: SHAPE_HEIGHT,
  rotation: 0,
  opacity: 1,
  fill: "#3b82f6",
  ...overrides,
})

// ─── Image ────────────────────────────────────────────────────────────────────

export const createImageElement = (
  url: string,
  width: number,
  height: number,
  existingCount = 0,
): SlideElement => ({
  id: generateElementId(),
  type: "image",
  url,
  ...centeredPosition(width, height, existingCount),
  width,
  height,
  rotation: 0,
  opacity: 1,
})
