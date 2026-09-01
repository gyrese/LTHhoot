import type { DropPinPoint, DropPinZone } from "@rahoot/common/types/game"

// Rayon (en % de la largeur de l'image) autour du point d'une zone héritée.
// Les premières zones « épingle » n'étaient qu'un point : le jeu validait toute
// réponse tombant dans ce rayon. Les quiz créés à l'époque n'ont pas de `shape`
// ni de dimensions exploitables — on leur conserve ce comportement au lieu de
// les casser rétroactivement.
export const LEGACY_PIN_RADIUS = 20

/**
 * Le clic du joueur (`x`, `y` en % de l'image) tombe-t-il dans la zone ?
 *
 * Source unique partagée par le serveur (validation de la réponse), l'éditeur
 * (aperçu) et l'écran de résultats : une zone dessinée doit être exactement la
 * zone qui compte les points.
 */
export const isPointInZone = (
  zone: DropPinZone,
  x: number,
  y: number,
): boolean => {
  switch (zone.shape) {
    case "rect":
      return (
        x >= zone.x &&
        x <= zone.x + zone.width &&
        y >= zone.y &&
        y <= zone.y + zone.height
      )

    case "ellipse": {
      const rx = zone.width / 2
      const ry = zone.height / 2

      if (rx <= 0 || ry <= 0) {
        return false
      }

      const dx = (x - (zone.x + rx)) / rx
      const dy = (y - (zone.y + ry)) / ry

      return dx * dx + dy * dy <= 1
    }

    case "polygon": {
      const points = zone.points ?? []

      if (points.length < 3) {
        return false
      }

      // Lancer de rayon : on compte les arêtes croisées par une demi-droite
      // horizontale partant du point. Nombre impair ⇒ le point est dedans.
      let inside = false

      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const a = points[i]!
        const b = points[j]!
        const straddles = a.y > y !== b.y > y

        if (straddles && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
          inside = !inside
        }
      }

      return inside
    }

    default: {
      // Zone héritée : un point et un rayon de tolérance.
      const dx = x - zone.x
      const dy = y - zone.y

      return Math.sqrt(dx * dx + dy * dy) <= LEGACY_PIN_RADIUS
    }
  }
}

/** Boîte englobante d'une zone, en % — utile au rendu et aux poignées. */
export const zoneBounds = (
  zone: DropPinZone,
): { x: number; y: number; width: number; height: number } => {
  if (zone.shape === "polygon" && (zone.points?.length ?? 0) > 0) {
    const points = zone.points!
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)

    return {
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
    }
  }

  if (!zone.shape) {
    // Zone héritée : la boîte du disque de tolérance.
    return {
      x: zone.x - LEGACY_PIN_RADIUS,
      y: zone.y - LEGACY_PIN_RADIUS,
      width: LEGACY_PIN_RADIUS * 2,
      height: LEGACY_PIN_RADIUS * 2,
    }
  }

  return { x: zone.x, y: zone.y, width: zone.width, height: zone.height }
}

/** Tracé SVG d'un polygone, en coordonnées % (viewBox "0 0 100 100"). */
export const polygonPath = (points: DropPinPoint[]): string =>
  `${points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")} Z`

/** Centre d'une zone, en % — point d'ancrage du libellé. */
export const zoneCenter = (zone: DropPinZone): { x: number; y: number } => {
  const bounds = zoneBounds(zone)

  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}
