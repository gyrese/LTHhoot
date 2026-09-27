import type { Player, Question, Quizz } from "@rahoot/common/types/game"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import type { Status } from "@rahoot/common/types/game/status"
import { CooldownTimer } from "@rahoot/socket/services/game/cooldown-timer"
import { PlayerManager } from "@rahoot/socket/services/game/player-manager"
import { RoundManager } from "@rahoot/socket/services/game/round-manager"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Serveur factice : le RoundManager ne fait qu'émettre dessus.
const io = { to: () => ({ emit: () => undefined }) } as unknown as Server

const managerSocket = {
  id: "manager",
  rooms: new Set(["manager-g1"]),
} as unknown as Socket

const buildPlayer = (id: string): Player => ({
  id,
  clientId: `client-${id}`,
  connected: true,
  username: id,
  points: 0,
  streak: 0,
})

const layout = {
  title: { x: 100, y: 40, width: 800, height: 150, fill: "#112233" },
  answers: [
    { x: 0, y: 700, width: 900, height: 120 },
    { x: 960, y: 700, width: 900, height: 120, textColor: "#ffffff" },
  ],
}

type Emitted = { target: string; status: Status; data: Record<string, unknown> }

const setup = (question: Partial<Question>, quizzFont?: string) => {
  const cooldown = new CooldownTimer(io, "g1")
  const players = new PlayerManager(io, "g1")
  players.replace([buildPlayer("a")])
  const emitted: Emitted[] = []

  const round = new RoundManager({
    quizz: {
      subject: "Mise en page",
      fontFamily: quizzFont,
      questions: [
        {
          type: "mcq",
          question: "Capitale ?",
          answers: ["Paris", "Lyon"],
          solutions: [0],
          time: 20,
          cooldown: 5,
          ...question,
        } as Question,
      ],
    } as Quizz,
    players,
    cooldown,
    io,
    gameId: "g1",
    getManagerId: () => "manager",
    broadcast: (status, data) =>
      emitted.push({ target: "all", status, data: data as never }),
    send: (target, status, data) =>
      emitted.push({ target, status, data: data as never }),
    onNewQuestion: () => undefined,
    onGameFinished: () => undefined,
  })

  return { round, emitted }
}

// Préambule (3 + 3) + « Prêt ? » (4) + lecture (5) : la fenêtre de réponse
// s'ouvre 15 s après start().
const WINDOW_OPENS_MS = 15_000

const payloadsOf = (emitted: Emitted[], status: Status) =>
  emitted.filter((e) => e.status === status)

describe("RoundManager — mise en page libre et police", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("transmet layout et police de la question dans SHOW_QUESTION et SELECT_ANSWER", async () => {
    const { round, emitted } = setup(
      { layout, fontFamily: "Lobster" },
      "Roboto",
    )

    void round.start(managerSocket)
    await vi.advanceTimersByTimeAsync(WINDOW_OPENS_MS + 500)

    const shown = payloadsOf(emitted, "SHOW_QUESTION")
    const selects = payloadsOf(emitted, "SELECT_ANSWER")

    // Diffusion générale + envoi au manager, puis un envoi par joueur + manager.
    expect(shown).toHaveLength(2)
    expect(selects).toHaveLength(2)

    for (const { data } of [...shown, ...selects]) {
      expect(data.layout).toEqual(layout)
      expect(data.fontFamily).toBe("Lobster")
    }

    // Le layout ne fuit aucune solution vers les joueurs.
    const toPlayer = selects.find((e) => e.target === "a")!
    expect(toPlayer.data).not.toHaveProperty("solutions")
  })

  it("transmet aussi layout et police à l'écran des résultats (SHOW_RESPONSES)", async () => {
    const { round, emitted } = setup(
      { layout, fontFamily: "Lobster" },
      "Roboto",
    )

    void round.start(managerSocket)
    // Fenêtre de réponse (20 s) écoulée sans réponse → écran des résultats.
    await vi.advanceTimersByTimeAsync(WINDOW_OPENS_MS + 22_000)

    const [responses] = payloadsOf(emitted, "SHOW_RESPONSES")
    expect(responses?.target).toBe("manager")
    expect(responses?.data.layout).toEqual(layout)
    expect(responses?.data.fontFamily).toBe("Lobster")
  })

  it("se replie sur la police du quiz, sans layout pour un quiz historique", async () => {
    const { round, emitted } = setup({}, "Roboto")

    void round.start(managerSocket)
    await vi.advanceTimersByTimeAsync(WINDOW_OPENS_MS + 500)

    for (const { data } of [
      ...payloadsOf(emitted, "SHOW_QUESTION"),
      ...payloadsOf(emitted, "SELECT_ANSWER"),
    ]) {
      expect(data.layout).toBeUndefined()
      expect(data.fontFamily).toBe("Roboto")
    }
  })

  it("laisse la police vide quand ni la question ni le quiz n'en définissent", async () => {
    const { round, emitted } = setup({})

    void round.start(managerSocket)
    await vi.advanceTimersByTimeAsync(WINDOW_OPENS_MS + 500)

    const [select] = payloadsOf(emitted, "SELECT_ANSWER")
    expect(select?.data.fontFamily).toBeUndefined()
  })
})
