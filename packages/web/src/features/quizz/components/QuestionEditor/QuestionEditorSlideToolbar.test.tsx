// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { AudioButton, BackgroundButton } from "./QuestionEditorSlideToolbar"

const state = vi.hoisted(() => ({
  currentQuestion: { id: "a", audio: "/old.mp3", background: undefined },
  currentIndex: 0,
  updateQuestion: vi.fn(),
  applyToAllQuestions: vi.fn(),
}))
vi.mock("@rahoot/web/features/quizz/contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => state,
}))
vi.mock("./useQuestionImagePicker", () => ({
  useQuestionImagePicker: () => ({ openPicker: vi.fn(), picker: null }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
afterEach(() => {
  cleanup()
  state.currentQuestion.id = "a"
  vi.clearAllMocks()
})

it("saves audio and returns to its toolbar button", () => {
  render(<AudioButton />)
  const trigger = screen.getByRole("button", { name: "quizz:slideAudio" })
  fireEvent.click(trigger)
  fireEvent.change(screen.getByLabelText("quizz:slideUrlLabel"), {
    target: { value: "/new.mp3" },
  })
  fireEvent.click(screen.getByRole("button", { name: "common:save" }))
  expect(state.updateQuestion).toHaveBeenCalledWith(0, { audio: "/new.mp3" })
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it("closes a background draft on slide change without applying it", () => {
  const { rerender } = render(<BackgroundButton />)
  fireEvent.click(screen.getByRole("button", { name: "quizz:slideBackground" }))
  fireEvent.change(screen.getByLabelText("quizz:bgColor"), {
    target: { value: "#ff0000" },
  })
  state.currentQuestion = { ...state.currentQuestion, id: "b" }
  rerender(<BackgroundButton />)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(state.updateQuestion).not.toHaveBeenCalled()
})
