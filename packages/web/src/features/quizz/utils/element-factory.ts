import { type SlideElement, type TextElement, type ShapeElement } from "@rahoot/common/types/game"
import { v4 as uuidv4 } from "uuid"

export const createTextElement = (overrides: Partial<TextElement> = {}): TextElement => ({
  id: `el_${uuidv4()}`,
  type: "text",
  text: "Texte",
  x: 100 + Math.random() * 100,
  y: 100 + Math.random() * 100,
  width: 400,
  height: 100,
  rotation: 0,
  opacity: 1,
  fontSize: 60,
  fontFamily: "Arial",
  fontStyle: "normal",
  textDecoration: "none",
  fill: "#000000",
  align: "left",
  ...overrides,
})

export const createShapeElement = (overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id: `el_${uuidv4()}`,
  type: "shape",
  shapeType: "rect",
  x: 150 + Math.random() * 100,
  y: 150 + Math.random() * 100,
  width: 200,
  height: 150,
  rotation: 0,
  opacity: 1,
  fill: "#3b82f6",
  ...overrides,
})

export const createImageElement = (url: string, width: number, height: number): SlideElement => ({
  id: `el_${uuidv4()}`,
  type: "image",
  url,
  x: 100 + Math.random() * 50,
  y: 100 + Math.random() * 50,
  width,
  height,
  rotation: 0,
  opacity: 1,
})
