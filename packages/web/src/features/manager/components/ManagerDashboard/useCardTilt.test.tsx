// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { motion } from "motion/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import useCardTilt from "./useCardTilt"

const preference = vi.hoisted(() => ({ reduce: false }))
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => preference.reduce,
}))

beforeEach(() => {
  preference.reduce = false
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const renders = vi.fn()
function Card({ enabled = true }: { enabled?: boolean }) {
  renders()
  const tilt = useCardTilt(enabled)
  return (
    <article data-testid="outer" data-library-id="quiz">
      <motion.div {...tilt} data-testid="surface" />
    </article>
  )
}

function setup(enabled = true) {
  renders.mockClear()
  const view = render(<Card enabled={enabled} />)
  const surface = screen.getByTestId("surface")
  vi.spyOn(
    screen.getByTestId("outer"),
    "getBoundingClientRect",
  ).mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 200,
    bottom: 300,
    width: 200,
    height: 300,
    toJSON: () => ({}),
  })
  return { ...view, surface }
}

it("matches the supplied 3D tilt and separates the image, caption and controls in depth", async () => {
  const { surface } = setup()
  fireEvent.mouseEnter(surface, { clientX: 200, clientY: 0 })
  await waitFor(
    () => {
      expect(surface.style.transform).toContain("perspective(1000px)")
      expect(surface.style.transform).toContain("rotateX(5deg)")
      expect(surface.style.transform).toContain("rotateY(5deg)")
      expect(surface.style.getPropertyValue("--card-art-depth")).toBe("20px")
      expect(surface.style.getPropertyValue("--card-content-depth")).toBe(
        "34px",
      )
      expect(surface.style.getPropertyValue("--card-tools-depth")).toBe("39px")
    },
    { timeout: 2000 },
  )
  expect(surface.style.getPropertyValue("--card-light-x")).toBe("100%")
  expect(surface.style.getPropertyValue("--card-light-y")).toBe("0%")
  expect(screen.getByTestId("outer").style.transform).toBe("")
  expect(renders).toHaveBeenCalledTimes(1)
  const layers: number[][] = []
  const observer = new MutationObserver(() => {
    layers.push(
      ["--card-art-depth", "--card-content-depth", "--card-tools-depth"].map(
        (key) => parseFloat(surface.style.getPropertyValue(key)),
      ),
    )
  })
  observer.observe(surface, { attributes: true, attributeFilter: ["style"] })
  fireEvent.mouseLeave(surface)
  try {
    await waitFor(
      () => {
        expect(surface.style.transform).toContain("rotateX(0deg)")
        expect(surface.style.transform).toContain("rotateY(0deg)")
        expect(surface.style.getPropertyValue("--card-art-depth")).toBe("0px")
        expect(surface.style.getPropertyValue("--card-content-depth")).toBe(
          "2px",
        )
        expect(surface.style.getPropertyValue("--card-tools-depth")).toBe("3px")
      },
      { timeout: 2000 },
    )
    expect(layers.length).toBeGreaterThan(0)
    expect(
      layers.every(
        ([art, content, tools]) =>
          art >= 0 && content > art + 1 && tools > content,
      ),
    ).toBe(true)
  } finally {
    observer.disconnect()
  }
})

it("resets immediately on keyboard input and drag without moving the layout wrapper", async () => {
  const { surface } = setup()
  fireEvent.mouseMove(surface, { clientX: 200, clientY: 0 })
  await waitFor(
    () => expect(surface.style.transform).toContain("rotateX(5deg)"),
    { timeout: 2000 },
  )
  fireEvent.keyDown(surface, { key: "Tab" })
  await waitFor(() =>
    expect(surface.style.transform).toContain("rotateX(0deg)"),
  )
  expect(surface.style.getPropertyValue("--card-light-opacity")).toBe("0")
  fireEvent.mouseMove(surface, { clientX: 0, clientY: 0 })
  await waitFor(
    () => expect(surface.style.transform).toContain("rotateX(5deg)"),
    { timeout: 2000 },
  )
  fireEvent.dragStart(surface)
  await waitFor(() =>
    expect(surface.style.transform).toContain("rotateX(0deg)"),
  )
})

it("suppresses motion for reduced motion and explicitly disabled cards", () => {
  preference.reduce = true
  const { surface, rerender } = setup()
  fireEvent.mouseMove(surface, { clientX: 200, clientY: 0 })
  expect(surface.style.transform).toContain("rotateX(0deg)")
  expect(surface.style.getPropertyValue("--card-art-depth")).toBe("0px")
  expect(surface.style.getPropertyValue("--card-light-opacity")).toBe("0")
  preference.reduce = false
  rerender(<Card enabled={false} />)
  fireEvent.mouseMove(surface, { clientX: 200, clientY: 0 })
  expect(surface.style.transform).toContain("rotateX(0deg)")
})

it("ignores touch and the compatibility mouse events it generates", () => {
  const { surface } = setup()
  const touch = new MouseEvent("pointermove", {
    bubbles: true,
    clientX: 200,
    clientY: 0,
  })
  Object.defineProperty(touch, "pointerType", { value: "touch" })
  fireEvent(surface, touch)
  fireEvent.mouseEnter(surface, { clientX: 200, clientY: 0 })
  expect(surface.style.transform).toContain("rotateX(0deg)")
  expect(surface.style.getPropertyValue("--card-light-x")).toBe("50%")
})
