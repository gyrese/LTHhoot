// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import PresentationPage from "./PresentationPage"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "fr" },
  }),
}))
afterEach(cleanup)

it("reveals a correct answer locally and lets the visitor play again", () => {
  render(<PresentationPage />)
  const answer = screen.getByRole("button", { name: /Saint-Denis/u })
  fireEvent.click(answer)
  expect(screen.getByText("demo.correct")).toBeTruthy()
  expect(answer.hasAttribute("disabled")).toBe(true)
  expect(answer.classList.contains("is-correct")).toBe(true)
  expect(answer.classList.contains("presentation-answer-1")).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "demo.again" }))
  expect(screen.getByText("demo.ready")).toBeTruthy()
  expect(answer.hasAttribute("disabled")).toBe(false)
})

it("reveals the right answer after an incorrect choice", () => {
  render(<PresentationPage />)
  fireEvent.click(screen.getByRole("button", { name: /Saint-Pierre/u }))
  expect(screen.getByText("demo.incorrect")).toBeTruthy()
  expect(
    screen
      .getByRole("button", { name: /Saint-Denis/u })
      .classList.contains("is-correct"),
  ).toBe(true)
  expect(
    screen
      .getByRole("button", { name: /Saint-Pierre/u })
      .classList.contains("is-incorrect"),
  ).toBe(true)
  expect(
    screen
      .getByRole("button", { name: /Saint-Paul/u })
      .classList.contains("is-muted"),
  ).toBe(true)
})
