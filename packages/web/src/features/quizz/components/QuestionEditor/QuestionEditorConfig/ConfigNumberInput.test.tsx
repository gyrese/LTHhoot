// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useState } from "react"
import ConfigNumberInput from "./ConfigNumberInput"

afterEach(cleanup)

it("allows an intermediate digit below the minimum while typing a longer duration", () => {
  const change = vi.fn()
  const Controlled = () => {
    const [value, setValue] = useState(20)
    return (
      <ConfigNumberInput
        value={value}
        min={5}
        max={600}
        onChange={(next) => {
          change(next)
          setValue(next)
        }}
      />
    )
  }
  render(<Controlled />)
  const input = screen.getByRole("spinbutton") as HTMLInputElement
  fireEvent.change(input, { target: { value: "3" } })
  expect(input.value).toBe("3")
  expect(change).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: "30" } })
  expect(input.value).toBe("30")
  expect(change).toHaveBeenCalledWith(30)
  fireEvent.change(input, { target: { value: "999" } })
  expect(input.value).toBe("999")
  fireEvent.blur(input)
  expect(input.value).toBe("600")
  expect(change).toHaveBeenLastCalledWith(600)
})

it("restores an empty field on blur without writing zero", () => {
  const change = vi.fn()
  render(<ConfigNumberInput value={20} min={5} max={600} onChange={change} />)
  const input = screen.getByRole("spinbutton") as HTMLInputElement
  fireEvent.change(input, { target: { value: "" } })
  fireEvent.blur(input)
  expect(input.value).toBe("20")
  expect(change).not.toHaveBeenCalled()
})
