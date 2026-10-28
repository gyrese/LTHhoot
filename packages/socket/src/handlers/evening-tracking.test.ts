import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "./types"
import { eveningTrackingHandlers } from "./evening-tracking"
import tracker from "@rahoot/socket/services/evening-tracker"
import manager from "@rahoot/socket/services/manager"
import Registry from "@rahoot/socket/services/registry"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const setup = (authorized = true) => {
  const handlers = new Map<string, (..._args: any[]) => void>()
  const socket = {
    handshake: { auth: { clientId: "proprietaire" } },
    emit: vi.fn(),
    join: vi.fn(),
    on: (event: string, fn: (..._args: any[]) => void) =>
      handlers.set(event, fn),
  }
  vi.spyOn(manager, "isLogged").mockReturnValue(authorized)
  const emit = vi.fn()
  const io = { to: vi.fn(() => ({ emit })) }
  eveningTrackingHandlers({ io, socket } as unknown as SocketContext)

  return { handlers, socket, io, emit }
}

it("réserve le démarrage et la clôture aux administrateurs", () => {
  const start = vi.spyOn(tracker, "start")
  const finish = vi.spyOn(tracker, "finish")
  const { handlers, socket } = setup(false)
  const ack = vi.fn()
  handlers.get(EVENTS.EVENING.OPEN)!(ack)
  handlers.get(EVENTS.EVENING.CLOSE)!(ack)
  expect(start).not.toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(socket.emit).toHaveBeenCalledWith(EVENTS.MANAGER.UNAUTHORIZED)
})

it("rattache la soirée au propriétaire authentifié et diffuse son état", () => {
  const evening = { id: "s1", startedAt: "date", quizCount: 0, leaderboard: [] }
  const start = vi.spyOn(tracker, "start").mockReturnValue(evening)
  const { handlers, io, emit } = setup()
  const ack = vi.fn()
  handlers.get(EVENTS.EVENING.OPEN)!(ack)
  expect(start).toHaveBeenCalledWith("proprietaire")
  expect(io.to).toHaveBeenCalledWith("evening-owner-proprietaire")
  expect(emit).toHaveBeenCalledWith(EVENTS.EVENING.STATE, evening)
  expect(ack).toHaveBeenCalledWith({ evening })
})

it("refuse de clôturer pendant un quiz ou un salon avec joueurs", () => {
  vi.spyOn(tracker, "getActiveId").mockReturnValue("s1")
  const finish = vi.spyOn(tracker, "finish")
  const games = vi.spyOn(Registry.getInstance(), "getGamesByManagerClientId")
  const { handlers } = setup()
  const ack = vi.fn()
  for (const started of [true, false]) {
    games.mockReturnValue([
      { eveningTrackingId: "s1", started, hasConnectedPlayers: !started },
    ] as never)
    handlers.get(EVENTS.EVENING.CLOSE)!(ack)
  }
  expect(finish).not.toHaveBeenCalled()
  expect(ack).toHaveBeenCalledWith({
    error: "manager:eveningTracking.gameInProgress",
  })
})

it("signale une écriture impossible au lieu de confirmer un démarrage", () => {
  vi.spyOn(tracker, "start").mockImplementation(() => {
    throw new Error("disque")
  })
  const { handlers } = setup()
  const ack = vi.fn()
  handlers.get(EVENTS.EVENING.OPEN)!(ack)
  expect(ack).toHaveBeenCalledWith({
    error: "manager:eveningTracking.saveError",
  })
})
