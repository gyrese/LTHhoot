// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  AnswerEditorNumberField,
  AnswerEditorPanel,
  EditableAnswerList,
} from "./AnswerEditorParts"

vi.mock("@rahoot/web/features/quizz/contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => ({ currentIndex: 0, validationIssues: [] }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "quizz:answerEditor.add": "Ajouter",
        "quizz:answerEditor.remove": "Supprimer",
      })[key] ?? key,
  }),
}))

afterEach(cleanup)

describe("structure commune des réponses", () => {
  it("keeps the answer panel collapsed until requested", () => {
    const { container } = render(
      <AnswerEditorPanel>
        <input aria-label="Réponse correcte" />
      </AnswerEditorPanel>,
    )
    const panel = container.querySelector("details")!
    expect(panel.open).toBe(false)
    fireEvent.click(container.querySelector("summary")!)
    expect(panel.open).toBe(true)
    expect(
      screen.getByRole("textbox", { name: "Réponse correcte" }),
    ).toBeTruthy()
  })
  it("ajoute, modifie et retire une réponse sans descendre sous le minimum", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <EditableAnswerList
        field="correctAnswers"
        values={["Paris"]}
        minimum={1}
        title="Réponses correctes"
        placeholder="Réponse"
        onChange={onChange}
      />,
    )

    expect(
      (screen.getByRole("button", { name: "Supprimer 1" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }))
    expect(onChange).toHaveBeenCalledWith(["Paris", ""])

    rerender(
      <EditableAnswerList
        field="correctAnswers"
        values={["Paris", "Lyon"]}
        minimum={1}
        title="Réponses correctes"
        placeholder="Réponse"
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByRole("textbox", { name: "Réponse 2" }), {
      target: { value: "Marseille" },
    })
    expect(onChange).toHaveBeenCalledWith(["Paris", "Marseille"])
    fireEvent.click(screen.getByRole("button", { name: "Supprimer 1" }))
    expect(onChange).toHaveBeenCalledWith(["Lyon"])
  })

  it("ne transforme pas une saisie numérique vide en zéro", () => {
    const onChange = vi.fn()
    render(
      <AnswerEditorNumberField
        field="correctYear"
        label="Année correcte"
        value={2024}
        onChange={onChange}
      />,
    )
    const input = screen.getByRole("spinbutton", { name: "Année correcte" })
    fireEvent.change(input, { target: { value: "" } })
    expect(onChange).not.toHaveBeenCalled()
    expect((input as HTMLInputElement).value).toBe("")
    fireEvent.change(input, { target: { value: "2025" } })
    expect(onChange).toHaveBeenCalledWith(2025)
  })
})
