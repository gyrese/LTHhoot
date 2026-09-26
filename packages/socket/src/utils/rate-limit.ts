// Limiteur de débit en mémoire à fenêtre fixe, par clé (IP, socket…). Suffisant
// pour une instance unique : protège les endpoints publics (solo, PLAYER.JOIN)
// contre l'énumération et le flood sans dépendance externe.
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()
  private lastSweep = 0
  private readonly max: number
  private readonly windowMs: number

  constructor(max: number, windowMs: number) {
    this.max = max
    this.windowMs = windowMs
  }

  // Enregistre une tentative. Retourne `false` si la clé a dépassé le quota de
  // la fenêtre courante (la tentative est alors refusée, et non comptée).
  hit(key: string, now = Date.now()): boolean {
    this.sweep(now)

    const entry = this.hits.get(key)

    if (!entry || now > entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })

      return true
    }

    if (entry.count >= this.max) {
      return false
    }

    entry.count += 1

    return true
  }

  // Vrai si la clé a épuisé son quota sur la fenêtre courante, SANS compter de
  // tentative : permet de ne comptabiliser que les échecs (ex. code inconnu).
  isLimited(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key)

    return Boolean(entry && now <= entry.resetAt && entry.count >= this.max)
  }

  // Purge paresseuse des fenêtres expirées (au plus une fois par fenêtre) :
  // la Map ne grossit pas indéfiniment avec des IP de passage.
  private sweep(now: number) {
    if (now - this.lastSweep < this.windowMs) {
      return
    }

    this.lastSweep = now

    for (const [key, entry] of this.hits) {
      if (now > entry.resetAt) {
        this.hits.delete(key)
      }
    }
  }
}
