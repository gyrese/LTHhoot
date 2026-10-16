// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SlidePreviewModal from "./SlidePreviewModal"

const state = vi.hoisted(() => ({
  questions: [
    { id: "first", type: "title", question: "Bienvenue" },
    { id: "second", type: "mcq", question: "Question deux" },
    { id: "third", type: "open", question: "Question trois" },
  ],
  currentIndex: 1,
  salonImage: "",
  startTestDrive: vi.fn(),
  validationIssues: [] as Array<{ path: string }>,
  setShowValidation: vi.fn(),
}))

vi.mock("../../contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => state,
}))
vi.mock("../../hooks/useTestDrive", () => ({
  default: () => ({
    startTestDrive: state.startTestDrive,
    isTestDriving: false,
  }),
}))
vi.mock("./PreviewPresenterView", () => ({
  default: ({
    question,
    phase,
    hideYoutube,
  }: {
    question: { id: string }
    phase: string
    hideYoutube: boolean
  }) => (
    <div
      data-testid="presenter"
      data-phase={phase}
      data-hide-video={String(hideYoutube)}
    >
      Présentateur {question.id}
    </div>
  ),
}))
vi.mock("./PreviewParticipantView", () => ({
  default: ({ question }: { question: { id: string } }) => (
    <div>Participant {question.id}</div>
  ),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | Record<string, unknown>) => {
      if (key === "quizz:sidebar.openQuestion" && typeof options === "object") {
        return `Ouvrir la question ${options.number} : ${options.title}`
      }
      return typeof options === "string" ? options : key
    },
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  state.validationIssues = []
})

describe("aperçu du quiz", () => {
  it("opens corrections instead of starting a real game when the quiz is incomplete", () => {
    state.validationIssues = [{ path: "questions.1.answers.0" }]
    const onClose = vi.fn()
    render(<SlidePreviewModal onClose={onClose} />)
    fireEvent.click(
      screen.getByRole("button", { name: "quizz:previewFlow.testCurrent" }),
    )
    expect(onClose).toHaveBeenCalledOnce()
    expect(state.setShowValidation).toHaveBeenCalledWith(true)
    expect(state.startTestDrive).not.toHaveBeenCalled()
  })
  it("selects views and stages, resets the stage when navigating and exposes real tests", () => {
    render(<SlidePreviewModal onClose={vi.fn()} />)
    const stage = screen.getByRole("combobox", {
      name: "quizz:previewFlow.phase",
    })
    expect(screen.getByTestId("presenter").getAttribute("data-phase")).toBe(
      "question",
    )
    expect(
      screen.getByTestId("presenter").getAttribute("data-hide-video"),
    ).toBe("false")
    fireEvent.change(stage, { target: { value: "correction" } })
    expect(screen.getByTestId("presenter").getAttribute("data-phase")).toBe(
      "correction",
    )
    const view = screen.getByRole("combobox", {
      name: "quizz:previewFlow.view",
    })
    fireEvent.keyDown(view, { key: "ArrowRight" })
    expect(screen.getByText("Présentateur second")).toBeTruthy()
    fireEvent.change(view, { target: { value: "participant" } })
    expect(screen.queryByTestId("presenter")).toBeNull()
    expect(screen.getByText("Participant second")).toBeTruthy()
    fireEvent.change(view, { target: { value: "both" } })
    expect(screen.getByTestId("presenter")).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ouvrir la question 3 : Question trois",
      }),
    )
    expect(screen.getByTestId("presenter").getAttribute("data-phase")).toBe(
      "question",
    )
    fireEvent.click(
      screen.getByRole("button", { name: "quizz:previewFlow.testCurrent" }),
    )
    expect(state.startTestDrive).toHaveBeenLastCalledWith(2)
    fireEvent.click(
      screen.getByRole("button", { name: "quizz:previewFlow.testAll" }),
    )
    expect(state.startTestDrive).toHaveBeenLastCalledWith(0)
  })
  it("parcourt librement les questions sans changer la sélection de l'éditeur", () => {
    const onClose = vi.fn()
    render(<SlidePreviewModal onClose={onClose} />)

    expect(screen.getByText("Présentateur second")).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ouvrir la question 3 : Question trois",
      }),
    )
    expect(screen.getByText("Présentateur third")).toBeTruthy()
    expect(state.currentIndex).toBe(1)

    fireEvent.keyDown(window, { key: "ArrowLeft" })
    expect(screen.getByText("Présentateur second")).toBeTruthy()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
