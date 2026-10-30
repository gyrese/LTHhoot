// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import QuizzEditorSidebar from "./QuizzEditorSidebar"

const state = vi.hoisted(() => ({
  questions: [
    { id: "a", type: "title", question: "Bienvenue" },
    { id: "b", type: "mcq", question: "Café ou thé ?" },
    { id: "c", type: "open", question: "Conclusion" },
  ],
  currentIndex: 0,
  setCurrentIndex: vi.fn(),
  selectedQuestionIds: ["a"],
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
vi.mock("./QuizzEditorCard", () => ({
  default: ({
    question,
    index,
    onClick,
    onKeyDown,
    buttonRef,
    onDelete,
    onMore,
  }: {
    question: { question: string }
    index: number
    onClick: (_event: MouseEvent<HTMLButtonElement>) => void
    onKeyDown?: (_event: KeyboardEvent<HTMLButtonElement>) => void
    buttonRef?: Ref<HTMLButtonElement>
    onDelete: () => void
    onMore: (_event: MouseEvent<HTMLButtonElement>) => void
  }) => (
    <>
      <button
        type="button"
        ref={buttonRef}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {index + 1}. {question.question}
      </button>
      <button type="button" onClick={onDelete}>
        Supprimer question {index + 1}
      </button>
      <button type="button" onClick={onMore}>
        Actions question {index + 1}
      </button>
    </>
  ),
}))
vi.mock("./EditorDialog", () => ({
  default: ({ children, label }: { children: ReactNode; label: string }) => (
    <div role="dialog" aria-label={label}>
      {children}
    </div>
  ),
}))
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  Droppable: ({
    children,
  }: {
    children: (_provided: {
      innerRef: () => void
      droppableProps: object
      placeholder: null
    }) => ReactNode
  }) =>
    children({
      innerRef: () => undefined,
      droppableProps: {},
      placeholder: null,
    }),
  Draggable: ({
    children,
    isDragDisabled,
  }: {
    children: (
      _provided: {
        innerRef: () => void
        draggableProps: object
        dragHandleProps: object
      },
      _snapshot: { isDragging: boolean },
    ) => ReactNode
    isDragDisabled: boolean
  }) => (
    <div data-drag-disabled={isDragDisabled}>
      {children(
        { innerRef: () => undefined, draggableProps: {}, dragHandleProps: {} },
        { isDragging: false },
      )}
    </div>
  ),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          "quizz:sidebar.search": "Rechercher une question",
          "quizz:sidebar.navigationTools": "Recherche et navigation",
          "quizz:sidebar.typeFilter": "Type",
          "quizz:sidebar.quickJump": "Aller à",
          "quizz:sidebar.clearFilters": "Effacer",
          "quizz:sidebar.selectMultiple": "Sélectionner",
          "quizz:sidebar.doneSelecting": "Terminer",
          "quizz:sidebar.duplicateSelected": "Dupliquer la sélection",
          "quizz:sidebar.deleteSelected": "Supprimer la sélection",
          "quizz:sidebar.confirmDeleteTitle": "Confirmer la suppression",
          "common:delete": "Confirmer",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  state.selectedQuestionIds = ["a"]
})

describe("navigation dans les questions", () => {
  it("ouvre les actions au-dessus du canvas, en dehors de la barre latérale", () => {
    const { container } = render(<QuizzEditorSidebar />)
    fireEvent.click(screen.getByRole("button", { name: "Actions question 2" }))
    const menu = screen.getByRole("menu")
    expect(menu.parentElement).toBe(document.body)
    expect(container.contains(menu)).toBe(false)
    fireEvent.click(screen.getByRole("menuitem", { name: "common:moveUp" }))
    expect(state.reorderQuestions).toHaveBeenCalledWith(1, 0)
    expect(screen.queryByRole("menu")).toBeNull()
  })

  it("garde les actions dans la fenêtre modale des diapositives sur mobile", () => {
    render(
      <dialog open aria-label="Diapositives">
        <QuizzEditorSidebar />
      </dialog>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Actions question 2" }))
    const menu = screen.getByRole("menu")
    expect(menu.parentElement).toBe(screen.getByRole("dialog"))
    expect(menu.closest("aside")).toBeNull()
    expect(menu.contains(document.activeElement)).toBe(true)
  })

  it("rend le focus au bouton d'actions quand le menu ferme avec Échap", () => {
    render(<QuizzEditorSidebar />)
    const trigger = screen.getByRole("button", { name: "Actions question 2" })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole("menu")).toBeTruthy()
    expect(screen.getByRole("menu").contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("menu")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("navigue avec les flèches et les bornes en gardant le focus", () => {
    render(<QuizzEditorSidebar />)
    const first = screen.getByRole("button", { name: "1. Bienvenue" })
    first.focus()
    fireEvent.keyDown(first, { key: "ArrowDown" })
    expect(state.selectSlide).toHaveBeenCalledWith(1, false, false)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "2. Café ou thé ?" }),
    )
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" })
    expect(state.selectSlide).toHaveBeenCalledWith(2, false, false)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "3. Conclusion" }),
    )
  })

  it("sélectionne au clavier uniquement les questions visibles", () => {
    render(<QuizzEditorSidebar />)
    fireEvent.click(
      screen.getByRole("button", { name: "Recherche et navigation" }),
    )
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "open" },
    })
    const visible = screen.getByRole("button", { name: "3. Conclusion" })
    visible.focus()
    fireEvent.keyDown(visible, { key: "Home", shiftKey: true })
    expect(state.setSelectedQuestionIds).toHaveBeenCalledWith(["c"])
    expect(state.setCurrentIndex).toHaveBeenCalledWith(2)
  })

  it("filtre le titre sans accents et garde les numéros d'origine", () => {
    render(<QuizzEditorSidebar />)
    expect(screen.queryByRole("searchbox")).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "Recherche et navigation" }),
    )
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Rechercher une question" }),
      {
        target: { value: "cafe" },
      },
    )
    expect(
      screen.getByRole("button", { name: "2. Café ou thé ?" }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "2. Café ou thé ?" }))
    expect(state.selectSlide).toHaveBeenCalledWith(1, false, false)
    expect(screen.queryByRole("button", { name: "1. Bienvenue" })).toBeNull()
    expect(document.querySelector('[data-drag-disabled="true"]')).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: /Recherche et navigation/u }),
    )
    expect(screen.queryByRole("searchbox")).toBeNull()
    expect(screen.queryByRole("button", { name: "1. Bienvenue" })).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: /Recherche et navigation/u }),
    )
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
      "cafe",
    )

    fireEvent.click(screen.getByRole("button", { name: "Effacer" }))
    expect(screen.getByRole("button", { name: "1. Bienvenue" })).toBeTruthy()
    expect(document.querySelector('[data-drag-disabled="true"]')).toBeNull()
  })

  it("combine le filtre par type et l'accès direct", () => {
    const onNavigate = vi.fn()
    render(<QuizzEditorSidebar onNavigate={onNavigate} />)
    fireEvent.click(
      screen.getByRole("button", { name: "Recherche et navigation" }),
    )
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "open" },
    })
    expect(screen.getByRole("button", { name: "3. Conclusion" })).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "2. Café ou thé ?" }),
    ).toBeNull()

    fireEvent.change(screen.getByLabelText("Aller à"), {
      target: { value: "1" },
    })
    expect(state.selectSlide).toHaveBeenCalledWith(1, false, false)
    expect(onNavigate).toHaveBeenCalledOnce()
  })

  it("permet de sélectionner sur mobile sans quitter la liste", () => {
    const onNavigate = vi.fn()
    render(<QuizzEditorSidebar onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole("button", { name: "Sélectionner" }))
    fireEvent.click(screen.getByRole("button", { name: "2. Café ou thé ?" }))
    expect(state.setSelectedQuestionIds).toHaveBeenCalledWith(["a", "b"])
    expect(state.selectSlide).not.toHaveBeenCalled()
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("limite l'action groupée aux questions visibles", () => {
    state.selectedQuestionIds = ["a", "b"]
    render(<QuizzEditorSidebar />)
    fireEvent.click(
      screen.getByRole("button", { name: "Recherche et navigation" }),
    )
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "mcq" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Dupliquer la sélection" }),
    )
    expect(state.duplicateQuestions).toHaveBeenCalledWith(["b"])
  })

  it("demande une confirmation avant la suppression groupée", () => {
    state.selectedQuestionIds = ["a", "b"]
    render(<QuizzEditorSidebar />)
    fireEvent.click(
      screen.getByRole("button", { name: "Supprimer la sélection" }),
    )
    expect(
      screen.getByRole("dialog", { name: "Confirmer la suppression" }),
    ).toBeTruthy()
    expect(state.removeQuestions).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))
    expect(state.removeQuestions).toHaveBeenCalledWith(["a", "b"])
  })

  it("limite la suppression d'une vignette à cette question", () => {
    state.selectedQuestionIds = ["a", "b"]
    render(<QuizzEditorSidebar />)
    fireEvent.click(
      screen.getByRole("button", { name: "Supprimer question 1" }),
    )
    expect(state.removeQuestion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))
    expect(state.removeQuestion).toHaveBeenCalledWith(0)
    expect(state.removeQuestions).not.toHaveBeenCalled()
  })
})
