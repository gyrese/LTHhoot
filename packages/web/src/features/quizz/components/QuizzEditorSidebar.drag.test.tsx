// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import QuizzEditorSidebar from "./QuizzEditorSidebar"

const state = vi.hoisted(() => ({
  questions: [
    { id: "a", type: "title", question: "Bienvenue" },
    { id: "b", type: "mcq", question: "Question" },
    { id: "c", type: "open", question: "Conclusion" },
  ],
  currentIndex: 0,
  selectedQuestionIds: ["a"],
  validationIssues: [],
  setCurrentIndex: vi.fn(),
  setSelectedQuestionIds: vi.fn(),
  selectSlide: vi.fn(),
  addQuestion: vi.fn(),
  removeQuestion: vi.fn(),
  removeQuestions: vi.fn(),
  reorderQuestions: vi.fn(),
  duplicateQuestion: vi.fn(),
  duplicateQuestions: vi.fn(),
}))

vi.mock("../contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => state,
}))
vi.mock("./LazySlidePreview", () => ({
  default: ({ question }: { question: { question: string } }) => (
    <div>{question.question}</div>
  ),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { number?: number }) =>
      options?.number ? `${key} ${options.number}` : key,
  }),
}))

beforeEach(() => {
  // Give the real drag-and-drop sensors a vertical list in jsdom.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    // eslint-disable-next-line no-unused-vars -- TypeScript's this parameter is erased at runtime.
    function measure(this: HTMLElement) {
      const id = this.getAttribute("data-rfd-draggable-id")
      const top = id ? ["a", "b", "c"].indexOf(id) * 100 : 0
      return new DOMRect(0, top, 250, id ? 100 : 300)
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

const preview = () =>
  screen.getByRole("button", { name: "quizz:sidebar.openQuestion 1" })
const draggedRow = () =>
  document.querySelector<HTMLElement>('[data-rfd-draggable-id="a"]')!

describe("déplacement des diapositives avec les vrais capteurs", () => {
  it.each(["vignette", "poignée"])(
    "déplace une diapositive au clavier depuis la %s",
    async (source) => {
      render(<QuizzEditorSidebar />)
      const handle =
        source === "vignette"
          ? preview()
          : screen.getByRole("button", {
              name: "quizz:sidebar.reorderQuestion 1",
            })
      handle.focus()
      fireEvent.keyDown(handle, { key: " ", keyCode: 32 })
      await waitFor(() => expect(draggedRow().style.position).toBe("fixed"))
      fireEvent.keyDown(handle, { key: "ArrowDown", keyCode: 40 })
      await act(async () => {
        await new Promise((resolve) => {
          requestAnimationFrame(resolve)
        })
      })
      fireEvent.keyDown(handle, { key: " ", keyCode: 32 })
      await waitFor(() =>
        expect(state.reorderQuestions).toHaveBeenCalledWith(0, 1),
      )
      expect(state.selectSlide).not.toHaveBeenCalled()
    },
  )

  it("démarre depuis la vignette à la souris et permet d'annuler", async () => {
    render(<QuizzEditorSidebar />)
    fireEvent.mouseDown(screen.getByText("Bienvenue"), {
      button: 0,
      clientX: 100,
      clientY: 40,
    })
    fireEvent.mouseMove(window, { clientX: 100, clientY: 60 })
    await waitFor(() => expect(draggedRow().style.position).toBe("fixed"))
    fireEvent.keyDown(window, { key: "Escape", keyCode: 27 })
    await waitFor(() => expect(draggedRow().style.position).not.toBe("fixed"))
    expect(state.reorderQuestions).not.toHaveBeenCalled()
  })

  it("réordonne les diapositives quand on dépose une vignette à la souris", async () => {
    render(<QuizzEditorSidebar />)
    fireEvent.mouseDown(preview(), {
      button: 0,
      clientX: 100,
      clientY: 40,
    })
    fireEvent.mouseMove(window, { clientX: 100, clientY: 60 })
    await waitFor(() => expect(draggedRow().style.position).toBe("fixed"))
    fireEvent.mouseMove(window, { clientX: 100, clientY: 160 })
    await act(async () => {
      await new Promise((resolve) => {
        requestAnimationFrame(resolve)
      })
    })
    fireEvent.mouseUp(window)
    fireEvent.transitionEnd(draggedRow(), { propertyName: "transform" })
    await waitFor(() =>
      expect(state.reorderQuestions).toHaveBeenCalledWith(0, 1),
    )
    expect(state.selectSlide).not.toHaveBeenCalled()
  })

  it.each(["filtre", "sélection"])(
    "désactive le déplacement depuis les vignettes en mode %s",
    (mode) => {
      render(<QuizzEditorSidebar />)
      if (mode === "filtre") {
        fireEvent.click(
          screen.getByRole("button", { name: "quizz:sidebar.navigationTools" }),
        )
        fireEvent.change(screen.getByRole("searchbox"), {
          target: { value: "Bienvenue" },
        })
      } else {
        fireEvent.click(
          screen.getByRole("button", { name: "quizz:sidebar.selectMultiple" }),
        )
      }
      fireEvent.mouseDown(preview(), { button: 0, clientX: 100, clientY: 40 })
      fireEvent.mouseMove(window, { clientX: 100, clientY: 160 })
      fireEvent.mouseUp(window)
      expect(draggedRow().style.position).not.toBe("fixed")
      expect(preview().hasAttribute("data-rfd-drag-handle-draggable-id")).toBe(
        false,
      )
      expect(state.reorderQuestions).not.toHaveBeenCalled()
    },
  )

  it("garde le clic de sélection et les boutons d'action indépendants du déplacement", () => {
    render(<QuizzEditorSidebar />)
    fireEvent.click(preview())
    expect(state.selectSlide).toHaveBeenCalledWith(0, false, false)
    const [duplicate] = screen.getAllByRole("button", {
      name: "quizz:question.duplicateQuestion",
    })
    fireEvent.mouseDown(duplicate, { button: 0 })
    fireEvent.mouseMove(window, { clientX: 0, clientY: 120 })
    fireEvent.mouseUp(window)
    fireEvent.click(duplicate)
    expect(state.duplicateQuestion).toHaveBeenCalledWith(0)
    expect(draggedRow().style.position).not.toBe("fixed")
    expect(state.reorderQuestions).not.toHaveBeenCalled()
  })
})
