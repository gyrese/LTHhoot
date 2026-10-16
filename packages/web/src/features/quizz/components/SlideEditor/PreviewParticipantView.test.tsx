// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import PreviewParticipantView from "./PreviewParticipantView"
import type { QuestionWithId } from "../../contexts/quizz-editor-context"

vi.mock("./SlideCanvas", () => ({ default: () => null }))
vi.mock("@rahoot/web/features/game/components/LazySlideCanvas", () => ({
  default: () => null,
}))
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const question: QuestionWithId = {
  id: "a",
  type: "mcq",
  question: "Quel personnage ?",
  cooldown: 5,
  time: 45,
  media: { type: "image", url: "/personnage.png" },
  answers: ["Alpha", "Beta", "Gamma", "Delta"],
  solutions: [0],
}

it("shows the actual question and its image before answers, without a waiting placeholder", () => {
  render(<PreviewParticipantView question={question} phase="question" />)
  expect(screen.getByRole("heading", { name: question.question })).toBeTruthy()
  expect(
    screen.getByRole("img", { name: question.question }).getAttribute("src"),
  ).toBe("/personnage.png")
  expect(screen.queryByText("quizz:previewFlow.waiting")).toBeNull()
  expect(screen.queryAllByRole("button")).toHaveLength(0)
})

it("shows the real answer controls and preserves custom answer colors", () => {
  const { rerender } = render(
    <PreviewParticipantView
      question={{
        ...question,
        layout: {
          answers: [{ x: 0, y: 0, width: 100, height: 100, fill: "#123456" }],
        },
      }}
      phase="answers"
    />,
  )
  const buttons = screen.getAllByRole("button")
  expect(buttons).toHaveLength(4)
  expect(buttons[0].style.backgroundColor).toBe("rgb(18, 52, 86)")
  expect(screen.getByRole("heading", { name: question.question })).toBeTruthy()
  expect(screen.getByText("45")).toBeTruthy()
  rerender(<PreviewParticipantView question={question} phase="question" />)
  expect(screen.queryAllByRole("button")).toHaveLength(0)
})

it("uses the labelled false/true buttons used by participants", () => {
  render(
    <PreviewParticipantView
      question={{
        id: "b",
        type: "true_false",
        question: "Vrai ?",
        cooldown: 5,
        time: 10,
        solution: 1,
      }}
      phase="answers"
    />,
  )
  expect(screen.getByRole("button", { name: "game:false" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "game:true" })).toBeTruthy()
})
