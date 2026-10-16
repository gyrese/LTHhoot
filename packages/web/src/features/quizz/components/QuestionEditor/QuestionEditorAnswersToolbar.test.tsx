// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import QuestionEditorAnswersToolbar from "./QuestionEditorAnswersToolbar"
import type { EditorIssue } from "../../utils/validation"

const state = vi.hoisted(() => ({
  currentQuestion: {
    id: "q1",
    type: "mcq",
    question: "Exemple",
    answers: ["A", "B", "C"],
    solutions: [1],
    cooldown: 5,
    time: 20,
  },
  currentIndex: 0,
  validationIssues: [] as EditorIssue[],
  validationTarget: null as EditorIssue | null,
  updateQuestion: vi.fn(),
}))

vi.mock("@rahoot/web/features/quizz/contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => ({ ...state, questions: [state.currentQuestion] }),
}))
vi.mock("@rahoot/web/features/game/contexts/socket-context", () => ({
  useSocket: () => ({ socket: null }),
  useEvent: () => undefined,
}))
vi.mock("@rahoot/web/features/quizz/components/EditorDialog", () => ({
  default: ({ children, label }: { children: ReactNode; label: string }) => (
    <div role="dialog" aria-label={label}>
      {children}
    </div>
  ),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { number?: number }) =>
      (
        ({
          "quizz:answerManager.manage": "Gérer",
          "quizz:answerManager.title": "Gérer les réponses",
          "quizz:answerManager.answerNumber": `Réponse ${values?.number}`,
          "quizz:markCorrect": "Marquer correcte",
          "quizz:removeAnswer": "Retirer une réponse",
          "common:moveUp": "Monter",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  state.validationTarget = null
})

describe("gestion des réponses dans l'éditeur", () => {
  it("ouvre directement la gestion pour corriger une réponse signalée", () => {
    state.validationTarget = {
      path: "questions.0.answers.1",
      questionIndex: 0,
      field: "Réponse 2",
      message: "Réponse vide",
    }
    render(<QuestionEditorAnswersToolbar />)
    expect(
      screen.getByRole("dialog", { name: "Gérer les réponses" }),
    ).toBeTruthy()
    expect(
      screen
        .getByRole("textbox", { name: "Réponse 2" })
        .getAttribute("data-validation-target"),
    ).toBe("questions.0.answers.1")
  })
  it("édite, déplace et supprime un choix depuis la même fenêtre", () => {
    render(<QuestionEditorAnswersToolbar />)
    fireEvent.click(screen.getByRole("button", { name: "Gérer" }))
    expect(
      screen.getByRole("dialog", { name: "Gérer les réponses" }),
    ).toBeTruthy()

    fireEvent.change(screen.getByRole("textbox", { name: "Réponse 1" }), {
      target: { value: "Alpha" },
    })
    expect(state.updateQuestion).toHaveBeenCalledWith(0, {
      answers: ["Alpha", "B", "C"],
    })

    fireEvent.click(screen.getByRole("button", { name: "Monter 2" }))
    expect(state.updateQuestion).toHaveBeenCalledWith(0, {
      answers: ["B", "A", "C"],
      solutions: [0],
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Retirer une réponse 2" }),
    )
    expect(state.updateQuestion).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ answers: ["A", "C"], solutions: [0] }),
    )
  })
})
