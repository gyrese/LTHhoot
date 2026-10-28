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
function event(socket: Socket, name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Événement absent : ${name}`)),
      10_000,
    )
    socket.once(name, (value) => {
      clearTimeout(timer)
      resolve(value)
    })
  })
}
async function connect() {
  const socket = io("http://localhost:3031", {
    path: "/ws",
    auth: { clientId: randomUUID() },
  })
  clients.push(socket)
  await event(socket, "connect")
  return socket
}
test.beforeAll(async () => {
  const configPath = path.join(
    process.cwd(),
    "scratch",
    `player-recovery-${randomUUID()}`,
  )
  mkdirSync(path.join(configPath, "quizz"), { recursive: true })
  writeFileSync(
    path.join(configPath, "quizz", "recovery.json"),
    JSON.stringify({
      subject: "Reprise",
      questions: [
        {
          type: "true_false",
          question: "Test",
          solution: 1,
          time: 30,
          cooldown: 5,
        },
      ],
    }),
  )
  server = await startSocket({ port: 3031, configPath })
  preview = await startPreview({
    webPort: 3030,
    wsTarget: "http://localhost:3031",
  })
})
test.afterAll(async () => {
  clients.forEach((socket) => socket.disconnect())
  await stopServer(preview)
  await stopServer(server)
})

test("la télécommande génère un QR et récupère le joueur dans un nouveau navigateur", async ({
  browser,
  page,
}, testInfo) => {
  const manager = await connect()
  const config = event(manager, "manager:config")
  manager.emit("manager:auth", "test123")
  await config
  const created = event(manager, "manager:gameCreated")
  manager.emit("game:create", "recovery")
  const { gameId } = await created
  const player = await connect()
  const joined = event(player, "game:successJoin")
  player.emit("player:login", { gameId, data: { username: "Alice" } })
  await joined
  await page.goto(`/remote/${gameId}`)
  await page.getByRole("button", { name: /Joueurs/u }).click()
  await page
    .getByRole("button", { name: "Récupérer Alice", exact: true })
    .click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.locator("svg")).toBeVisible()
  const url = await dialog.getByLabel("Adresse de récupération").inputValue()
  await page.screenshot({ path: testInfo.outputPath("qr-telephone.png") })
  const context = await browser.newContext({
    locale: "fr-FR",
    viewport: { width: 390, height: 844 },
  })
  const recovered = await context.newPage()
  await recovered.goto(url)
  await recovered.getByRole("button", { name: "Reprendre ma partie" }).click()
  await expect(recovered).toHaveURL(new RegExp(`/party/${gameId}`))
  await expect(
    recovered.getByText("Alice", { exact: true }).first(),
  ).toBeVisible()
  await recovered.reload()
  await expect(
    recovered.getByText("Alice", { exact: true }).first(),
  ).toBeVisible()
  await recovered.screenshot({
    path: testInfo.outputPath("session-reprise.png"),
  })
  // Le même lien ne peut pas donner accès à un deuxième appareil.
  await page.goto(url)
  await page.getByRole("button", { name: "Reprendre ma partie" }).click()
  await expect(page.getByRole("alert")).toContainText("déjà été utilisé")
  await context.close()
})
