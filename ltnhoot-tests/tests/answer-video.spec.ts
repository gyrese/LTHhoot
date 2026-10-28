import { test, expect } from "@playwright/test"
import { io, type Socket } from "socket.io-client"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  startSocket,
  startPreview,
  stopServer,
  type SocketHandle,
} from "../helpers/recoveryServer"

let server: SocketHandle
let preview: SocketHandle
const clients: Socket[] = []
const owner = randomUUID()

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
  const socket = io("http://localhost:3051", {
    path: "/ws",
    auth: { clientId },
  })
  clients.push(socket)
  await event(socket, "connect")
  return socket
}

test.beforeAll(async () => {
  const configPath = path.join(
    process.cwd(),
    "scratch",
    `answer-video-${randomUUID()}`,
  )
  mkdirSync(path.join(configPath, "quizz"), { recursive: true })
  const question = {
    type: "mcq",
    question: "Quelle planète est surnommée la planète rouge ?",
    answers: ["Mars", "Vénus", "Jupiter", "Saturne"],
    solutions: [0],
    time: 30,
    cooldown: 5,
    showLeaderboard: true,
    answerReveal: {
      enabled: true,
      videoId: "aqz-KE-bpKQ",
      text: "Mars doit sa couleur aux oxydes de fer présents à sa surface.",
    },
  }
  writeFileSync(
    path.join(configPath, "quizz", "video.json"),
    JSON.stringify({
      subject: "Mode TV",
      questions: [
        question,
        { ...question, question: "Deuxième question" },
        {
          ...question,
          question: "Explication en texte",
          answerReveal: { enabled: true, text: "Une explication sans vidéo." },
        },
      ],
    }),
  )
  server = await startSocket({ port: 3051, configPath })
  preview = await startPreview({
    webPort: 3050,
    wsTarget: "http://localhost:3051",
  })
})

test.afterAll(async () => {
  clients.forEach((socket) => socket.disconnect())
  await stopServer(preview)
  await stopServer(server)
})

