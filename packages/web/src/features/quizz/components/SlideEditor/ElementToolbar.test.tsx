// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createShapeElement,
  createTextElement,
} from "../../utils/element-factory"
import ElementToolbar, { toggleTextToken } from "./ElementToolbar"
vi.mock("react-i18next", async () => {
  const { default: fr } = await import("@rahoot/web/locales/fr/quizz.json")
  return {
    useTranslation: () => ({
      t: (key: string, options?: { type?: string }) => {
        const path = key.replace(/^quizz:/u, "").split(".")
        const value = path.reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)?.[part],
          fr,
        )
        return typeof value === "string"
          ? value.replace("{{type}}", options?.type ?? "")
          : key
      },
    }),
  }
})

afterEach(() => cleanup())

const actions = () => ({
  update: vi.fn(),
  remove: vi.fn(),
  replaceImage: vi.fn(),
  openInspector: vi.fn(),
  bringToFront: vi.fn(),
  sendToBack: vi.fn(),
})

describe("barre contextuelle", () => {
  it("sépare l'alignement du texte de la position du bloc", () => {
    const element = createTextElement({ align: "center", x: 100 })
    const handlers = actions()
    render(<ElementToolbar element={element} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: "Style du texte" }))
    fireEvent.click(screen.getByRole("button", { name: "Texte à gauche" }))
    expect(handlers.update).toHaveBeenCalledWith({ align: "left" })
    fireEvent.click(screen.getByRole("button", { name: "Position" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Au centre horizontal" }),
    )
    expect(handlers.update).toHaveBeenCalledWith({
      x: Math.round((1920 - element.width) / 2),
    })
  })
  it("donne les commandes de forme à une forme sans afficher les commandes de texte", () => {
    const handlers = actions()
    render(<ElementToolbar element={createShapeElement()} {...handlers} />)
    expect(
      screen.getByRole("button", { name: "Style de la forme" }),
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Style du texte" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Style de la forme" }))
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Angles arrondis" }),
      { target: { value: "24" } },
    )
    expect(handlers.update).toHaveBeenCalledWith({ cornerRadius: 24 })
  })
  it("préserve les combinaisons de style et n'expose que le déverrouillage si nécessaire", () => {
    expect(toggleTextToken("bold italic", "bold", "normal")).toBe("italic")
    expect(toggleTextToken("underline line-through", "underline", "none")).toBe(
      "line-through",
    )
    const handlers = actions()
    render(
      <ElementToolbar
        element={createTextElement({ isLocked: true })}
        {...handlers}
      />,
    )
    expect(screen.queryByRole("button", { name: "Style du texte" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Déverrouiller" }))
    expect(handlers.update).toHaveBeenCalledWith({ isLocked: false })
  })
})
