import { nanoid } from "nanoid"

export interface LogEntry {
  id: string
  timestamp: number
  level: "info" | "warn" | "error"
  message: string
}

export class GameLogger {
  private readonly entries: LogEntry[] = []
  private readonly maxEntries = 200

  log(level: LogEntry["level"], message: string): LogEntry {
    const entry: LogEntry = {
      id: nanoid(8),
      timestamp: Date.now(),
      level,
      message,
    }

    this.entries.push(entry)

    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
    }

    return entry
  }

  info(message: string): LogEntry {
    return this.log("info", message)
  }

  warn(message: string): LogEntry {
    return this.log("warn", message)
  }

  error(message: string): LogEntry {
    return this.log("error", message)
  }

  getAll(): LogEntry[] {
    return [...this.entries]
  }
}
