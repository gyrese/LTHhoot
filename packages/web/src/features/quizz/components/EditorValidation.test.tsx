// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import EditorValidation, { ValidatedInput } from "./EditorValidation"
import type { EditorIssue } from "../utils/validation"
const state = vi.hoisted(() => ({
  validationIssues: [
    {
      path: "questions.1.answers.0",
      questionIndex: 1,
      field: "Réponse 1",
      message: "Réponse vide",
    },
  ],
  currentIndex: 1,
  questions: [
    { question: "Introduction" },
    { question: "Capitale de la France" },
  ],
  showValidation: true,
  validationTarget: null as EditorIssue | null,
  goToIssue: vi.fn(),
  setShowValidation: vi.fn(),
}))
vi.mock("../contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => state,
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open")
  }
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  state.validationTarget = null
  state.showValidation = true
})
describe("validation interface", () => {
  it("regroups multiple issues on one slide and removes the group after correction", () => {
    const original = state.validationIssues
    state.validationIssues = [
      ...original,
      { ...original[0], path: "questions.1.answers.1", field: "Réponse 2" },
    ]
    const { rerender } = render(<EditorValidation />)
    expect(
      within(
        screen.getByRole("region", { name: "Diapositive 2" }),
      ).getAllByRole("button"),
    ).toHaveLength(2)
    state.validationIssues = []
    rerender(<EditorValidation />)
    expect(screen.queryByRole("region", { name: "Diapositive 2" })).toBeNull()
    expect(screen.getByText(/Aucun point bloquant/u)).toBeTruthy()
    state.validationIssues = original
  })
  it("focuses the text control inside an editable canvas target", () => {
    state.showValidation = false
    ;[state.validationTarget] = state.validationIssues
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(),
    ] as unknown as DOMRectList)
    HTMLElement.prototype.scrollIntoView = vi.fn()
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 1
    })
    render(
      <>
        <div tabIndex={0} data-validation-target="questions.1.answers.0">
          <textarea aria-label="Texte à corriger" />
        </div>
        <EditorValidation />
      </>,
    )
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Texte à corriger" }),
    )
  })
  it("focuses the requested answer after navigating to its question", () => {
    state.showValidation = false
    ;[state.validationTarget] = state.validationIssues
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(),
    ] as unknown as DOMRectList)
    HTMLElement.prototype.scrollIntoView = vi.fn()
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 1
    })
    render(
      <>
        <ValidatedInput field="answers.0" aria-label="Réponse" />
        <EditorValidation />
      </>,
    )
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Réponse" }),
    )
  })
  it("offers direct navigation to the exact question and answer", () => {
    render(<EditorValidation />)
    fireEvent.click(screen.getByRole("button", { name: /Corriger Réponse 1/u }))
    expect(state.goToIssue).toHaveBeenCalledWith(state.validationIssues[0])
    expect(screen.getByRole("region", { name: "Diapositive 2" })).toBeTruthy()
    expect(screen.getByText("Capitale de la France")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }))
    expect(state.setShowValidation).toHaveBeenCalledWith(false)
  })
  it("keeps invalid answers editable without inline warnings", () => {
    render(<ValidatedInput field="answers.0" aria-label="Réponse" />)
    expect(screen.getByRole("textbox").hasAttribute("aria-invalid")).toBe(false)
    expect(screen.queryByText(/Réponse vide/u)).toBeNull()
  })
})
