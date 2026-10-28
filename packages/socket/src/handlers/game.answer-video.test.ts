import { EVENTS } from "@rahoot/common/constants"
import type { SocketContext } from "./types"
import { gameSocketHandlers } from "./game"
import Registry from "@rahoot/socket/services/registry"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const setup = (authorized: boolean) => {
  const handlers = new Map<string, (..._args: any[]) => void>()
  const socket = {
    rooms: new Set(authorized ? ["manager-partie"] : []),
    on: (event: string, fn: (..._args: any[]) => void) =>
      handlers.set(event, fn),
  }
  gameSocketHandlers({ io: {}, socket } as unknown as SocketContext)

  return handlers.get(EVENTS.MANAGER.SET_ANSWER_VIDEO_EXPANDED)!
}

it("réserve le mode TV aux pilotes de la partie et valide le message", () => {
  const setAnswerVideoExpanded = vi.fn(() => true)
  const lookup = vi
    .spyOn(Registry.getInstance(), "getGameById")
    .mockReturnValue({
      setAnswerVideoExpanded,
    } as never)
  const ack = vi.fn()
  const payload = { gameId: "partie", questionNumber: 2, expanded: true }

  setup(false)(payload, ack)
  setup(true)({ ...payload, expanded: "true" }, ack)
  setup(true)({ ...payload, questionNumber: -1 }, ack)
  expect(lookup).not.toHaveBeenCalled()
  expect(ack).toHaveBeenLastCalledWith({ ok: false })

  setup(true)(payload, ack)
  expect(setAnswerVideoExpanded).toHaveBeenCalledWith(true, 2)
  expect(ack).toHaveBeenLastCalledWith({ ok: true })
  setup(true)({ ...payload, expanded: false }, ack)
  expect(setAnswerVideoExpanded).toHaveBeenLastCalledWith(false, 2)
})

it("acquitte une partie absente sans accepter la commande", () => {
  vi.spyOn(Registry.getInstance(), "getGameById").mockReturnValue(undefined)
  const ack = vi.fn()
  setup(true)({ gameId: "partie", questionNumber: 1, expanded: true }, ack)
  expect(ack).toHaveBeenCalledWith({ ok: false })
})
