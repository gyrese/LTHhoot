import {
  FAST_MODE_INTENSITY,
  FAST_MODE_TIMINGS,
  getFastModeTiming,
  resolveFastAnswerTime,
} from "@rahoot/common/types/fast-mode"
import { describe, expect, it } from "vitest"

describe("fast-mode", () => {
  describe("getFastModeTiming", () => {
    it("retombe sur NERVOUS quand aucune intensité n'est donnée", () => {
      expect(getFastModeTiming()).toEqual(FAST_MODE_TIMINGS.NERVOUS)
    })

    it("supprime l'écran « Prêt ? » dès NERVOUS, le garde en SMOOTH", () => {
      expect(getFastModeTiming(FAST_MODE_INTENSITY.SMOOTH).prepared).toBe(1)
      expect(getFastModeTiming(FAST_MODE_INTENSITY.NERVOUS).prepared).toBe(0)
      expect(getFastModeTiming(FAST_MODE_INTENSITY.HURRY_UP).prepared).toBe(0)
    })
  })

  describe("resolveFastAnswerTime", () => {
    const hurry = FAST_MODE_TIMINGS.HURRY_UP

    it("laisse la première question à son temps plein", () => {
      expect(resolveFastAnswerTime(7, 0, hurry)).toBe(7)
    })

    it("retire speedUpStep par question franchie", () => {
      expect(resolveFastAnswerTime(7, 1, hurry)).toBe(6)
      expect(resolveFastAnswerTime(7, 2, hurry)).toBe(5)
      expect(resolveFastAnswerTime(7, 3, hurry)).toBe(4)
    })

    it("ne descend jamais sous le plancher", () => {
      expect(resolveFastAnswerTime(7, 99, hurry)).toBe(hurry.minAnswerTime)
    })

    it("ne rallonge jamais une question déjà plus courte que le plancher", () => {
      // 2s configuré < plancher 3s : l'accélération ne doit pas la remonter.
      expect(resolveFastAnswerTime(2, 99, hurry)).toBe(2)
    })

    it("laisse le temps constant quand speedUpStep vaut 0", () => {
      const nervous = FAST_MODE_TIMINGS.NERVOUS

      expect(resolveFastAnswerTime(7, 0, nervous)).toBe(7)
      expect(resolveFastAnswerTime(7, 10, nervous)).toBe(7)
    })
  })
})
