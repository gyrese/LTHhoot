// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import PreviewPresenterView from "./PreviewPresenterView"
import type { QuestionWithId } from "../../contexts/quizz-editor-context"

vi.mock("../../contexts/quizz-editor-context", () => ({
  useQuizzEditor: () => ({ salonImage: "", fontFamily: undefined }),
}))
vi.mock("./SlideCanvas", () => ({
  default: ({ hideYoutube }: { hideYoutube: boolean }) => (
    <div data-testid="canvas" data-hide-video={String(hideYoutube)} />
  ),
}))
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("separates the question, choices and correct solution while enabling media in preview", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
  const question: QuestionWithId = {
    id: "a",
    type: "mcq",
    question: "La question",
    cooldown: 5,
    time: 45,
    answers: ["Alpha", "Beta"],
    solutions: [0],
  }
  const { rerender } = render(
    <PreviewPresenterView
      question={question}
      phase="question"
      hideYoutube={false}
    />,
  )
  expect(screen.getByText("La question")).toBeTruthy()
  expect(screen.queryByText("Alpha")).toBeNull()
  expect(screen.getByTestId("canvas").getAttribute("data-hide-video")).toBe(
    "false",
  )
  rerender(
    <PreviewPresenterView
      question={question}
      phase="answers"
      hideYoutube={false}
    />,
  )
  expect(screen.getByText("Alpha")).toBeTruthy()
  expect(screen.getByText("Beta")).toBeTruthy()
  rerender(
    <PreviewPresenterView
      question={question}
      phase="correction"
      hideYoutube={false}
    />,
  )
  expect(screen.getByText("Alpha")).toBeTruthy()
  expect(screen.queryByText("Beta")).toBeNull()
})
