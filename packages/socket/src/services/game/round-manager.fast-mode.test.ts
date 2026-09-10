import type { Player, Question, Quizz } from "@rahoot/common/types/game"
import type { Server, Socket } from "@rahoot/common/types/game/socket"
import type { Status, StatusDataMap } from "@rahoot/common/types/game/status"
import { CooldownTimer } from "@rahoot/socket/services/game/cooldown-timer"
import { PlayerManager } from "@rahoot/socket/services/game/player-manager"
import { RoundManager } from "@rahoot/socket/services/game/round-manager"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Serveur socket factice : le RoundManager ne fait qu'émettre dessus, on
// n'a besoin que d'une chaîne `.to(...).emit(...)` qui absorbe les appels.
const buildIo = () =>
  ({
    to: () => ({ emit: () => undefined }),
  }) as unknown as Server

const buildQuestion = (overrides: Partial<Question> = {}): Question =>
  ({
    type: "true_false",
    question: "Le ciel est bleu ?",
    solution: true,
    time: 5,
    cooldown: 5,
    // Le mode rapide doit sauter ce classement MALGRÉ ce drapeau à true :
    // c'est précisément ce que le test vérifie.
    showLeaderboard: true,
    ...overrides,
  }) as Question

const buildPlayer = (id: string): Player => ({
  id,
  clientId: id,
  connected: true,
  username: id,
  points: 0,
  streak: 0,
})

// Enregistre l'ordre des statuts diffusés/envoyés pour vérifier l'enchaînement.
const setup = (fastMode: boolean, questionCount: number) => {
  const io = buildIo()
  const gameId = "g1"
  const cooldown = new CooldownTimer(io, gameId)
  const players = new PlayerManager(io, gameId)
  players.replace([buildPlayer("a"), buildPlayer("b")])

  const broadcasted: Status[] = []
  const managerStatuses: Status[] = []
  let finished = 0

  const quizz: Quizz = {
    subject: "Rapidité",
    questions: Array.from({ length: questionCount }, () => buildQuestion()),
  } as Quizz

  const round = new RoundManager({
    quizz,
    players,
    cooldown,
    io,
    gameId,
    getManagerId: () => "manager",
    broadcast: <T extends Status>(status: T, _data: StatusDataMap[T]) => {
      broadcasted.push(status)
    },
    send: <T extends Status>(
      target: string,
      status: T,
      _data: StatusDataMap[T],
    ) => {
      if (target === "manager") {
        managerStatuses.push(status)
      }
    },
    onNewQuestion: () => undefined,
    onGameFinished: () => {
      finished += 1
    },
    fastMode,
  })

  return {
    round,
    broadcasted,
    managerStatuses,
    getFinished: () => finished,
  }
}

// `start()` exige un socket dans la room manager.
const managerSocket = {
  id: "manager",
  rooms: new Set(["manager-g1"]),
} as unknown as Socket

describe("RoundManager — mode rapide", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("enchaîne les questions sans aucune action de l'hôte", async () => {
    const { round, broadcasted, managerStatuses, getFinished } = setup(true, 3)

    void round.start(managerSocket)
    // 5 minutes couvrent largement les 3 questions : si un seul clic hôte
    // était requis, le flux se figerait avant la fin.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    // 3 questions réellement diffusées, sans intervention.
    expect(broadcasted.filter((s) => s === "SHOW_QUESTION")).toHaveLength(3)
    // Aucun classement intermédiaire : seul le podium final conclut.
    expect(managerStatuses).not.toContain("SHOW_LEADERBOARD")
    expect(managerStatuses).toContain("FINISHED")
    expect(getFinished()).toBe(1)
  })

  it("sans mode rapide, le flux s'arrête et attend le clic de l'hôte", async () => {
    const { round, broadcasted, managerStatuses } = setup(false, 3)

    void round.start(managerSocket)
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    // Bloqué sur la 1re question : SHOW_RESPONSES attend « Classement ».
    expect(broadcasted.filter((s) => s === "SHOW_QUESTION")).toHaveLength(1)
    expect(managerStatuses).toContain("SHOW_RESPONSES")
    expect(managerStatuses).not.toContain("FINISHED")
  })

  it("raccourcit le décompte d'intro (1 s au lieu de 4 s)", async () => {
    const fast = setup(true, 1)
    const normal = setup(false, 1)

    void fast.round.start(managerSocket)
    void normal.round.start(managerSocket)

    // Préambule commun de start() : sleep(3) + cooldown(3) = 6 s, puis
    // SHOW_PREPARED. À 6 s + 2 s, le mode rapide (intro 1 s) a déjà diffusé
    // la question, tandis que le mode normal (intro 4 s) décompte encore.
    await vi.advanceTimersByTimeAsync(6000 + 2000)

    expect(fast.broadcasted).toContain("SHOW_QUESTION")
    expect(normal.broadcasted).not.toContain("SHOW_QUESTION")
    expect(normal.broadcasted).toContain("SHOW_PREPARED")
  })
})
