import { EVENTS } from "@rahoot/common/constants"
import type { Server } from "@rahoot/common/types/game/socket"

export class CooldownTimer {
  private readonly io: Server
  private readonly gameId: string
  private active = false
  private currentInterval: ReturnType<typeof setInterval> | null = null
  private currentResolve: (() => void) | null = null

  constructor(io: Server, gameId: string) {
    this.io = io
    this.gameId = gameId
  }

  start(seconds: number): Promise<void> {
    this.clear()

    if (seconds <= 0) {
      return Promise.resolve()
    }

    this.active = true
    let count = seconds - 1

    return new Promise<void>((resolve) => {
      this.currentResolve = resolve
      this.currentInterval = setInterval(() => {
        if (!this.active || count <= 0) {
          this.clear()

          return
        }

        this.io.to(this.gameId).emit(EVENTS.GAME.COOLDOWN, count)
        count -= 1
      }, 1000)
    })
  }

  abort() {
    this.clear()
  }

  private clear() {
    const resolve = this.currentResolve
    const interval = this.currentInterval

    this.active = false
    this.currentInterval = null
    this.currentResolve = null

    if (interval) {
      clearInterval(interval)
    }

    if (resolve) {
      resolve()
    }
  }
}
