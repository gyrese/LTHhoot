import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import Modal from "./Modal"

// Jsdom ne calcule aucune mise en page : `offsetParent` y vaut toujours null,
// ce qui ferait passer tous les éléments pour masqués aux yeux de la modale.
// On simule ici des éléments visibles (parent direct comme offsetParent).
const offsetParent = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetParent",
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return (this as HTMLElement).parentElement
    },
  })
})

afterAll(() => {
  if (offsetParent) {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", offsetParent)
  }
})

// Bouton d'ouverture + modale à trois boutons : reproduit l'usage réel
// (le focus doit revenir sur le déclencheur à la fermeture).
const Harness = ({ onClose }: { onClose?: () => void }) => {
  const [open, setOpen] = useState(false)

  const close = () => {
    onClose?.()
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}>Ouvrir</button>
      {open && (
        <Modal label="Réglages" onClose={close}>
          <button>Premier</button>
          <button>Milieu</button>
          <button>Dernier</button>
        </Modal>
      )}
    </>
  )
}

const openModal = (onClose?: () => void) => {
  render(<Harness onClose={onClose} />)
  const trigger = screen.getByRole("button", { name: "Ouvrir" })
  trigger.focus()
  fireEvent.click(trigger)

  return trigger
}

describe("Modal", () => {
  it("s'expose comme dialogue modal nommé et focalise le premier élément", () => {
    openModal()

    const dialog = screen.getByRole("dialog", { name: "Réglages" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Premier" }),
    )
  })

  it("se ferme sur Échap et restaure le focus sur le déclencheur", () => {
    const onClose = vi.fn()
    const trigger = openModal(onClose)

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("piège le focus : Tab sur le dernier revient au premier, et inversement", () => {
    openModal()
    const first = screen.getByRole("button", { name: "Premier" })
    const last = screen.getByRole("button", { name: "Dernier" })

    last.focus()
    fireEvent.keyDown(last, { key: "Tab" })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it("se ferme sur un clic du fond, pas sur un clic dans le panneau", () => {
    const onClose = vi.fn()
    openModal(onClose)
    const dialog = screen.getByRole("dialog")

    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
