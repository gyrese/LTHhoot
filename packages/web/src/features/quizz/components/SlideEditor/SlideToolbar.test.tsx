// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SlideToolbar from "./SlideToolbar"

const state = vi.hoisted(() => ({
  currentQuestion: {
    id: "q1",
    elements: [] as Array<{ id: string; type: string; url?: string }>,
  },
  questions: [] as Array<{
    id: string
    elements: Array<{ id: string; type: string; url?: string }>
  }>,
  currentIndex: 0,
  selectedId: undefined as string | undefined,
  setSelectedId: vi.fn(),
  updateQuestion: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: true,
  canRedo: false,
  openInspector: vi.fn(),
}))
vi.mock("../../contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => state,
}))
vi.mock("react-i18next", async () => {
  const { default: fr } = await import("@rahoot/web/locales/fr/quizz.json")
  return {
    useTranslation: () => ({
      t: (key: string) => {
        const path = key.replace(/^quizz:/u, "").split(".")
        return (
          path.reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)?.[part],
            fr,
          ) ?? key
        )
      },
    }),
  }
})
vi.mock("../QuestionEditor/QuestionEditorSlideToolbar", () => ({
  BackgroundButton: () => <button>Arrière-plan</button>,
  AudioButton: () => <button>Audio</button>,
}))
vi.mock("../MediaSearchModal", () => ({
  default: ({
    open,
    onSelect,
  }: {
    open: boolean
    onSelect: (_url: string, _type: "image") => void
  }) =>
    open ? (
      <button onClick={() => onSelect("/nouvelle-image.png", "image")}>
        Choisir une image
      </button>
    ) : null,
}))
vi.mock("./SlidePreviewModal", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>Fermer l’aperçu</button>
  ),
}))
vi.mock("./YoutubePanel", () => ({ default: () => <div>Panneau YouTube</div> }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  state.currentQuestion = { id: "q1", elements: [] }
  state.questions = [state.currentQuestion]
  state.selectedId = undefined
})

describe("barre d'outils", () => {
  it("garde les actions générales accessibles sans sélection", () => {
    state.questions = [state.currentQuestion]
    render(<SlideToolbar />)
    fireEvent.click(screen.getByRole("button", { name: "Annuler (Ctrl+Z)" }))
    expect(state.undo).toHaveBeenCalledOnce()
    expect(
      screen
        .getByRole("button", { name: "Rétablir (Ctrl+Y)" })
        .hasAttribute("disabled"),
    ).toBe(true)
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher les calques" }),
    )
    expect(state.openInspector).toHaveBeenCalledWith("layers")
    expect(screen.queryByRole("button", { name: "Aperçu" })).toBeNull()
  })
  it("remplace l'image sélectionnée sans modifier un autre élément", () => {
    state.currentQuestion = {
      id: "q1",
      elements: [
        { id: "image1", type: "image", url: "/ancienne.png" },
        { id: "image2", type: "image", url: "/intacte.png" },
      ],
    }
    state.questions = [state.currentQuestion]
    state.selectedId = "image1"
    render(<SlideToolbar />)
    fireEvent.click(screen.getByRole("button", { name: "Remplacer l’image" }))
    fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }))
    expect(state.updateQuestion).toHaveBeenCalledWith(0, {
      elements: [
        { id: "image1", type: "image", url: "/nouvelle-image.png" },
        { id: "image2", type: "image", url: "/intacte.png" },
      ],
    })
  })
})
