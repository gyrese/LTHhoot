import type { Socket } from "@rahoot/common/types/game/socket"
import { getClientIp } from "@rahoot/socket/utils/client-ip"
import { createUniqueInviteCode } from "@rahoot/socket/utils/game"
import { RateLimiter } from "@rahoot/socket/utils/rate-limit"
import { isSameOrigin } from "@rahoot/socket/utils/same-origin"
import { withTimeout } from "@rahoot/socket/utils/timeout"
import { describe, expect, it, vi } from "vitest"

const socketFrom = (address: string, forwardedFor?: string) =>
  ({
    handshake: {
      address,
      headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
    },
  }) as unknown as Socket

describe("getClientIp", () => {
  it("garde l'adresse directe d'un client public", () => {
    expect(getClientIp(socketFrom("8.8.8.8", "1.1.1.1"))).toBe("8.8.8.8")
  })

  it("derrière un proxy privé, prend la 1re IP publique en partant de la droite", () => {
    // « 6.6.6.6 » est fourni (usurpé) par le client, « 5.5.5.5 » ajouté par
    // le reverse-proxy, « 172.18.0.2 » par le nginx interne.
    expect(
      getClientIp(socketFrom("127.0.0.1", "6.6.6.6, 5.5.5.5, 172.18.0.2")),
    ).toBe("5.5.5.5")
  })
})

describe("RateLimiter", () => {
  it("bloque au-delà du quota puis se libère à la fin de la fenêtre", () => {
    const limiter = new RateLimiter(2, 1000)

    expect(limiter.hit("ip", 0)).toBe(true)
    expect(limiter.hit("ip", 10)).toBe(true)
    expect(limiter.hit("ip", 20)).toBe(false)
    expect(limiter.isLimited("ip", 20)).toBe(true)
    expect(limiter.isLimited("autre", 20)).toBe(false)
    expect(limiter.hit("ip", 1500)).toBe(true)
  })
})

describe("isSameOrigin", () => {
  it("compare l'hôte de l'Origin à l'en-tête Host, sans le port", () => {
    expect(isSameOrigin("https://quiz.fr", { host: "quiz.fr" })).toBe(true)
    expect(isSameOrigin("http://quiz.fr:3000", { host: "quiz.fr:3001" })).toBe(
      true,
    )
    expect(isSameOrigin("https://evil.com", { host: "quiz.fr" })).toBe(false)
    expect(isSameOrigin("pas une url", { host: "quiz.fr" })).toBe(false)
  })
})

describe("createUniqueInviteCode", () => {
  it("retire un code déjà utilisé par une partie", () => {
    const taken = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
    const code = createUniqueInviteCode(taken)

    expect(code).toMatch(/^\d{6}$/u)
    expect(taken).toHaveBeenCalledTimes(2)
  })
})

describe("withTimeout", () => {
  it("rejette une promesse qui ne se règle jamais", async () => {
    vi.useFakeTimers()

    const pending = withTimeout(
      new Promise<void>(() => {
        // Ne se règle jamais.
      }),
      1000,
    )
    const assertion = expect(pending).rejects.toThrow("Délai dépassé")

    await vi.advanceTimersByTimeAsync(1000)
    await assertion
    vi.useRealTimers()
  })
})
