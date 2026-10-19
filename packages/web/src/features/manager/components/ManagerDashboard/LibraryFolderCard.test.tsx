// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import LibraryFolderCard from "./LibraryFolderCard"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options: { count: number }) => `${options.count} quiz`,
  }),
}))
afterEach(cleanup)

const quizzes = Array.from({ length: 4 }, (_, index) => ({
  id: `quiz-${index}`,
  subject: `Quiz ${index}`,
  listingImage: `/cover-${index}.jpg`,
  questionCount: 10,
}))

it("opens the named folder with its actual cover stack and total count", () => {
  const onOpen = vi.fn()
  const { container } = render(
    <LibraryFolderCard
      path="Culture/Cinéma"
      quizzes={quizzes}
      list={false}
      onOpen={onOpen}
      onDropQuiz={vi.fn()}
      canDropQuiz={() => false}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Cinéma, 4 quiz" }))
  expect(onOpen).toHaveBeenCalledOnce()
  expect(
    Array.from(container.querySelectorAll("img"), (image) =>
      image.getAttribute("src"),
    ),
  ).toEqual(["/cover-0.jpg", "/cover-1.jpg", "/cover-2.jpg"])
  expect(container.querySelectorAll("button")).toHaveLength(1)
})

it("permits only quiz drags and rechecks the real quiz id at drop", () => {
  const onDropQuiz = vi.fn()
  const canDropQuiz = vi.fn((id: string) => id === "" || id === "allowed")
  render(
    <LibraryFolderCard
      path="Culture"
      quizzes={[]}
      list
      onOpen={vi.fn()}
      onDropQuiz={onDropQuiz}
      canDropQuiz={canDropQuiz}
    />,
  )
  const folder = screen.getByRole("button")
  const protectedDrag = {
    types: ["quizzid"],
    getData: () => "",
    dropEffect: "none",
  }
  fireEvent.dragOver(folder, { dataTransfer: protectedDrag })
  expect(protectedDrag.dropEffect).toBe("move")
  fireEvent.drop(folder, {
    dataTransfer: { ...protectedDrag, getData: () => "forbidden" },
  })
  expect(onDropQuiz).not.toHaveBeenCalled()
  fireEvent.drop(folder, {
    dataTransfer: { ...protectedDrag, getData: () => "allowed" },
  })
  expect(onDropQuiz).toHaveBeenCalledExactlyOnceWith("allowed")
  const unrelatedDrag = {
    types: ["Files"],
    getData: () => "allowed",
    dropEffect: "none",
  }
  fireEvent.dragOver(folder, { dataTransfer: unrelatedDrag })
  expect(unrelatedDrag.dropEffect).toBe("none")
})

it("keeps a read-only folder from accepting any drag", () => {
  const onDropQuiz = vi.fn()
  render(
    <LibraryFolderCard
      path="Invités"
      quizzes={[]}
      list={false}
      onOpen={vi.fn()}
      onDropQuiz={onDropQuiz}
      canDropQuiz={() => false}
    />,
  )
  const drag = {
    types: ["quizzid"],
    getData: () => "quiz-0",
    dropEffect: "none",
  }
  fireEvent.dragOver(screen.getByRole("button"), { dataTransfer: drag })
  fireEvent.drop(screen.getByRole("button"), { dataTransfer: drag })
  expect(drag.dropEffect).toBe("none")
  expect(onDropQuiz).not.toHaveBeenCalled()
})
