// Délai maximal d'un appel IA (Gemini). Sans borne, un appel bloqué gardait
// indéfiniment le verrou « une génération à la fois » du compte.
export const AI_TIMEOUT_MS = 90_000

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Délai dépassé (${Math.round(ms / 1000)} s)`)
    this.name = "TimeoutError"
  }
}

// Rejette si la promesse ne s'est pas réglée dans le délai. La promesse
// d'origine n'est pas annulée (le SDK ne l'expose pas) mais son résultat est
// ignoré : l'appelant libère ses ressources dès le rejet.
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}
