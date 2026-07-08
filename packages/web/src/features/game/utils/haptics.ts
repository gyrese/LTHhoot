export const HAPTIC_PATTERNS = {
  CORRECT: [40],
  WRONG: [30, 50, 30],
  STREAK_MILESTONE: [20, 30, 20, 30, 60],
  POWERUP_RECEIVED: [15, 20, 15],
  POWERUP_LEGENDARY: [20, 30, 20, 30, 20, 30, 80],
  TAP: [10],
  // Double impulsion « accusé de réception » : la réponse est bien arrivée au serveur
  ANSWER_CONFIRMED: [15, 30, 40],
  DUEL_WIN: [50, 30, 50, 30, 100],
} as const

// Silencieux sur desktop/navigateurs sans support (iOS Safari notamment) —
// `navigator.vibrate` renvoie juste `false`, pas d'exception à intercepter.
export const vibrate = (pattern: number | readonly number[]) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern as number | number[])
  }
}
