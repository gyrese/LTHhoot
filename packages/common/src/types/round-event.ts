// Événement de manche armé en direct par l'animateur depuis la télécommande.
// À distinguer des power-ups (achetés individuellement par un joueur) : un
// événement de manche s'applique à TOUS les joueurs sur la question suivante.
export const ROUND_EVENT_TYPE = {
  DOUBLE_POINTS: "DOUBLE_POINTS",
  SUDDEN_DEATH: "SUDDEN_DEATH",
} as const

export type RoundEventType =
  (typeof ROUND_EVENT_TYPE)[keyof typeof ROUND_EVENT_TYPE]

export function isRoundEventType(value: unknown): value is RoundEventType {
  return typeof value === "string" && Object.hasOwn(ROUND_EVENT_TYPE, value)
}
