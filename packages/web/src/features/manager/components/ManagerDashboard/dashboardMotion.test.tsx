// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useRef, useState } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { animate } from "animejs"
import useCardMotion from "./useCardMotion"
import useLibraryMotion from "./useLibraryMotion"
import QuizActionsMenu from "./QuizActionsMenu"

vi.mock("animejs", async (importOriginal) => {
  const original = await importOriginal<typeof import("animejs")>()
  return { ...original, animate: vi.fn(original.animate) }
})

let reducedMotion = false
beforeEach(() => {
  reducedMotion = false
  vi.mocked(animate).mockClear()
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion") ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function Card({ list = true }: { list?: boolean }) {
  const root = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState(false)
  useCardMotion(root, selected)
  return (
    <article ref={root} data-card-layout={list ? "list" : "grid"}>
      <div data-cover />
      <div data-glass />
      <button onClick={() => setSelected((value) => !value)}>Select</button>
      {selected && <span data-selection />}
    </article>
  )
}

it("keeps keyboard selection instant while animating pointer selection", () => {
  render(<Card />)
  const button = screen.getByRole("button")
  fireEvent.click(button, { detail: 0 })
  expect(animate).not.toHaveBeenCalled()
  fireEvent.click(button, { detail: 1 })
  fireEvent.click(button, { detail: 1 })
  expect(animate).toHaveBeenCalledWith(
    document.querySelector("[data-selection]"),
    expect.objectContaining({ duration: 200 }),
  )
})

it("reverts styles and removes hover listeners on unmount", () => {
  const view = render(<Card />)
  const article = view.container.querySelector("article")!
  const cover = article.querySelector<HTMLElement>("[data-cover]")!
  const enter = new MouseEvent("pointerenter")
  Object.defineProperty(enter, "pointerType", { value: "mouse" })
  article.dispatchEvent(enter)
  expect(animate).toHaveBeenCalledWith(cover, expect.anything())
  view.unmount()
  expect(cover.style.transform).toBe("")
  vi.mocked(animate).mockClear()
  article.dispatchEvent(enter)
  expect(animate).not.toHaveBeenCalled()
})

it("animates native mouse hover even when the browser reports no fine hover pointer", () => {
  const view = render(<Card />)
  const article = view.container.querySelector("article")!
  const cover = article.querySelector<HTMLElement>("[data-cover]")!
  const glass = article.querySelector<HTMLElement>("[data-glass]")!
  fireEvent.mouseEnter(article)
  expect(animate).toHaveBeenCalledWith(
    cover,
    expect.objectContaining({ scale: 1.04 }),
  )
  expect(animate).not.toHaveBeenCalledWith(glass, expect.anything())
  // Use the real Anime.js instance to verify the transform reaches the DOM.
  vi.mocked(animate).mock.results[0].value.seek(260)
  expect(cover.style.transform).toContain("scale(1.04)")
  fireEvent.mouseLeave(article)
  expect(animate).toHaveBeenCalledWith(
    cover,
    expect.objectContaining({ scale: 1, translateY: 0 }),
  )
})

it("accepts an unknown pointer type and ignores synthetic hover after touch", () => {
  const view = render(<Card />)
  const article = view.container.querySelector("article")!
  fireEvent.pointerEnter(article)
  expect(animate).toHaveBeenCalled()
  fireEvent.pointerLeave(article)
  vi.mocked(animate).mockClear()
  const touch = new MouseEvent("pointerenter")
  Object.defineProperty(touch, "pointerType", { value: "touch" })
  article.dispatchEvent(touch)
  fireEvent.mouseEnter(article)
  expect(animate).not.toHaveBeenCalled()
})

it("leaves grid hover transforms entirely to the layered Motion 3D effect", () => {
  const view = render(<Card list={false} />)
  fireEvent.mouseEnter(view.container.querySelector("article")!)
  expect(animate).not.toHaveBeenCalled()
})

it("respects reduced motion for both hover and selection", () => {
  reducedMotion = true
  const view = render(<Card />)
  fireEvent.pointerEnter(view.container.querySelector("article")!)
  fireEvent.mouseEnter(view.container.querySelector("article")!)
  fireEvent.click(screen.getByRole("button"), { detail: 1 })
  expect(animate).not.toHaveBeenCalled()
})

function Library({ ids }: { ids: string[] }) {
  const root = useRef<HTMLDivElement>(null)
  useLibraryMotion(root, ids.join(","))
  return (
    <div ref={root}>
      {ids.map((id) => (
        <div key={id} data-library-id={id} />
      ))}
    </div>
  )
}

it("moves retained cards to their new places when the library is reordered", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    // eslint-disable-next-line no-unused-vars
    function measure(this: HTMLElement) {
      const index = this.dataset.libraryId
        ? Array.from(this.parentElement!.children).indexOf(this)
        : 0
      return {
        left: 0,
        right: 300,
        top: index * 120,
        bottom: this.dataset.libraryId ? index * 120 + 100 : 600,
        width: 300,
        height: 100,
        x: 0,
        y: index * 120,
        toJSON: () => ({}),
      }
    },
  )
  const view = render(<Library ids={["a", "b"]} />)
  vi.mocked(animate).mockClear()
  view.rerender(<Library ids={["b", "a"]} />)
  expect(animate).toHaveBeenCalledWith(
    view.container.querySelector('[data-library-id="b"]'),
    expect.objectContaining({ translateY: [120, 0] }),
  )
  expect(animate).toHaveBeenCalledWith(
    view.container.querySelector('[data-library-id="a"]'),
    expect.objectContaining({ translateY: [-120, 0] }),
  )
})

it("opens the action menu from the keyboard at the requested end and restores focus", () => {
  render(
    <QuizActionsMenu
      label="Actions"
      actions={[
        { label: "Modifier", icon: null, onSelect: vi.fn() },
        { label: "Archiver", icon: null, onSelect: vi.fn() },
      ]}
    />,
  )
  const trigger = screen.getByRole("button", { name: "Actions" })
  fireEvent.keyDown(trigger, { key: "ArrowUp" })
  expect(document.activeElement).toBe(
    screen.getByRole("menuitem", { name: "Archiver" }),
  )
  expect(animate).not.toHaveBeenCalled()
  fireEvent.keyDown(document.activeElement!, { key: "Home" })
  expect(document.activeElement).toBe(
    screen.getByRole("menuitem", { name: "Modifier" }),
  )
  fireEvent.keyDown(document.activeElement!, { key: "Escape" })
  expect(screen.queryByRole("menu")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
