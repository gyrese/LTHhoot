import type {
  DropPinPoint,
  DropPinShape,
  DropPinZone,
} from "@rahoot/common/types/game"
import { generateId } from "@rahoot/web/features/quizz/utils/id"

export const ZONE_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
]

export const zoneColor = (index: number) =>
  ZONE_COLORS[index % ZONE_COLORS.length]!

/** Sous le seuil, le tracé est un clic accidentel plutôt qu'une zone. */
export const MIN_ZONE_SIZE = 2

const round = (value: number) => parseFloat(value.toFixed(1))

const clampPct = (value: number) => Math.max(0, Math.min(100, value))

/** Zone rectangulaire ou elliptique décrite par deux coins opposés. */
export const zoneFromDrag = (
  shape: Extract<DropPinShape, "rect" | "ellipse">,
  start: DropPinPoint,
  end: DropPinPoint,
  label: string,
): DropPinZone => ({
  id: generateId(),
  shape,
  x: round(Math.min(start.x, end.x)),
  y: round(Math.min(start.y, end.y)),
  width: round(Math.abs(end.x - start.x)),
  height: round(Math.abs(end.y - start.y)),
  label,
  isCorrect: true,
})

/** Zone polygonale fermée. `x`/`y`/`width`/`height` portent la boîte englobante. */
export const zoneFromPoints = (
  points: DropPinPoint[],
  label: string,
): DropPinZone => {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)

  return {
    id: generateId(),
    shape: "polygon",
    points: points.map((p) => ({ x: round(p.x), y: round(p.y) })),
    x: round(minX),
    y: round(minY),
    width: round(Math.max(...xs) - minX),
    height: round(Math.max(...ys) - minY),
    label,
    isCorrect: true,
  }
}

/** Déplace une zone entière, en la gardant dans l'image. */
export const translateZone = (
  zone: DropPinZone,
  dx: number,
  dy: number,
): DropPinZone => {
  if (zone.shape === "polygon" && zone.points) {
    const xs = zone.points.map((p) => p.x)
    const ys = zone.points.map((p) => p.y)
    // Décalage rogné pour qu'aucun sommet ne sorte de l'image.
    const clampedDx = Math.max(
      -Math.min(...xs),
      Math.min(dx, 100 - Math.max(...xs)),
    )
    const clampedDy = Math.max(
      -Math.min(...ys),
      Math.min(dy, 100 - Math.max(...ys)),
    )

    return {
      ...zone,
      x: round(zone.x + clampedDx),
      y: round(zone.y + clampedDy),
      points: zone.points.map((p) => ({
        x: round(p.x + clampedDx),
        y: round(p.y + clampedDy),
      })),
    }
  }

  return {
    ...zone,
    x: round(clampPct(Math.min(zone.x + dx, 100 - zone.width))),
    y: round(clampPct(Math.min(zone.y + dy, 100 - zone.height))),
  }
}

/** Redimensionne depuis le coin bas-droit (rectangle et ellipse). */
export const resizeZone = (
  zone: DropPinZone,
  cornerX: number,
  cornerY: number,
): DropPinZone => ({
  ...zone,
  width: round(Math.max(MIN_ZONE_SIZE, clampPct(cornerX) - zone.x)),
  height: round(Math.max(MIN_ZONE_SIZE, clampPct(cornerY) - zone.y)),
})

export const SHAPE_LABELS: Record<DropPinShape, string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  polygon: "Forme libre",
}
