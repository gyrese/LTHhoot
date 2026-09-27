import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { McqAnswers, TrueFalseAnswers } from "./AnswersDisplay"

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))

const box = (fill?: string, textColor?: string) => ({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill,
  textColor,
})

describe("McqAnswers", () => {
  it("reprend les couleurs de la mise en page sur le téléphone", () => {
    render(
      <McqAnswers
        answers={["A", "B"]}
        iconOnly
        onAnswer={() => undefined}
        answerBoxes={[box("#7c3aed", "#facc15"), box()]}
      />,
    )

    const [first, second] = screen.getAllByRole("button")

    expect(first).toHaveProperty("style.backgroundColor", "rgb(124, 58, 237)")
    expect(first?.className).not.toContain("bg-red")
    // Sans couleur personnalisée, la case garde la couleur par défaut.
    expect(second).toHaveProperty("style.backgroundColor", "")
    expect(second?.className).toContain("bg-blue")
  })

  it("garde les couleurs par défaut sans mise en page", () => {
    render(<McqAnswers answers={["A"]} iconOnly onAnswer={() => undefined} />)

    expect(screen.getByRole("button")).toHaveProperty(
      "style.backgroundColor",
      "",
    )
  })
})

describe("TrueFalseAnswers", () => {
  it("reprend la couleur de fond personnalisée de « Vrai »", () => {
    render(<TrueFalseAnswers answerBoxes={[box(), box("#00c950")]} />)

    const [falseButton, trueButton] = screen.getAllByRole("button")

    expect(falseButton?.className).toContain("bg-red-500")
    expect(trueButton).toHaveProperty(
      "style.backgroundColor",
      "rgb(0, 201, 80)",
    )
  })
})
