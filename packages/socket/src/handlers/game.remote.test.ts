import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "@rahoot/socket/handlers/types"
import { gameSocketHandlers } from "@rahoot/socket/handlers/game"
import Registry from "@rahoot/socket/services/registry"
import Manager from "@rahoot/socket/services/manager"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const setup = () => {
  const handlers = new Map<string, (_payload: unknown) => void>()
  const socket = {
    id: "remote-phone",
    handshake: { auth: { clientId: "remote-phone" } },
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (_payload: unknown) => void) => {
      handlers.set(event, handler)
    }),
  }
  const context = { io: {}, socket } as unknown as SocketContext
  gameSocketHandlers(context)

  return {
    socket,
    context,
    connect: handlers.get(EVENTS.MANAGER.REMOTE_CONNECT)!,
  }
}

describe("télécommande sans PIN", () => {
  it("connecte un téléphone sans authentification sans remplacer l'hôte ni donner accès admin", () => {
    const reconnectRemote = vi.fn()
    const reconnect = vi.fn()
    vi.spyOn(Registry.getInstance(), "getGameById").mockReturnValue({
      reconnectRemote,
      reconnect,
    } as never)
    const { socket, context, connect } = setup()
    connect({ gameId: "active-game" })
    expect(reconnectRemote).toHaveBeenCalledWith(socket)
    expect(reconnect).not.toHaveBeenCalled()
    expect(Manager.getSession(context.socket)).toBeUndefined()
    // Une reconnexion réseau suit exactement la même voie sans PIN.
    connect({ gameId: "active-game" })
    expect(reconnectRemote).toHaveBeenCalledTimes(2)
  })

  it.each([undefined, {}, { gameId: "missing" }])(
    "refuse une partie absente ou un message invalide: %j",
    (payload) => {
      vi.spyOn(Registry.getInstance(), "getGameById").mockReturnValue(undefined)
      const { socket, connect } = setup()
      connect(payload)
      expect(socket.emit).toHaveBeenCalledWith(
        EVENTS.GAME.RESET,
        "errors:game.notFound",
      )
    },
  )
})
