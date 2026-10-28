import type { EveningSummary } from "@rahoot/common/types/evening"
import type { GameResult, Player } from "@rahoot/common/types/game"
import Config from "@rahoot/socket/services/config"
import { writeFileAtomic } from "@rahoot/socket/utils/atomic-write"
import { randomUUID } from "crypto"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

type Evening = Omit<EveningSummary, "leaderboard" | "quizCount"> & {
  owner: string
  resultIds: string[]
  players: Record<string, Omit<EveningSummary["leaderboard"][number], "rank">>
}

// Les identités de reconnexion restent exclusivement dans ce fichier serveur.
export class EveningTracker {
  private evenings: Evening[] = []
  private readonly file: string

  constructor(file?: string) {
    this.file =
      file ??
      resolve(
        process.env.CONFIG_PATH ?? resolve(process.cwd(), "../../config"),
        "state",
        "evenings.json",
      )

    if (existsSync(this.file)) {
      const parsed: unknown = JSON.parse(
        readFileSync(this.file, "utf-8").replace(/^\uFEFF/u, ""),
      )

      if (!Array.isArray(parsed)) {
        throw new Error("Archives de soirées invalides")
      }

      this.evenings = parsed as Evening[]
    }
  }

  private persist(candidate: Evening[]) {
    writeFileAtomic(this.file, JSON.stringify(candidate, null, 2))
    this.evenings = candidate
  }

  private replace(evening: Evening) {
    this.persist(
      this.evenings.map((entry) => (entry.id === evening.id ? evening : entry)),
    )
  }

  private latest(owner: string) {
    return this.evenings.findLast((evening) => evening.owner === owner)
  }

  private static summary(evening: Evening): EveningSummary {
    let rank = 0
    let previous: number | null = null
    const leaderboard = Object.values(evening.players)
      .sort((a, b) => b.points - a.points || a.id.localeCompare(b.id))
      .map((player, index) => {
        if (player.points !== previous) {
          rank = index + 1
        }

        previous = player.points

        return { ...player, rank }
      })

    return {
      id: evening.id,
      startedAt: evening.startedAt,
      ...(evening.endedAt ? { endedAt: evening.endedAt } : {}),
      quizCount: evening.resultIds.length,
      leaderboard,
    }
  }

  get(owner: string): EveningSummary | null {
    const evening = this.latest(owner)

    return evening ? EveningTracker.summary(evening) : null
  }

  getActiveId(owner: string): string | undefined {
    const evening = this.latest(owner)

    return evening && !evening.endedAt ? evening.id : undefined
  }

  start(owner: string): EveningSummary {
    const active = this.latest(owner)

    if (active && !active.endedAt) {
      return EveningTracker.summary(active)
    }

    const evening: Evening = {
      owner,
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      resultIds: [],
      players: Object.create(null),
    }
    this.persist([...this.evenings, evening])

    return EveningTracker.summary(evening)
  }

  record(
    owner: string,
    eveningId: string,
    result: GameResult,
    players: Player[],
  ): EveningSummary | null {
    const current = this.latest(owner)

    if (!current || current.endedAt || current.id !== eveningId) {
      return this.get(owner)
    }

    if (current.resultIds.includes(result.id)) {
      return EveningTracker.summary(current)
    }

    const evening = structuredClone(current)
    // Évite les propriétés spéciales d'Object.prototype après rechargement JSON.
    evening.players = Object.assign(Object.create(null), evening.players)
    const seen = new Set<string>()
    for (const player of players) {
      if (seen.has(player.clientId)) {
        continue
      }

      seen.add(player.clientId)
      const existing = Object.hasOwn(evening.players, player.clientId)
        ? evening.players[player.clientId]
        : undefined
      evening.players[player.clientId] = {
        id: existing?.id ?? randomUUID(),
        username: player.username,
        avatar: player.avatar,
        points: (existing?.points ?? 0) + player.points,
        quizCount: (existing?.quizCount ?? 0) + 1,
      }
    }
    evening.resultIds.push(result.id)
    this.replace(evening)

    return EveningTracker.summary(evening)
  }

  finish(owner: string): EveningSummary | null {
    const current = this.latest(owner)

    if (!current) {
      return null
    }

    if (current.endedAt) {
      return EveningTracker.summary(current)
    }

    const evening = structuredClone(current)
    const endedAt = new Date().toISOString()
    const summary = EveningTracker.summary(evening)
    const saved = Config.saveResult({
      id: evening.id,
      subject: "Soirée",
      date: endedAt,
      players: summary.leaderboard.map(
        ({ username, avatar, points, rank }) => ({
          username,
          avatar,
          points,
          rank,
        }),
      ),
      questions: [],
    })

    if (!saved) {
      throw new Error("Impossible de sauvegarder le résultat de la soirée")
    }

    evening.endedAt = endedAt
    this.replace(evening)

    return EveningTracker.summary(evening)
  }
}

export default new EveningTracker()
