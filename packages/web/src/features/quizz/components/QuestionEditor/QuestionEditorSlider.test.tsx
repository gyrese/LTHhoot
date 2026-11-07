// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, expect, it, vi } from "vitest"
import QuestionEditorSlider from "./QuestionEditorSlider"

vi.mock("@rahoot/web/features/quizz/contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => {
    const [currentQuestion, setQuestion] = useState({
      id: "slider",
      min: 0,
      max: 50000,
      correctValue: 10034,
      tolerance: 3,
    })

    return {
      currentQuestion,
      currentIndex: 0,
      updateQuestion: (
        _index: number,
        patch: Partial<typeof currentQuestion>,
      ) => setQuestion((question) => ({ ...question, ...patch })),
    }
  },
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

it("synchronizes the exact answer field and the range control", () => {
  render(<QuestionEditorSlider />)

  const input = screen.getByRole<HTMLInputElement>("spinbutton", {
    name: "quizz:sliderCorrect",
  })
  const slider = screen.getByRole<HTMLInputElement>("slider", {
    name: "quizz:sliderCorrect",
  })

  fireEvent.change(input, { target: { value: "" } })
  expect(slider.value).toBe("10034")
  fireEvent.change(input, { target: { value: "10000" } })
  expect(slider.value).toBe("10000")

  fireEvent.change(slider, { target: { value: "12000" } })
  expect(input.value).toBe("12000")
})
