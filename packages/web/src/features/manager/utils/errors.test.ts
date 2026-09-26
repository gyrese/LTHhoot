import type { TFunction } from "i18next"
import { describe, expect, it, vi } from "vitest"
import { translateServerError } from "./errors"

// Faux `t` : ne connaît que les clés listées, renvoie sinon `defaultValue`
// (comportement d'i18next pour une clé absente).
const translations: Record<string, string> = {
  "errors:quizz.notFound": "Quiz introuvable",
  "manager:errors.generic": "Une erreur est survenue",
}

const makeT = () =>
  vi.fn((key: string, options?: { defaultValue?: string }) => {
    if (key in translations) {
      return translations[key]
    }

    return options?.defaultValue ?? key
  }) as unknown as TFunction & ReturnType<typeof vi.fn>

describe("translateServerError", () => {
  it("traduit une clé avec espace de noms", () => {
    expect(translateServerError(makeT(), "errors:quizz.notFound")).toBe(
      "Quiz introuvable",
    )
  })

  it("lit une clé sans espace de noms dans `errors`", () => {
    const t = makeT()

    expect(translateServerError(t, "quizz.notFound")).toBe("Quiz introuvable")
    expect(t).toHaveBeenCalledWith("errors:quizz.notFound", {
      defaultValue: "Une erreur est survenue",
    })
  })

  it("retombe sur le message générique pour une clé inconnue", () => {
    expect(translateServerError(makeT(), "errors:quizz.inconnue")).toBe(
      "Une erreur est survenue",
    )
  })

  it("affiche tel quel un texte libre (message d'exception)", () => {
    const t = makeT()
    const message = "ENOENT: no such file or directory"

    expect(translateServerError(t, message)).toBe(message)
    expect(t).not.toHaveBeenCalled()
  })

  it("ne prend pas un mot isolé pour une clé", () => {
    expect(translateServerError(makeT(), "timeout")).toBe("timeout")
  })
})