test("le mode TV garde le lecteur, les commandes et la progression du quiz", async ({
  browser,
  page,
}, testInfo) => {
  const manager = await connect(owner)
  const config = event(manager, "manager:config")
  manager.emit("manager:auth", "test123")
  await config
  const created = event(manager, "manager:gameCreated")
  manager.emit("game:create", "video")
  const { gameId } = await created
  const player = await connect()
  const joined = event(player, "game:successJoin")
  player.emit("player:login", { gameId, data: { username: "Alice" } })
  await joined

  const salonContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "fr-FR",
  })
  await salonContext.addInitScript(
    ({ owner }) => {
      localStorage.setItem("client_id", owner)
      localStorage.setItem("rc_pwd", "test123")
    },
    { owner },
  )
  const salon = await salonContext.newPage()
  // Le lecteur tiers est remplacé pour isoler le test de la disponibilité YouTube.
  let playerLoads = 0
  await salon.route("https://www.youtube.com/embed/**", async (route) => {
    playerLoads += 1
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<html style="height:100%;background:#0b101b;color:#fff;font:24px sans-serif"><body style="height:90%;display:grid;place-items:center;margin:0">Lecteur YouTube · aperçu de test</body></html>',
    })
  })
  await salon.goto(`/party/manager/${gameId}`)
  await page.goto(`/remote/${gameId}`)
  await expect(
    page.getByRole("button", { name: "Agrandir la vidéo" }),
  ).toHaveCount(0)
  const selected = event(
    player,
    "game:status",
    (s) => s.name === "SELECT_ANSWER",
  )
  await page.getByRole("button", { name: /Démarrer/u }).click()
  await selected
  player.emit("player:selectedAnswer", { gameId, data: { answerId: 0 } })
  const expand = page.getByRole("button", {
    name: "Agrandir la vidéo",
    exact: true,
  })
  await expect(expand).toBeVisible({ timeout: 20_000 })
  const card = salon.getByTestId("answer-reveal")
  await expect(card).toHaveAttribute("data-expanded", "false")
  const iframe = await salon.locator("iframe").elementHandle()
  await expect.poll(() => playerLoads).toBe(1)
  await expand.click()
  await expect(card).toHaveAttribute("data-expanded", "true")
  await expect(
    page.getByRole("button", { name: "Réduire la vidéo" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(salon.locator("#start-round")).toBeVisible()
  await expect(salon.locator("#start-round")).toHaveText("Suivant")
  const screen = await salon.locator("iframe").boundingBox()
  const next = await salon.locator("#start-round").boundingBox()
  expect(screen!.width).toBeGreaterThan(1000)
  expect(screen!.height).toBeLessThan(900 * 0.75)
  expect(screen!.y).toBeGreaterThan(next!.y + next!.height)
  await salon.screenshot({ path: testInfo.outputPath("salon-tv.png") })
  await page.screenshot({ path: testInfo.outputPath("telecommande-tv.png") })

  // Reconnexion indépendante des deux écrans : l'état reste agrandi.
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Réduire la vidéo" }),
  ).toBeVisible()
  expect(
    await iframe!.evaluate(
      (element) => element === document.querySelector("iframe"),
    ),
  ).toBe(true)
  await page.getByRole("button", { name: "Réduire la vidéo" }).click()
  await expect(card).toHaveAttribute("data-expanded", "false")
  expect(
    await iframe!.evaluate(
      (element) => element === document.querySelector("iframe"),
    ),
  ).toBe(true)
  expect(playerLoads).toBe(1)
  await expand.click()
  await salon.reload()
  await expect(card).toHaveAttribute("data-expanded", "true")
  // Même écran sur une fenêtre étroite : cadre et navigation restent à l'écran.
  await salon.setViewportSize({ width: 800, height: 600 })
  const compact = await salon.locator("iframe").boundingBox()
  expect(compact!.x).toBeGreaterThanOrEqual(0)
  expect(compact!.y + compact!.height).toBeLessThan(600)
  await salon.screenshot({ path: testInfo.outputPath("salon-tv-compact.png") })
  await salon.locator("#start-round").click()
  await expect(card).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Réduire la vidéo" }),
  ).toHaveCount(0)

  // Question suivante : le zoom ne persiste pas, même avec une autre vidéo.
  const secondSelected = event(
    player,
    "game:status",
    (s) => s.name === "SELECT_ANSWER",
  )
  // Le serveur ignore deux avancements espacés de moins de 600 ms.
  await page.waitForTimeout(650)
  await page.getByRole("button", { name: "Suivant", exact: true }).click()
  await secondSelected
  player.emit("player:selectedAnswer", { gameId, data: { answerId: 0 } })
  await expect(expand).toBeVisible({ timeout: 20_000 })
  await expect(card).toHaveAttribute("data-expanded", "false")
  const control = await connect()
  const reconnected = event(control, "manager:successReconnect")
  control.emit("manager:remoteConnect", { gameId })
  await reconnected
  const stale = await control.emitWithAck("manager:setAnswerVideoExpanded", {
    gameId,
    questionNumber: 1,
    expanded: true,
  })
  expect(stale).toEqual({ ok: false })
  await expand.click()
  await expect(card).toHaveAttribute("data-expanded", "true")
  await page.getByRole("button", { name: "Suivant", exact: true }).click()
  await expect(card).toHaveCount(0)
  const thirdSelected = event(
    player,
    "game:status",
    (s) => s.name === "SELECT_ANSWER",
  )
  await page.waitForTimeout(650)
  await page.getByRole("button", { name: "Suivant", exact: true }).click()
  await thirdSelected
  player.emit("player:selectedAnswer", { gameId, data: { answerId: 0 } })
  await expect(salon.getByText("Une explication sans vidéo.")).toBeVisible({
    timeout: 20_000,
  })
  await expect(expand).toHaveCount(0)
  const textOnly = await control.emitWithAck("manager:setAnswerVideoExpanded", {
    gameId,
    questionNumber: 3,
    expanded: true,
  })
  expect(textOnly).toEqual({ ok: false })
  await salonContext.close()
})
