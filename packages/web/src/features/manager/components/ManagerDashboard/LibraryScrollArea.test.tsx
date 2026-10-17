// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, expect, it, vi } from "vitest"
import LibraryScrollArea from "./LibraryScrollArea"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup() {
  let resize: () => void = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe = vi.fn()
      disconnect = disconnect
    },
  )
  function Fixture() {
    const ref = useRef<HTMLDivElement>(null)
    return (
      <LibraryScrollArea viewportRef={ref} label="Bibliothèque">
        <div>Quiz</div>
      </LibraryScrollArea>
    )
  }
  const view = render(<Fixture />)
  const viewport = view.container.querySelector<HTMLDivElement>(
    ".dashboard-scroll-viewport",
  )!
  let contentHeight = 1200
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, get: () => contentHeight },
  })
  act(() => resize())
  return {
    ...view,
    viewport,
    disconnect,
    fit: () => {
      contentHeight = 200
      act(() => resize())
    },
  }
}

it("tracks native scroll, provides keyboard paging, and disappears when content fits", () => {
  const { viewport, fit } = setup()
  const rail = screen.getByRole("scrollbar", { name: "Bibliothèque" })
  expect(rail.getAttribute("aria-controls")).toBe(viewport.id)
  viewport.scrollTop = 400
  fireEvent.scroll(viewport)
  expect(rail.getAttribute("aria-valuenow")).toBe("50")
  fireEvent.keyDown(rail, { key: "End" })
  expect(viewport.scrollTop).toBe(800)
  expect(rail.getAttribute("aria-valuenow")).toBe("100")
  fireEvent.keyDown(rail, { key: "PageUp" })
  expect(viewport.scrollTop).toBe(440)
  fireEvent.keyDown(rail, { key: "Home" })
  expect(viewport.scrollTop).toBe(0)
  fit()
  expect(screen.queryByRole("scrollbar")).toBeNull()
  expect(viewport.hasAttribute("data-custom-scroll")).toBe(false)
})

it("supports track clicks and dragging, and releases its observer on unmount", () => {
  const { viewport, unmount, disconnect } = setup()
  const rail = screen.getByRole("scrollbar")
  rail.setPointerCapture = vi.fn()
  rail.releasePointerCapture = vi.fn()
  vi.stubGlobal("PointerEvent", MouseEvent)
  vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect)
  fireEvent.pointerDown(rail, { button: 0, clientY: 184 })
  expect(viewport.scrollTop).toBeCloseTo(400)
  fireEvent.pointerMove(rail, { clientY: 500 })
  expect(viewport.scrollTop).toBe(800)
  fireEvent.pointerUp(rail)
  fireEvent.pointerMove(rail, { clientY: 0 })
  expect(viewport.scrollTop).toBe(800)
  unmount()
  expect(disconnect).toHaveBeenCalled()
})
