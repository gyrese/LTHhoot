// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import LazySlidePreview from "./LazySlidePreview"
import type { QuestionWithId } from "../contexts/quizz-editor-context"

vi.mock("./SlideEditor/PreviewPresenterView", () => ({
  default: ({ question }: { question: QuestionWithId }) => (
    <div data-testid="preview">{question.question}</div>
  ),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("shares one observer and mounts heavy previews only while visible", () => {
  let callback: IntersectionObserverCallback = () => undefined
  const targets: Element[] = []
  const disconnect = vi.fn()
  const unobserve = vi.fn()
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observed = targets
      constructor(onEntries: IntersectionObserverCallback) {
        callback = onEntries
      }
      observe = (element: Element) => {
        this.observed.push(element)
      }
      unobserve = unobserve
      disconnect = disconnect
    },
  )
  const question = {
    id: "a",
    type: "title",
    question: "Slide",
    cooldown: 5,
    time: 20,
  } as QuestionWithId
  const { unmount } = render(
    <>
      <LazySlidePreview question={question} />
      <LazySlidePreview question={{ ...question, id: "b" }} />
    </>,
  )
  expect(targets).toHaveLength(2)
  expect(screen.queryAllByTestId("preview")).toHaveLength(0)
  act(() => {
    callback(
      targets.map((target) => ({
        target,
        isIntersecting: true,
      })) as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(screen.getAllByTestId("preview")).toHaveLength(2)
  act(() => {
    callback(
      [
        { target: targets[0], isIntersecting: false },
      ] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    )
  })
  expect(screen.getAllByTestId("preview")).toHaveLength(1)
  unmount()
  expect(unobserve).toHaveBeenCalledTimes(2)
  expect(disconnect).toHaveBeenCalledTimes(1)
})
