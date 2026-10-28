import { afterEach, describe, expect, it, vi } from "vitest"
import { RecoveryLinks } from "./recovery-links"

afterEach(() => vi.useRealTimers())
describe("liens de récupération", () => {
  it("limite le lien à un usage et ne révèle pas l'identité", () => {
    const links = new RecoveryLinks()
    const link = links.create("identite-secrete")
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    expect(JSON.stringify(link)).not.toContain("identite-secrete")
    expect(links.consume(link.token)).toBe("identite-secrete")
    expect(links.consume(link.token)).toBeUndefined()
  })
  it("expire après dix minutes et remplace les anciens liens", () => {
    vi.useFakeTimers()
    const links = new RecoveryLinks()
    const first = links.create("joueur")
    const second = links.create("joueur")
    expect(links.consume(first.token)).toBeUndefined()
    vi.advanceTimersByTime(600_000)
    expect(links.consume(second.token)).toBeUndefined()
  })
  it("isole les parties et ne consomme pas un lien sur un essai invalide", () => {
    const links = new RecoveryLinks()
    const link = links.create("joueur")
    expect(new RecoveryLinks().consume(link.token)).toBeUndefined()
    expect(links.consume("faux")).toBeUndefined()
    expect(links.consume(link.token)).toBe("joueur")
  })
})
