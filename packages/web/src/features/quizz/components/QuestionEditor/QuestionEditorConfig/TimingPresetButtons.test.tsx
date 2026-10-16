// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import TimingPresetButtons from "./TimingPresetButtons"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values: { field: string; seconds?: number }) =>
      `${key}: ${values.field} ${values.seconds ?? ""}`,
  }),
}))

afterEach(cleanup)

describe("durées rapides", () => {
  it("signale la durée active et applique un choix en un clic", () => {
    const onSelect = vi.fn()
    render(
      <TimingPresetButtons
        label="Temps de réponse"
        value={20}
        presets={[10, 20, 30, 60]}
        onSelect={onSelect}
      />,
    )

    expect(
      screen.getByRole("button", { name: /20/u }).getAttribute("aria-pressed"),
    ).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: /30/u }))
    expect(onSelect).toHaveBeenCalledWith(30)
  })

  it("ne marque aucun choix actif pour une durée personnalisée", () => {
    render(
      <TimingPresetButtons
        label="Affichage"
        value={7}
        presets={[3, 5, 10, 15]}
        onSelect={vi.fn()}
      />,
    )
    expect(
      screen
        .getAllByRole("button")
        .every((button) => button.getAttribute("aria-pressed") === "false"),
    ).toBe(true)
  })
})
