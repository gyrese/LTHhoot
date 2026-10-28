// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PlayerRecovery } from "./PlayerRecovery"
import { EVENTS } from "@rahoot/common/constants"

const mocks = vi.hoisted(() => ({ emit: vi.fn() }))
vi.mock("@rahoot/web/features/game/contexts/socket-context", () => ({
  useSocket: () => ({
    isConnected: true,
    socket: { timeout: () => ({ emit: mocks.emit }) },
  }),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it("génère un QR et une adresse copiable pour le joueur choisi", async () => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  mocks.emit.mockImplementation((_event, _payload, ack) =>
    ack(null, { token: "secret", expiresAt: Date.now() + 600_000 }),
  )
  const copy = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: copy },
    configurable: true,
  })
  const { container } = render(
    <PlayerRecovery gameId="partie" playerId="joueur" username="Alice" />,
  )
  fireEvent.click(screen.getByText("action"))
  expect(mocks.emit).toHaveBeenCalledWith(
    EVENTS.MANAGER.CREATE_RECOVERY,
    { gameId: "partie", playerId: "joueur" },
    expect.any(Function),
  )
  const input = container.querySelector("input")!
  expect(input.value).toContain("/recover/partie#secret")
  expect(container.querySelector("svg")).not.toBeNull()
  fireEvent.click(screen.getByText("copy"))
  await waitFor(() => expect(copy).toHaveBeenCalledWith(input.value))
})
it("affiche une erreur récupérable si le joueur est absent", () => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  mocks.emit.mockImplementation((_event, _payload, ack) =>
    ack(null, { error: "recovery:unavailable" }),
  )
  const { container } = render(
    <PlayerRecovery gameId="partie" playerId="joueur" username="Alice" />,
  )
  fireEvent.click(screen.getByText("action"))
  expect(screen.getByText("unavailable")).toBeDefined()
  expect(container.querySelector("svg")).toBeNull()
})
