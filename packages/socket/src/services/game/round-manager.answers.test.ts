import type { Player, Question, Quizz } from "@rahoot/common/types/game"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import { FREEZE_DURATION_MS } from "@rahoot/common/types/powerup"
import { CooldownTimer } from "@rahoot/socket/services/game/cooldown-timer"
import { PlayerManager } from "@rahoot/socket/services/game/player-manager"
import { PowerUpManager } from "@rahoot/socket/services/game/powerup-manager"
import { RoundManager } from "@rahoot/socket/services/game/round-manager"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Serveur factice : le RoundManager ne fait qu'émettre dessus.
const io = { to: () => ({ emit: () => undefined }) } as unknown as Server

const buildPlayer = (id: string): Player => ({
  id,
  clientId: `client-${id}`,
  connected: true,
  username: id,
  points: 0,
  streak: 0,
  goldCoins: 10000,
})

const playerSocket = (id: string) =>
  ({ id, to: () => ({ emit: () => undefined }) }) as unknown as Socket

const managerSocket = {
  id: "manager",
  rooms: new Set(["manager-g1"]),
} as unknown as Socket

// Question vrai/faux de 20 s ; la fenêtre de réponse s'ouvre à
// 3 + 3 (préambule) + 4 (« Prêt ? ») + 5 (lecture) = 15 s après start().
const WINDOW_OPENS_MS = 15_000

const setup = (powerUpManager?: PowerUpManager) => {
  const cooldown = new CooldownTimer(io, "g1")
  const players = new PlayerManager(io, "g1")
  players.replace([buildPlayer("a"), buildPlayer("b")])

  const round = new RoundManager({
    quizz: {
      subject: "Réponses",
      questions: [
        {
          type: "true_false",
          question: "Vrai ?",
          solution: 1,
          time: 20,
          cooldown: 5,
        } as Question,
      ],
    } as Quizz,
    players,
    cooldown,
    io,
    gameId: "g1",
    getManagerId: () => "manager",
    broadcast: () => undefined,
    send: () => undefined,
    onNewQuestion: () => undefined,
    onGameFinished: () => undefined,
    powerUpManager,
  })

  return { round, players, cooldown }
}

describe("RoundManager — réponses", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("refuse la réponse d'un joueur gelé pendant la fenêtre de gel", async () => {
    const powerUps = new PowerUpManager()
    const { round, players } = setup(powerUps)
    const [a] = players.getAll()
    const freezeId = powerUps.buyPowerUp(a!, "FREEZE").powerUp!.id

    // « a » gèle tous ses adversaires (donc « b ») pour la prochaine question.
    powerUps.usePowerUp(players.getAll(), "a", freezeId)

    void round.start(managerSocket)
    await vi.advanceTimersByTimeAsync(WINDOW_OPENS_MS + 500)

    expect(round.selectAnswer(playerSocket("b"), { answerId: 1 })).toBe(
      "frozen",
    )
    // L'activateur, lui, répond normalement.
    expect(round.selectAnswer(playerSocket("a"), { answerId: 1 })).toBe("ok")

    await vi.advanceTimersByTimeAsync(FREEZE_DURATION_MS)

    expect(round.selectAnswer(playerSocket("b"), { answerId: 1 })).toBe("ok")
  })

  it("un joueur arrivé pendant la question ne répond pas et ne bloque pas la fin anticipée", async () => {
    const { round, players, cooldown } = setup()

    void round.start(managerSocket)
    await vi.advanceTimersByTimeAsync(WINDOW_OPENS_MS + 500)

    // Arrivée tardive : la question ne lui a jamais été envoyée.
    players.replace([...players.getAll(), buildPlayer("late")])

    expect(round.selectAnswer(playerSocket("late"), { answerId: 1 })).toBe(
      "closed",
    )

    const abort = vi.spyOn(cooldown, "abort")

    round.selectAnswer(playerSocket("a"), { answerId: 1 })
    expect(abort).not.toHaveBeenCalled()
    round.selectAnswer(playerSocket("b"), { answerId: 0 })
    // Les 2 joueurs présents à l'ouverture ont répondu : fin anticipée.
    expect(abort).toHaveBeenCalled()
  })

  it("stop() ferme la fenêtre de réponse", async () => {
    const { round } = setup()

    void round.start(managerSocket)
    await vi.advanceTimersByTimeAsync(WINDOW_OPENS_MS + 500)
    round.stop()

    expect(round.isStarted()).toBe(false)
    expect(round.selectAnswer(playerSocket("a"), { answerId: 1 })).toBe(
      "closed",
    )
  })
})
