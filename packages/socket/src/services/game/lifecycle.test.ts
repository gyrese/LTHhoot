import type { Quizz } from "@rahoot/common/types/game"
import { EVENTS } from "@rahoot/common/constants"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import Game from "@rahoot/socket/services/game"
import manager from "@rahoot/socket/services/manager"
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
  const privilegedRoles = ["admin", "guest", "remote"] as const
  const authenticatePlayer = (
    socket: Socket,
    role: (typeof privilegedRoles)[number],
  ) => {
    if (role === "admin") {
      manager.login(socket)
    } else if (role === "guest") {
      manager.loginGuest(socket, "compte-test")
    } else {
      manager.loginRemote(socket)
    }
  }

  it.each(privilegedRoles)(
    "refuse de générer un lien pour une identité %s",
    (role) => {
      const socket = fakeSocket(`joueur-${role}`, `identite-${role}`)
      const game = new Game(io, fakeSocket("hote"), quizz)

      try {
        game.join(socket, "Alice")
        authenticatePlayer(socket, role)
        expect(game.createPlayerRecovery(socket.id)).toBeUndefined()
      } finally {
        manager.logout(socket)
        game.dispose()
      }
    },
  )

  it.each(privilegedRoles)(
    "refuse un lien si son identité devient %s après génération",
    (role) => {
      const socket = fakeSocket(`joueur-${role}`, `identite-${role}`)
      const game = new Game(io, fakeSocket("hote"), quizz)

      try {
        game.join(socket, "Alice")
        const link = game.createPlayerRecovery(socket.id)!
        authenticatePlayer(socket, role)
        expect(game.recoverPlayer(link.token)).toBeUndefined()
        manager.logout(socket)
        expect(game.recoverPlayer(link.token)).toBeUndefined()
      } finally {
        manager.logout(socket)
        game.dispose()
      }
    },
  )

  it("récupère un joueur sur un autre téléphone sans perdre points ni pièces", () => {
    const game = new Game(io, fakeSocket("hote"), quizz)
    game.join(fakeSocket("ancien", "identite"), "Alice")
    Object.assign(game.players[0]!, { points: 2400, streak: 3, goldCoins: 120 })
    const link = game.createPlayerRecovery("ancien")!
    const identity = game.recoverPlayer(link.token)!
    const phone = fakeSocket("nouveau", identity.clientId)
    game.reconnect(phone)
    expect(game.players).toHaveLength(1)
    expect(game.players[0]).toMatchObject({
      id: "nouveau",
      points: 2400,
      streak: 3,
      goldCoins: 120,
    })
    expect(phone.emit).toHaveBeenCalledWith(
      EVENTS.PLAYER.SUCCESS_RECONNECT,
      expect.objectContaining({
        player: expect.objectContaining({ username: "Alice", points: 2400 }),
      }),
    )
    expect(game.recoverPlayer(link.token)).toBeUndefined()
    game.dispose()
  })

  it("refuse la récupération d'un joueur supprimé", () => {
    const game = new Game(io, fakeSocket("hote"), quizz)
    game.join(fakeSocket("ancien", "identite"), "Alice")
    const link = game.createPlayerRecovery("ancien")!
    game.removePlayer("ancien")
    expect(game.recoverPlayer(link.token)).toBeUndefined()
    game.dispose()
  })

  it("laisse dix minutes pour scanner dans le lobby", () => {
    vi.useFakeTimers()
    const game = new Game(io, fakeSocket("hote"), quizz)
    game.join(fakeSocket("ancien", "identite"), "Alice")
    game.schedulePlayerRemoval("ancien")
    const link = game.createPlayerRecovery("ancien")!
    vi.advanceTimersByTime(31_000)
    expect(game.recoverPlayer(link.token)).toEqual({ clientId: "identite" })
    game.reconnect(fakeSocket("nouveau", "identite"))
    vi.advanceTimersByTime(600_000)
    expect(game.players).toHaveLength(1)
    game.dispose()
    vi.useRealTimers()
  })

  it("garde 10 min la place d'un joueur en veille dans le salon", () => {
    vi.useFakeTimers()
    const game = new Game(io, fakeSocket("hote"), quizz)
    game.join(fakeSocket("veille", "telephone"), "Alice")
    game.schedulePlayerRemoval("veille")

    // Téléphone verrouillé 5 min pendant l'attente du lancement.
    vi.advanceTimersByTime(5 * 60_000)
    expect(game.players).toHaveLength(1)

    const phone = fakeSocket("reveil", "telephone")
    game.reconnect(phone)
    expect(phone.emit).toHaveBeenCalledWith(
      EVENTS.PLAYER.SUCCESS_RECONNECT,
      expect.anything(),
    )
    game.dispose()
    vi.useRealTimers()
  })

  it("retire du salon un joueur absent depuis plus de 10 min", () => {
    vi.useFakeTimers()
    const game = new Game(io, fakeSocket("hote"), quizz)
    game.join(fakeSocket("parti"), "Alice")
    game.schedulePlayerRemoval("parti")
    vi.advanceTimersByTime(10 * 60_000 + 1)
    expect(game.players).toHaveLength(0)
    game.dispose()
    vi.useRealTimers()
  })

  it("une partie restaurée en cours ne retire jamais ses joueurs", () => {
    vi.useFakeTimers()
    const twoQuestions: Quizz = {
      ...quizz,
      questions: [quizz.questions[0]!, quizz.questions[0]!],
    }
    const original = new Game(io, fakeSocket("hote-restore"), twoQuestions)
    const snapshot = {
      ...original.serialize(),
      resumeIndex: 1,
      questionsHistory: [{}] as never,
      players: [
        { clientId: "c-restore", username: "Alice", points: 900, streak: 2 },
      ],
    }
    original.dispose()

    const restored = Game.restore(io, snapshot)!
    expect(restored.started).toBe(false)
    expect(restored.hasProgress).toBe(true)

    // Retour du joueur après le redéploiement, puis nouvelle mise en veille.
    restored.reconnect(fakeSocket("s-restore", "c-restore"))
    restored.schedulePlayerRemoval("s-restore")
    vi.advanceTimersByTime(60 * 60_000)
    expect(restored.players).toMatchObject([{ username: "Alice", points: 900 }])
    restored.dispose()
    vi.useRealTimers()
  })

  it("une partie neuve non lancée n'a pas de progression", () => {
    const game = new Game(io, fakeSocket("hote"), quizz)
    expect(game.hasProgress).toBe(false)
    game.dispose()
  })

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
  it("conserve le rattachement à la soirée quand une partie est restaurée", () => {
    const game = new Game(io, fakeSocket("hote-soiree"), quizz, {
      trackedEveningId: "soiree-origine",
    })
    const snapshot = game.serialize()
    const restored = Game.restore(io, snapshot)

    expect(snapshot.trackedEveningId).toBe("soiree-origine")
    expect(restored?.eveningTrackingId).toBe("soiree-origine")
    expect(restored?.gameId).toBe(game.gameId)
    game.dispose()
    restored?.dispose()
  })

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
