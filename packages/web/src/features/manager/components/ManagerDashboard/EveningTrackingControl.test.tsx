// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import EveningTrackingControl from "./EveningTrackingControl"
import { EVENTS } from "@rahoot/common/constants"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock("@rahoot/web/features/game/contexts/socket-context", () => ({
  useSocket: () => ({
    socket: { connected: true, emit: mocks.emit },
    isConnected: true,
  }),
  useEvent: vi.fn(),
}))
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("react-hot-toast", () => ({
  default: { success: mocks.success, error: mocks.error },
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

it("d�marre une seule soir�e et confirme la sauvegarde apr�s r�ponse", () => {
  render(<EveningTrackingControl />)
  const button = screen.getByRole("button", {
    name: "manager:eveningTracking.start",
  })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(mocks.emit).toHaveBeenCalledTimes(1)
  expect(mocks.emit.mock.calls[0][0]).toBe(EVENTS.EVENING.OPEN)
  act(() =>
    mocks.emit.mock.calls[0][1]({
      evening: { id: "e", startedAt: "now", quizCount: 0, leaderboard: [] },
    }),
  )
  expect(mocks.success).toHaveBeenCalledWith(
    "manager:eveningTracking.started",
    { duration: 6000 },
  )
})

it("ignore une r�ponse re�ue apr�s expiration de la demande", () => {
  vi.useFakeTimers()
  render(<EveningTrackingControl />)
  fireEvent.click(
    screen.getByRole("button", { name: "manager:eveningTracking.start" }),
  )
  const [[, acknowledge]] = mocks.emit.mock.calls
  act(() => vi.advanceTimersByTime(10000))
  acknowledge({
    evening: { id: "e", startedAt: "now", quizCount: 0, leaderboard: [] },
  })
  expect(mocks.error).toHaveBeenCalledWith("manager:eveningTracking.timeout")
  expect(mocks.success).not.toHaveBeenCalled()
})
