// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type {
  WorkshopReply,
  WorkshopRequest,
} from "@rahoot/common/validators/ai-workshop"
import AIGeneratorModal from "./index"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  timeout: vi.fn(),
  importQuestions: vi.fn(),
  socket: { connected: true, timeout: vi.fn() },
}))
vi.mock("@rahoot/web/features/game/contexts/socket-context", () => ({
  useSocket: () => ({ socket: mocks.socket }),
}))
vi.mock("../../contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => ({
    quizzId: "test",
    subject: "Disney",
    questions: [{ question: "Question déjà présente" }],
    importQuestions: mocks.importQuestions,
  }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }))

const first = {
  type: "mcq" as const,
  question: "Qui est Mickey ?",
  answers: ["Une souris", "Un chat"],
  solutions: [0],
  time: 45,
  cooldown: 5,
}
const second = {
  ...first,
  question: "Qui est Donald ?",
  answers: ["Un canard", "Un chien"],
}
let callback: (_error: Error | null, _reply: WorkshopReply) => void = () => {
  throw new Error("No pending AI request")
}
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.socket.connected = true
  mocks.socket.timeout.mockReturnValue({ emit: mocks.emit })
  mocks.emit.mockImplementation(
    (_event: string, _request: WorkshopRequest, reply: typeof callback) => {
      callback = reply
    },
  )
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "")
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open")
    },
  })
})
afterEach(cleanup)
const send = (text: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: "Message à l’IA" }), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole("button", { name: "Envoyer" }))
}
const replyWithQuestions = () =>
  act(() =>
    callback(null, {
      result: {
        message: "Voici deux questions.",
        operations: [
          { type: "add", question: first },
          { type: "add", question: second },
        ],
      },
    }),
  )

it("keeps locked questions during targeted revisions and imports only retained proposals once", () => {
  render(<AIGeneratorModal open onClose={vi.fn()} />)
  send("Deux questions Disney")
  expect(mocks.emit.mock.calls[0][1].existingQuestions).toEqual([
    "Question déjà présente",
  ])
  replyWithQuestions()
  fireEvent.click(
    screen.getByRole("button", { name: "Protéger la question 1" }),
  )
  expect(
    (
      screen.getByRole("button", {
        name: "Remplacer la question 1",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true)
  fireEvent.click(
    screen.getByRole("button", { name: "Remplacer la question 2" }),
  )
  const request = mocks.emit.mock.calls[1][1] as WorkshopRequest
  expect(request.targetIds).toEqual([request.questions[1].id])
  expect(request.questions[0].locked).toBe(true)
  act(() =>
    callback(null, {
      result: {
        message: "Question remplacée",
        operations: [
          {
            type: "replace",
            id: request.questions[1].id,
            question: { ...second, question: "Qui est Dingo ?" },
          },
        ],
      },
    }),
  )
  expect(screen.getByText("Qui est Mickey ?", { selector: "p" })).toBeTruthy()
  expect(screen.getByText("Qui est Dingo ?", { selector: "p" })).toBeTruthy()
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Ajouter la question 2" }),
  )
  fireEvent.click(screen.getByRole("button", { name: "Ajouter au quiz (1)" }))
  expect(mocks.importQuestions).toHaveBeenCalledWith([first])
  expect(screen.queryByText("Qui est Mickey ?", { selector: "p" })).toBeNull()
  expect(screen.getByText("Qui est Dingo ?", { selector: "p" })).toBeTruthy()
})

it("preserves the draft after quota errors, retries and restores it after reopening", () => {
  const close = vi.fn()
  const view = render(<AIGeneratorModal open onClose={close} />)
  send("Deux questions Disney")
  replyWithQuestions()
  send("Plus difficile")
  act(() => callback(null, { error: "Quota atteint" }))
  expect(screen.getByRole("alert").textContent).toContain("Quota atteint")
  expect(screen.getByText(first.question, { selector: "p" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
  expect(mocks.emit).toHaveBeenCalledTimes(3)
  act(() =>
    callback(null, {
      result: { message: "Conservons ces questions.", operations: [] },
    }),
  )
  view.rerender(<AIGeneratorModal open={false} onClose={close} />)
  view.rerender(<AIGeneratorModal open onClose={close} />)
  expect(screen.getByText(first.question, { selector: "p" })).toBeTruthy()
  view.unmount()
  render(<AIGeneratorModal open onClose={close} />)
  expect(screen.getByText(first.question, { selector: "p" })).toBeTruthy()
  expect(screen.getByText("Conservons ces questions.")).toBeTruthy()
})

it("can close during a request and receives its result on reopening without a second call", () => {
  const view = render(<AIGeneratorModal open onClose={vi.fn()} />)
  send("Deux questions Disney")
  view.rerender(<AIGeneratorModal open={false} onClose={vi.fn()} />)
  replyWithQuestions()
  view.rerender(<AIGeneratorModal open onClose={vi.fn()} />)
  expect(screen.getByText(first.question, { selector: "p" })).toBeTruthy()
  expect(mocks.emit).toHaveBeenCalledTimes(1)
})

it("allows editing answers and undoing an AI revision", () => {
  render(<AIGeneratorModal open onClose={vi.fn()} />)
  send("Deux questions Disney")
  replyWithQuestions()
  fireEvent.change(screen.getAllByLabelText("Réponse 1")[0], {
    target: { value: "Une petite souris" },
  })
  fireEvent.click(screen.getAllByText("Appliquer les modifications")[0])
  expect(
    (screen.getAllByLabelText("Réponse 1")[0] as HTMLInputElement).value,
  ).toBe("Une petite souris")
  fireEvent.click(
    screen.getByRole("button", { name: "Annuler la dernière modification" }),
  )
  expect(
    (screen.getAllByLabelText("Réponse 1")[0] as HTMLInputElement).value,
  ).toBe("Une souris")
})
