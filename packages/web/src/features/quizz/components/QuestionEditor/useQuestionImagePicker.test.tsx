// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useQuestionImagePicker } from "./useQuestionImagePicker"

const state = vi.hoisted(() => ({
  questions: [
    { id: "q1", type: "image_sequence", images: [] },
    { id: "q2", type: "image_sequence", images: [] },
  ],
}))
vi.mock("@rahoot/web/features/quizz/contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => state,
}))
vi.mock("@rahoot/web/features/quizz/components/MediaSearchModal", () => ({
  default: ({
    open,
    onSelect,
  }: {
    open: boolean
    onSelect: (_url: string, _type: "image") => void
  }) =>
    open ? (
      <button onClick={() => onSelect("/chosen.png", "image")}>
        Choose image
      </button>
    ) : null,
}))

afterEach(cleanup)

describe("sélecteur d’image commun", () => {
  it("applique le choix à la question d’origine après un changement de question", () => {
    const onPick = vi.fn()
    const Harness = () => {
      const { openPicker, picker } = useQuestionImagePicker(onPick)
      return (
        <>
          <button onClick={() => openPicker("q1", 2)}>Open image picker</button>
          {picker}
        </>
      )
    }
    const { rerender } = render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Open image picker" }))
    state.questions = [state.questions[1], state.questions[0]]
    rerender(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Choose image" }))
    expect(onPick).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ id: "q1" }),
      "/chosen.png",
      2,
    )
  })
})
