import type { DropPinZone } from "@rahoot/common/types/game"
import { isPointInZone, zoneBounds } from "@rahoot/common/utils/drop-pin"
import { describe, expect, it } from "vitest"

const zone = (patch: Partial<DropPinZone>): DropPinZone => ({
  id: "z1",
  x: 10,
  y: 10,
  width: 20,
  height: 20,
  label: "Zone",
  isCorrect: true,
  ...patch,
})

describe("isPointInZone", () => {
  it("rectangle : dedans, sur le bord, dehors", () => {
    const rect = zone({ shape: "rect" })

    expect(isPointInZone(rect, 20, 20)).toBe(true)
    expect(isPointInZone(rect, 10, 10)).toBe(true)
    expect(isPointInZone(rect, 30, 30)).toBe(true)
    expect(isPointInZone(rect, 31, 20)).toBe(false)
    expect(isPointInZone(rect, 20, 9)).toBe(false)
  })

  it("ellipse : le coin de la boîte est dehors, le centre dedans", () => {
    const ellipse = zone({ shape: "ellipse" })

    expect(isPointInZone(ellipse, 20, 20)).toBe(true)
    expect(isPointInZone(ellipse, 20, 10)).toBe(true)
    // Coin haut-gauche de la boîte englobante : hors de l'ellipse inscrite
    expect(isPointInZone(ellipse, 10, 10)).toBe(false)
  })

  it("polygone : triangle, intérieur et extérieur", () => {
    const triangle = zone({
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 0, y: 40 },
      ],
    })

    expect(isPointInZone(triangle, 5, 5)).toBe(true)
    expect(isPointInZone(triangle, 30, 30)).toBe(false)
    expect(isPointInZone(triangle, 50, 5)).toBe(false)
  })

  it("polygone concave (forme en L) : le creux n'est pas dedans", () => {
    const lShape = zone({
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 40 },
        { x: 0, y: 40 },
      ],
    })

    expect(isPointInZone(lShape, 5, 30)).toBe(true)
    expect(isPointInZone(lShape, 30, 5)).toBe(true)
    expect(isPointInZone(lShape, 30, 30)).toBe(false)
  })

  it("polygone incomplet : jamais validé", () => {
    expect(
      isPointInZone(zone({ shape: "polygon", points: [{ x: 0, y: 0 }] }), 0, 0),
    ).toBe(false)
  })

  it("zone héritée (sans forme) : rayon de tolérance autour du point", () => {
    const legacy = zone({ x: 50, y: 50 })

    expect(isPointInZone(legacy, 50, 50)).toBe(true)
    expect(isPointInZone(legacy, 60, 60)).toBe(true)
    expect(isPointInZone(legacy, 80, 80)).toBe(false)
  })
})

describe("zoneBounds", () => {
  it("englobe un polygone", () => {
    const poly = zone({
      shape: "polygon",
      points: [
        { x: 10, y: 20 },
        { x: 50, y: 30 },
        { x: 30, y: 60 },
      ],
    })

    expect(zoneBounds(poly)).toEqual({ x: 10, y: 20, width: 40, height: 40 })
  })

  it("retourne la boîte telle quelle pour un rectangle", () => {
    expect(zoneBounds(zone({ shape: "rect" }))).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    })
  })
})
