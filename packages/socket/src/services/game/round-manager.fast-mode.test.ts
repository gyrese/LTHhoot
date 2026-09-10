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
const setup = (
  fastMode: boolean,
  questionCount: number,
  questionOverrides: Partial<Question> = {},
) => {
  const io = buildIo()
  const gameId = "g1"
  const cooldown = new CooldownTimer(io, gameId)
  const players = new PlayerManager(io, gameId)
  players.replace([buildPlayer("a"), buildPlayer("b")])

  const broadcasted: Status[] = []
  const managerStatuses: Status[] = []
  const playerStatuses: Status[] = []
  let finished = 0

  const quizz: Quizz = {
    subject: "Rapidité",
    questions: Array.from({ length: questionCount }, () =>
      buildQuestion(questionOverrides),
    ),
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
      } else {
        playerStatuses.push(status)
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
    playerStatuses,
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

  // Régression : la lecture de l'énoncé (`question.cooldown`, ici 10 s) était
  // la plus longue attente entre deux questions, et le premier jet du mode
  // rapide ne la touchait pas — l'écran d'attente restait donc bien visible.
  it("plafonne le temps de lecture de l'énoncé avant les réponses", async () => {
    const fast = setup(true, 1, { cooldown: 10 })
    const normal = setup(false, 1, { cooldown: 10 })

    void fast.round.start(managerSocket)
    void normal.round.start(managerSocket)

    // Mode rapide : intro 1 s + décompte 2 s + prepared 1 s + lecture 1 s = 5 s.
    // Mode normal : 3 + 3 + 4 = 10 s avant même de commencer à lire l'énoncé.
    await vi.advanceTimersByTimeAsync(6000)

    // SELECT_ANSWER = les joueurs peuvent enfin répondre.
    expect(fast.playerStatuses).toContain("SELECT_ANSWER")
    expect(normal.playerStatuses).not.toContain("SELECT_ANSWER")
  })

  it("raccourcit le décompte d'intro (1 s au lieu de 4 s)", async () => {
    const fast = setup(true, 1)
    const normal = setup(false, 1)

    void fast.round.start(managerSocket)
    void normal.round.start(managerSocket)

    // Préambule : 3 s + 3 s en normal, 1 s + 2 s en rapide. À 8 s, le mode
    // rapide a largement diffusé sa question ; le mode normal (6 s de
    // préambule + 4 s d'écran « Prêt ? ») décompte encore.
    await vi.advanceTimersByTimeAsync(8000)

    expect(fast.broadcasted).toContain("SHOW_QUESTION")
    expect(normal.broadcasted).not.toContain("SHOW_QUESTION")
    expect(normal.broadcasted).toContain("SHOW_PREPARED")
  })
})
