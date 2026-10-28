import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "./types"
import { gameSocketHandlers } from "./game"
import Registry from "@rahoot/socket/services/registry"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())
const setup = (authorized: boolean) => {
  const handlers = new Map<string, (..._args: any[]) => void>()
  const socket = {
    id: "telephone",
    handshake: { auth: { clientId: "telephone" } },
    rooms: new Set(authorized ? ["manager-partie"] : []),
    emit: vi.fn(),
    on: (event: string, fn: (..._args: any[]) => void) =>
      handlers.set(event, fn),
  }
  gameSocketHandlers({ io: {}, socket } as unknown as SocketContext)

  return handlers
}
it("réserve la génération au pilote de la partie ciblée", () => {
  const createPlayerRecovery = vi.fn(() => ({
    token: "secret",
    expiresAt: 123,
    username: "Alice",
  }))
  vi.spyOn(Registry.getInstance(), "getGameById").mockReturnValue({
    createPlayerRecovery,
  } as never)
  const ack = vi.fn()
  setup(false).get(EVENTS.MANAGER.CREATE_RECOVERY)!(
    { gameId: "partie", playerId: "joueur" },
    ack,
  )
  expect(createPlayerRecovery).not.toHaveBeenCalled()
  expect(ack).toHaveBeenCalledWith({ error: "recovery:unavailable" })
  setup(true).get(EVENTS.MANAGER.CREATE_RECOVERY)!(
    { gameId: "partie", playerId: "joueur" },
    ack,
  )
  expect(createPlayerRecovery).toHaveBeenCalledWith("joueur")
  expect(ack).toHaveBeenLastCalledWith({
    token: "secret",
    expiresAt: 123,
    username: "Alice",
  })
})
it("rejette les messages mal formés et parties absentes", () => {
  const lookup = vi
    .spyOn(Registry.getInstance(), "getGameById")
    .mockReturnValue(undefined)
  const handler = setup(false).get(EVENTS.PLAYER.RECOVER)!
  const ack = vi.fn()
  handler({ gameId: "partie", token: "faux" }, ack)
  expect(lookup).not.toHaveBeenCalled()
  handler({ gameId: "partie", token: "a".repeat(43) }, ack)
  expect(ack).toHaveBeenLastCalledWith({ error: "recovery:invalid" })
})
