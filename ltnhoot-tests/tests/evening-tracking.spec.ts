import { test, expect } from "@playwright/test"
import { io, type Socket } from "socket.io-client"
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  startSocket,
  stopServer,
  type SocketHandle,
} from "../helpers/recoveryServer"

let server: SocketHandle | undefined
const clients: Socket[] = []
const configPath = path.join(
  process.cwd(),
  "scratch",
  `evening-${randomUUID()}`,
)
const owner = randomUUID()
const aliceId = randomUUID()

function event(
  socket: Socket,
  name: string,
  matches = (_value: any) => true,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const listener = (value: any) => {
      if (!matches(value)) return
      clearTimeout(timer)
      socket.off(name, listener)
      resolve(value)
    }
    const timer = setTimeout(() => {
      socket.off(name, listener)
      reject(new Error(`Événement absent : ${name}`))
    }, 20_000)
    socket.on(name, listener)
  })
}
async function connect(clientId = randomUUID()) {
  const socket = io("http://localhost:3041", {
    path: "/ws",
    auth: { clientId },
  })
  clients.push(socket)
  await event(socket, "connect")
  return socket
}
async function authenticate() {
  const manager = await connect(owner)
  const config = event(manager, "manager:config")
  manager.emit("manager:auth", "test123")
  return { manager, config: await config }
}
function ack(socket: Socket, name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(10_000)
      .emit(name, (error: Error | null, reply: any) =>
        error ? reject(error) : resolve(reply),
      )
  })
}
async function quiz(manager: Socket, withBob: boolean) {
  const created = event(manager, "manager:gameCreated")
  manager.emit("game:create", {
    quizId: "evening",
    noSpeedMode: true,
    powerUpsEnabled: false,
  })
  const { gameId } = await created
  const alice = await connect(aliceId)
  const joined = event(alice, "game:successJoin")
  alice.emit("player:login", { gameId, data: { username: "Alice" } })
  await joined
  const bob = withBob ? await connect() : undefined
  if (bob) {
    const joinedBob = event(bob, "game:successJoin")
    bob.emit("player:login", { gameId, data: { username: "Bobby" } })
    await joinedBob
  }
  const answering = event(
    alice,
    "game:status",
    (status) => status.name === "SELECT_ANSWER",
  )
  manager.emit("manager:startGame", { gameId })
  await answering
  const responses = event(
    manager,
    "game:status",
    (status) => status.name === "SHOW_RESPONSES",
  )
  alice.emit("player:selectedAnswer", { gameId, data: { answerId: 1 } })
  bob?.emit("player:selectedAnswer", { gameId, data: { answerId: 0 } })
  await responses
  const updated = event(manager, "evening:state")
  manager.emit("manager:showLeaderboard", { gameId })
  const evening = await updated
  alice.disconnect()
  bob?.disconnect()
  return evening
}

test.beforeAll(async () => {
  mkdirSync(path.join(configPath, "quizz"), { recursive: true })
  writeFileSync(
    path.join(configPath, "quizz", "evening.json"),
    JSON.stringify({
      subject: "Quiz de soirée",
      questions: [
        {
          type: "true_false",
          question: "La Terre est ronde",
          solution: 1,
          time: 10,
          cooldown: 3,
        },
      ],
    }),
  )
  server = await startSocket({ port: 3041, configPath })
})
test.afterAll(async () => {
  clients.forEach((client) => client.disconnect())
  await stopServer(server)
})

test("cumule deux quiz, reprend après redémarrage et archive le gagnant", async () => {
  let { manager } = await authenticate()
  const opened = await ack(manager, "evening:open")
  expect(opened.error).toBeUndefined()
  const id = opened.evening.id
  const first = await quiz(manager, true)
  expect(first.quizCount).toBe(1)
  expect(first.leaderboard).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ username: "Alice", points: 1000 }),
      expect.objectContaining({ username: "Bobby", points: 0 }),
    ]),
  )
  clients.forEach((client) => client.disconnect())
  await stopServer(server)
  server = await startSocket({ port: 3041, configPath })
  const restored = await authenticate()
  manager = restored.manager
  expect(restored.config.evening.id).toBe(id)
  expect(restored.config.evening.leaderboard).toEqual(first.leaderboard)
  const second = await quiz(manager, false)
  expect(second.quizCount).toBe(2)
  expect(second.leaderboard).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        username: "Alice",
        points: 2000,
        rank: 1,
        quizCount: 2,
      }),
      expect.objectContaining({
        username: "Bobby",
        points: 0,
        rank: 2,
        quizCount: 1,
      }),
    ]),
  )
  const closed = await ack(manager, "evening:close")
  expect(closed.error).toBeUndefined()
  expect(closed.evening.endedAt).toBeTruthy()
  expect(closed.evening.leaderboard).toEqual(second.leaderboard)
  const archived = JSON.parse(
    readFileSync(path.join(configPath, "results", `${id}.json`), "utf-8"),
  )
  expect(archived.subject).toBe("Soirée")
  expect(archived.players[0]).toMatchObject({
    username: "Alice",
    points: 2000,
    rank: 1,
  })
  expect(archived.questions).toEqual([])
  expect(JSON.stringify(archived)).not.toContain("clientId")
  expect((await ack(manager, "evening:close")).evening).toEqual(closed.evening)
  console.log(`Archives de test : ${configPath}`)
})
