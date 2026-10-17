// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, expect, it, vi } from "vitest"
import useImageEdgeColors, { sampleEdgeColors } from "./useImageEdgeColors"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it("keeps different colors for the left and right image edges", () => {
  const pixels = new Uint8ClampedArray(36 * 48 * 4)
  for (let y = 0; y < 48; y += 1) {
    for (let x = 0; x < 36; x += 1) {
      pixels.set(x < 18 ? [0, 0, 255, 255] : [255, 0, 0, 255], (y * 36 + x) * 4)
    }
  }
  const colors = sampleEdgeColors(pixels, 36, 48)
  expect(colors.left).toBe("rgb(0 0 255)")
  expect(colors["top-left"]).toBe("rgb(0 0 255)")
  expect(colors.right).toBe("rgb(255 0 0)")
  expect(colors["bottom-right"]).toBe("rgb(255 0 0)")
  expect(Object.keys(colors)).toHaveLength(8)
})

it("keeps transparent and black images visible without inventing saturated hues", () => {
  expect(sampleEdgeColors(new Uint8ClampedArray(16), 2, 2).top).toBe("#fb923c")
  const pixels = new Uint8ClampedArray(16)
  for (let i = 3; i < 16; i += 4) {
    pixels[i] = 255
  }
  expect(sampleEdgeColors(pixels, 2, 2).top).toBe("rgb(180 180 180)")
  pixels[2] = 80
  expect(sampleEdgeColors(pixels, 2, 2).top).toBe("rgb(0 0 220)")
})

it("falls back safely when an external image forbids canvas sampling", () => {
  const drawImage = vi.fn(() => {
    throw new DOMException("Tainted canvas", "SecurityError")
  })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D)
  function Card() {
    const ref = useRef<HTMLDivElement>(null)
    useImageEdgeColors(ref, "https://example.test/cover.png")
    return (
      <div ref={ref}>
        <img data-cover src="https://example.test/cover.png" alt="" />
      </div>
    )
  }
  const view = render(<Card />)
  const image = view.container.querySelector("img")!
  Object.defineProperties(image, {
    naturalWidth: { value: 400 },
    naturalHeight: { value: 600 },
  })
  fireEvent.load(image)
  expect(drawImage).toHaveBeenCalledOnce()
  expect(view.container.firstElementChild?.getAttribute("style")).toBeNull()
})
