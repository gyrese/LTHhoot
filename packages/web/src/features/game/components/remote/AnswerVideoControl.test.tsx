import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { EVENTS } from "@rahoot/common/constants"
import { AnswerVideoControl } from "./AnswerVideoControl"

const mocks = vi.hoisted(() => ({ emit: vi.fn(), isConnected: true }))
vi.mock("@rahoot/web/features/game/contexts/socket-context", () => ({
  useSocket: () => ({
    isConnected: mocks.isConnected,
    socket: { timeout: () => ({ emit: mocks.emit }) },
  }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
const props = {
  gameId: "partie",
  questionNumber: 2,
  expanded: false,
  disabled: false,
}

it("n'affiche le bouton que pour une explication YouTube activée", () => {
  const { rerender } = render(
    <AnswerVideoControl {...props} reveal={{ enabled: true, text: "Texte" }} />,
  )
  expect(screen.queryByRole("button")).toBeNull()
  rerender(
    <AnswerVideoControl
      {...props}
      reveal={{ enabled: false, videoId: "abcdefghijk" }}
    />,
  )
  expect(screen.queryByRole("button")).toBeNull()
})

it("demande l'agrandissement puis la réduction, selon l'état confirmé du serveur", () => {
  mocks.emit.mockImplementation((_event, _payload, ack) =>
    ack(null, { ok: true }),
  )
  const reveal = { enabled: true, videoId: "abcdefghijk" }
  const { rerender } = render(<AnswerVideoControl {...props} reveal={reveal} />)
  fireEvent.click(
    screen.getByRole("button", { name: "game:answerVideo.expand" }),
  )
  expect(mocks.emit).toHaveBeenLastCalledWith(
    EVENTS.MANAGER.SET_ANSWER_VIDEO_EXPANDED,
    { gameId: "partie", questionNumber: 2, expanded: true },
    expect.any(Function),
  )
  rerender(<AnswerVideoControl {...props} reveal={reveal} expanded />)
  const button = screen.getByRole("button", { name: "game:answerVideo.reduce" })
  expect(button.getAttribute("aria-pressed")).toBe("true")
  fireEvent.click(button)
  expect(mocks.emit).toHaveBeenLastCalledWith(
    EVENTS.MANAGER.SET_ANSWER_VIDEO_EXPANDED,
    { gameId: "partie", questionNumber: 2, expanded: false },
    expect.any(Function),
  )
})

it("signale un échec et bloque la commande hors connexion", () => {
  mocks.emit.mockImplementation((_event, _payload, ack) =>
    ack(new Error("timeout")),
  )
  const reveal = { enabled: true, videoId: "abcdefghijk" }
  const { rerender } = render(<AnswerVideoControl {...props} reveal={reveal} />)
  fireEvent.click(screen.getByRole("button"))
  expect(screen.getByRole("alert").textContent).toBe("game:answerVideo.failed")
  mocks.isConnected = false
  rerender(<AnswerVideoControl {...props} reveal={reveal} />)
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true)
  mocks.isConnected = true
})
