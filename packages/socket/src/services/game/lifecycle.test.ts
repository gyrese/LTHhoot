import type { Quizz } from "@rahoot/common/types/game"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import Game from "@rahoot/socket/services/game"
import { PlayerManager } from "@rahoot/socket/services/game/player-manager"
import {
  playerToSnapshot,
  snapshotToPlayer,
} from "@rahoot/socket/services/persistence"
import Registry from "@rahoot/socket/services/registry"
import { afterAll, describe, expect, it, vi } from "vitest"

// Serveur socket factice : absorbe toutes les émissions, et mémorise les
// sockets qui quittent une room (dispose).
const leftRooms: string[] = []
const emitted: { room: string; event: string; data: unknown }[] = []
const io = {
  to: (room: string) => ({
    emit: (event: string, data: unknown) => {
      emitted.push({ room, event, data })
    },
  }),
  in: () => ({
    socketsLeave: (room: string) => {
      leftRooms.push(room)
    },
  }),
  sockets: { sockets: new Map() },
} as unknown as Server

const fakeSocket = (id: string, clientId = id) =>
  ({
    id,
    handshake: { auth: { clientId } },
    join: vi.fn(),
    emit: vi.fn(),
    rooms: new Set<string>(),
  }) as unknown as Socket

const quizz: Quizz = {
  subject: "Cycle de vie",
  questions: [
    { type: "true_false", question: "?", solution: 1, time: 5, cooldown: 5 },
  ],
}

afterAll(() => {
  Registry.getInstance().cleanup()
})

describe("Game.dispose", () => {
  it("removeGame libère les timers et fait quitter les rooms", () => {
    vi.useFakeTimers()

    const registry = Registry.getInstance()
    const game = new Game(io, fakeSocket("manager"), quizz)
    registry.addGame(game)
    game.join(fakeSocket("p1"), "Joueur1")
    // Retrait différé (30 s) armé par une déconnexion en salle d'attente.
    game.schedulePlayerRemoval("p1")

    expect(vi.getTimerCount()).toBeGreaterThan(0)

    registry.removeGame(game.gameId)

    expect(vi.getTimerCount()).toBe(0)
    expect(leftRooms).toContain(game.gameId)
    expect(leftRooms).toContain(`manager-${game.gameId}`)
    expect(registry.getGameById(game.gameId)).toBeUndefined()

    vi.useRealTimers()
  })

  it("une partie sans joueur n'est pas à conserver, une partie avec joueurs l'est", () => {
    const game = new Game(io, fakeSocket("manager2"), quizz)

    expect(game.isWorthKeeping).toBe(false)
    game.join(fakeSocket("p2"), "Joueur2")
    expect(game.isWorthKeeping).toBe(true)
    game.dispose()
  })
})

describe("PlayerManager.join", () => {
  it("une ré-inscription du même clientId conserve les points", () => {
    const players = new PlayerManager(io, "g1")

    players.join(fakeSocket("s1", "c1"), "Alice")
    players.getAll()[0]!.points = 1200

    const result = players.join(fakeSocket("s2", "c1"), "Alice2")

    expect(result).toMatchObject({ status: "rejoined", oldId: "s1" })
    expect(players.getAll()).toHaveLength(1)
    expect(players.getAll()[0]).toMatchObject({
      id: "s2",
      username: "Alice2",
      points: 1200,
    })
  })

  it("un pseudo invalide ne retire pas le joueur existant", () => {
    const players = new PlayerManager(io, "g1")

    players.join(fakeSocket("s1", "c1"), "Alice")
    players.getAll()[0]!.points = 500

    expect(players.join(fakeSocket("s2", "c1"), "A").status).toBe("error")
    expect(players.getAll()[0]).toMatchObject({ id: "s1", points: 500 })
  })

  it("ne diffuse jamais le clientId au manager", () => {
    emitted.length = 0
    const players = new PlayerManager(io, "g9")

    players.join(fakeSocket("s1", "secret-client"), "Alice")

    expect(JSON.stringify(emitted)).not.toContain("secret-client")
  })
})

describe("persistence — migration tolérante", () => {
  it("restaure pièces et inventaire, et accepte un ancien instantané", () => {
    const snapshot = playerToSnapshot(
      {
        id: "s1",
        clientId: "c1",
        connected: true,
        username: "Alice",
        points: 10,
        streak: 1,
        goldCoins: 350,
      },
      [{ id: "pu1", type: "SHIELD", earnedAt: 1 }],
    )

    expect(snapshot).toMatchObject({
      goldCoins: 350,
      powerUps: [{ id: "pu1" }],
    })
    expect(snapshotToPlayer(snapshot).goldCoins).toBe(350)

    // Instantané v1 d'avant la persistance de la boutique : aucun champ.
    const legacy = snapshotToPlayer({
      clientId: "c2",
      username: "Bob",
      points: 5,
      streak: 0,
    })

    expect(legacy).toMatchObject({ id: "c2", points: 5 })
    expect(legacy.goldCoins).toBeUndefined()
  })
})
