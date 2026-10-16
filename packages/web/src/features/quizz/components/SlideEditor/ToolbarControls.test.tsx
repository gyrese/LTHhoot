// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { ToolbarPopover } from "./ToolbarControls"

afterEach(cleanup)

it("focuses the input, stays open on resize and restores focus with Escape", () => {
  render(
    <ToolbarPopover label="Audio">
      <button type="button">Onglet</button>
      <input aria-label="Lien audio" />
    </ToolbarPopover>,
  )
  const trigger = screen.getByRole("button", { name: "Audio" })
  fireEvent.click(trigger)
  expect(document.activeElement).toBe(
    screen.getByRole("textbox", { name: "Lien audio" }),
  )
  fireEvent.resize(window)
  expect(screen.getByRole("dialog", { name: "Audio" })).toBeTruthy()
  fireEvent.keyDown(document, { key: "Escape" })
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it("closes when the user changes slide or clicks elsewhere", () => {
  const view = (id: string) => (
    <>
      <ToolbarPopover label="Fond" resetKey={id}>
        <input aria-label="Couleur" />
      </ToolbarPopover>
      <button type="button">Autre outil</button>
    </>
  )
  const { rerender } = render(view("a"))
  fireEvent.click(screen.getByRole("button", { name: "Fond" }))
  rerender(view("b"))
  expect(screen.queryByRole("dialog")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Fond" }))
  fireEvent.pointerDown(screen.getByRole("button", { name: "Autre outil" }))
  expect(screen.queryByRole("dialog")).toBeNull()
})
