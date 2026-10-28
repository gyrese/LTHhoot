import { render } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { AnswerRevealCard } from "./AnswerRevealCard"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

it("conserve le lecteur et son URL en agrandissant puis en réduisant", () => {
  const reveal = { enabled: true, videoId: "abcdefghijk", text: "Explication" }
  const { container, rerender } = render(<AnswerRevealCard reveal={reveal} />)
  const iframe = container.querySelector("iframe")!
  const { src } = iframe
  rerender(<AnswerRevealCard reveal={reveal} expanded />)
  expect(container.querySelector("iframe")).toBe(iframe)
  expect(iframe.src).toBe(src)
  expect(container.querySelector('[data-expanded="true"]')).not.toBeNull()
  rerender(<AnswerRevealCard reveal={reveal} />)
  expect(container.querySelector("iframe")).toBe(iframe)
  expect(container.querySelector('[data-expanded="false"]')).not.toBeNull()
})

it("préserve les explications image et texte sans activer le mode TV", () => {
  const { container, rerender } = render(
    <AnswerRevealCard
      reveal={{ enabled: true, image: "/image.png", text: "Texte" }}
      expanded
    />,
  )
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/image.png")
  expect(container.textContent).toContain("Texte")
  expect(container.querySelector('[data-expanded="true"]')).toBeNull()
  rerender(
    <AnswerRevealCard reveal={{ enabled: false, videoId: "abcdefghijk" }} />,
  )
  expect(container.childElementCount).toBe(0)
})
