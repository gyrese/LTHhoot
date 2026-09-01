import { EVENTS } from "@rahoot/common/constants"
import type { Server } from "@rahoot/common/types/game/socket"

export class CooldownTimer {
  private readonly io: Server
  private readonly gameId: string
  private active = false
  private count = 0
  private startedAt = 0
  private endsAt = 0
  private currentInterval: ReturnType<typeof setInterval> | null = null
  private currentResolve: (() => void) | null = null

  constructor(io: Server, gameId: string) {
    this.io = io
    this.gameId = gameId
  }

  getTimeRemaining(): number {
    return this.active ? this.count : 0
  }

  getStartedAt(): number {
    return this.active ? this.startedAt : 0
  }

  getEndsAt(): number {
    return this.active ? this.endsAt : 0
  }

  getRemainingMs(): number {
    return this.active ? Math.max(0, this.endsAt - Date.now()) : 0
  }

  start(seconds: number): Promise<void> {
    this.clear()

    if (seconds <= 0) {
      return Promise.resolve()
    }

    const now = Date.now()
    this.active = true
    this.startedAt = now
    this.endsAt = now + seconds * 1000
    this.count = seconds - 1

    return new Promise<void>((resolve) => {
      this.currentResolve = resolve
      this.currentInterval = setInterval(() => {
        if (!this.active || this.count <= 0) {
          this.clear()

          return
        }

        this.io.to(this.gameId).emit(EVENTS.GAME.COOLDOWN, this.count)
        this.count -= 1
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
