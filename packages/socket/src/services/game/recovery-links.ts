import { randomBytes } from "node:crypto"

// Un jeton par joueur ; aucun secret de connexion dans le QR ou le journal.
export class RecoveryLinks {
  private links = new Map<string, { token: string; expiresAt: number }>()

  expiresAt(clientId: string): number {
    return this.links.get(clientId)?.expiresAt ?? 0
  }

  create(clientId: string) {
    const now = Date.now()
    for (const [id, link] of this.links) {
      if (link.expiresAt <= now) {
        this.links.delete(id)
      }
    }
    const link = {
      token: randomBytes(32).toString("base64url"),
      expiresAt: now + 600_000,
    }
    this.links.set(clientId, link)

    return link
  }

  consume(token: string): string | undefined {
    for (const [clientId, link] of this.links) {
      if (link.token !== token) {
        continue
      }

      this.links.delete(clientId)

      return link.expiresAt > Date.now() ? clientId : undefined
    }

    return undefined
  }
}
