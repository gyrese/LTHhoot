// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AnswerBoxView, FitGroup } from "./QuestionLayoutView"

let available = 100
let hidden = false
let resolveFonts = vi.fn<() => void>()
const box = { x: 0, y: 0, width: 400, height: 100 }
const answer = (text: string, fitKey = "") => (
  <FitGroup>
    <AnswerBoxView index={0} box={box} text={text} fitKey={fitKey} />
    <AnswerBoxView index={1} box={box} text="Paris" />
  </FitGroup>
)

beforeEach(() => {
  available = 100
  hidden = false
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    () => (hidden ? 0 : available),
  )
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100)
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(40)
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    // eslint-disable-next-line no-unused-vars
    function measureWidth(this: HTMLElement) {
      return (
        (parseFloat(this.style.fontSize) || 36) *
        (this.textContent?.includes("Long") ? 5 : 1)
      )
    },
  )
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      ready: new Promise<void>((resolve) => {
        resolveFonts = vi.fn(resolve)
      }),
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, "fonts")
})

it("does not let an obsolete font callback shrink the current answers", async () => {
  const { rerender } = render(answer("Long"))
  expect(screen.getByText("Paris").parentElement?.style.fontSize).toBe("20px")
  rerender(answer("Court"))
  await act(() => Promise.resolve().then(resolveFonts))
  expect(screen.getByText("Paris").parentElement?.style.fontSize).toBe("36px")
})

it("ignores hidden boxes and refits after the editor scale changes", () => {
  hidden = true
  const { rerender } = render(answer("Long", "initial"))
  expect(screen.getByText("Paris").parentElement?.style.fontSize).toBe("36px")
  hidden = false
  available = 180
  rerender(answer("Long", "resized"))
  expect(screen.getByText("Paris").parentElement?.style.fontSize).toBe("36px")
})
