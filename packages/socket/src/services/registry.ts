import type { Server } from "@rahoot/common/types/game/socket"
import Game from "@rahoot/socket/services/game"
import Persistence from "@rahoot/socket/services/persistence"
import { logHandlerError } from "@rahoot/socket/utils/safe-handler"
import dayjs from "dayjs"

interface EmptyGame {
  since: number
  game: Game
}

class Registry {
  private static instance: Registry | null = null
  private games: Game[] = []
  private emptyGames: EmptyGame[] = []
  private cleanupInterval: ReturnType<typeof setTimeout> | null = null
  private readonly EMPTY_GAME_TIMEOUT_MINUTES = 5
  private readonly CLEANUP_INTERVAL_MS = 60_000

  // Persistance : instantané périodique de toutes les parties sur disque, pour
  // survivre à un crash/redéploiement (cf. services/persistence).
  private readonly persistence = new Persistence()
  private persistInterval: ReturnType<typeof setTimeout> | null = null
  private lastSerialized = ""
  private readonly PERSIST_INTERVAL_MS = 3_000

  private constructor() {
    this.startCleanupTask()
    this.startPersistTask()
  }

  static getInstance(): Registry {
    Registry.instance ||= new Registry()

    return Registry.instance
  }

  addGame(game: Game): void {
    this.games.push(game)
    console.log(`Game ${game.gameId} added. Total games: ${this.games.length}`)
  }

  getGameById(gameId: string): Game | undefined {
    return this.games.find((g) => g.gameId === gameId)
  }

  getGameByInviteCode(inviteCode: string): Game | undefined {
    return this.games.find((g) => g.inviteCode === inviteCode)
  }

  getPlayerGame(gameId: string, clientId: string): Game | undefined {
    return this.games.find(
      (g) =>
        g.gameId === gameId && g.players.some((p) => p.clientId === clientId),
    )
  }

  getManagerGame(gameId: string, clientId: string): Game | undefined {
    return this.games.find(
      (g) => g.gameId === gameId && g.manager.clientId === clientId,
    )
  }

  getGameByManagerSocketId(socketId: string): Game | undefined {
    return this.games.find((g) => g.manager.id === socketId)
  }

  getGameByPlayerSocketId(socketId: string): Game | undefined {
    return this.games.find((g) => g.players.some((p) => p.id === socketId))
  }

  markGameAsEmpty(game: Game): void {
    const alreadyEmpty = this.emptyGames.find(
      (g) => g.game.gameId === game.gameId,
    )

    if (!alreadyEmpty) {
      this.emptyGames.push({
        since: dayjs().unix(),
        game,
      })
      console.log(
        `Game ${game.gameId} marked as empty. Total empty games: ${this.emptyGames.length}`,
      )
    }
  }

  reactivateGame(gameId: string): void {
    const initialLength = this.emptyGames.length
    this.emptyGames = this.emptyGames.filter((g) => g.game.gameId !== gameId)

    if (this.emptyGames.length < initialLength) {
      console.log(
        `Game ${gameId} reactivated. Remaining empty games: ${this.emptyGames.length}`,
      )
    }
  }

  removeGame(gameId: string): boolean {
    const initialLength = this.games.length
    this.games = this.games.filter((g) => g.gameId !== gameId)
    this.emptyGames = this.emptyGames.filter((g) => g.game.gameId !== gameId)

    const removed = this.games.length < initialLength

    if (removed) {
      console.log(`Game ${gameId} removed. Total games: ${this.games.length}`)
    }

    return removed
  }

  getAllGames(): Game[] {
    return [...this.games]
  }

  getGameCount(): number {
    return this.games.length
  }

  getEmptyGameCount(): number {
    return this.emptyGames.length
  }

  private cleanupEmptyGames(): void {
    const now = dayjs()
    const stillEmpty = this.emptyGames.filter(
      (g) =>
        // Garde de sécurité : ne JAMAIS purger une partie qui a encore des
        // joueurs connectés. L'écran manager peut s'être déconnecté (partie
        // marquée « empty ») alors que la partie est toujours jouée et pilotée
        // depuis la télécommande — la détruire éjecterait tout le monde.
        g.game.hasConnectedPlayers ||
        now.diff(dayjs.unix(g.since), "minute") <
          this.EMPTY_GAME_TIMEOUT_MINUTES,
    )

    if (stillEmpty.length === this.emptyGames.length) {
      return
    }

    const removed = this.emptyGames.filter((g) => !stillEmpty.includes(g))
    const removedGameIds = removed.map((r) => r.game.gameId)

    this.games = this.games.filter((g) => !removedGameIds.includes(g.gameId))
    this.emptyGames = stillEmpty

    console.log(
      `Removed ${removed.length} empty game(s). Remaining games: ${this.games.length}`,
    )
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupEmptyGames()
    }, this.CLEANUP_INTERVAL_MS)

    console.log("Game cleanup task started")
  }

  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      console.log("Game cleanup task stopped")
    }
  }

  // ── Persistance ────────────────────────────────────────────────────────────

  private startPersistTask(): void {
    this.persistInterval = setInterval(() => {
      this.persistSnapshot()
    }, this.PERSIST_INTERVAL_MS)
  }

  private stopPersistTask(): void {
    if (this.persistInterval) {
      clearInterval(this.persistInterval)
      this.persistInterval = null
    }
  }

  // Écrit un instantané de toutes les parties — uniquement si l'état a changé
  // depuis le dernier write (évite des écritures disque inutiles).
  private persistSnapshot(): void {
    try {
      const snapshots = this.games.map((g) => g.serialize())
      const json = JSON.stringify(snapshots)

      if (json === this.lastSerialized) {
        return
      }

      this.lastSerialized = json
      this.persistence.write(json)
    } catch (err) {
      logHandlerError("registry.persistSnapshot", err)
    }
  }

  // Recharge les parties depuis le disque au démarrage du serveur. Les parties
  // restaurées sont marquées « empty » : si personne ne se reconnecte, elles sont
  // purgées par le nettoyage habituel (5 min) ; toute reconnexion les réactive.
  loadFromDisk(io: Server): void {
    const snapshots = this.persistence.read()

    if (snapshots.length === 0) {
      return
    }

    let restored = 0

    for (const snapshot of snapshots) {
      try {
        const game = Game.restore(io, snapshot)

        if (game) {
          this.games.push(game)
          this.markGameAsEmpty(game)
          restored += 1
        }
      } catch (err) {
        logHandlerError(`registry.loadFromDisk game=${snapshot.gameId}`, err)
      }
    }

    console.log(
      `Restored ${restored} game(s) from disk (out of ${snapshots.length} snapshot(s))`,
    )
  }

  cleanup(): void {
    this.stopCleanupTask()
    this.stopPersistTask()
    this.games = []
    this.emptyGames = []
    console.log("Registry cleaned up")
  }
}

export default Registry
