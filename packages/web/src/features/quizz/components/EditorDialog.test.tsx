// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import EditorDialog from "./EditorDialog"

afterEach(() => {
  document.body.innerHTML = ""
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal")
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close")
  vi.restoreAllMocks()
})

describe("focus des confirmations", () => {
  it("revient sur une commande disponible quand la précédente a disparu", () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: vi.fn(),
    })
    const origin = document.createElement("button")
    const fallback = document.createElement("button")
    document.body.append(origin, fallback)
    origin.focus()

    const { unmount } = render(
      <EditorDialog label="Confirmer" returnFocusTo={() => fallback}>
        <button type="button">Annuler</button>
      </EditorDialog>,
    )
    origin.remove()
    unmount()

    expect(document.activeElement).toBe(fallback)
  })
})
