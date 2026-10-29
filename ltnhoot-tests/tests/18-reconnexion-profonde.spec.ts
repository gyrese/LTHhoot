import {
  test,
  expect,
  devices,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import { joinPlayer } from "../helpers/gameHelpers"
import {
  crashSocket,
  startPreview,
  startSocket,
  stopServer,
  type SocketHandle,
} from "../helpers/recoveryServer"

/**
 * Test 18 — Banc de reconnexion multi-joueurs (7 joueurs + écran hôte).
 *
 * Reproduit les situations réelles d'une soirée : téléphone verrouillé dans le
 * salon, téléphone verrouillé PENDANT une question longue, joueur absent à
 * l'ouverture, rechargement de page, redémarrage du serveur (déploiement),
 * serveur injoignable plus de 8 s, même joueur ouvert dans deux onglets.
 *
 * La coupure réseau est simulée par `context.setOffline(true)` : chaque
 * scénario vérifie dans les logs serveur que la coupure a bien été VUE par le
 * serveur avant de tester la suite (sinon le test ne prouverait rien).
 *
 * Lancement :
 *   pnpm --filter @rahoot/socket build && pnpm --filter @rahoot/web build
 *   cd ltnhoot-tests && npx playwright test --config playwright.reconnect.config.ts
 */

const WEB_PORT = 3040
const SOCKET_PORT = 3041
const CONFIG_DIR = path.join(process.cwd(), ".reconnect-config")
const PASSWORD = "test123"
const NAMES = ["Alice", "Bruno", "Chloe", "David", "Emma", "Farid", "Gilles"]
const GOOD = 1 // index de la bonne réponse (solutions: [1], non mélangé)
const OVERLAY = "Connexion interrompue"
// Le serveur voit une coupure au plus tard après pingInterval + pingTimeout.
const SERVER_DETECTION_MS = 50_000

const QUESTION = {
  type: "mcq",
  question: "Quelle est la bonne réponse ?",
  answers: ["Non", "Bonne réponse", "Non", "Non"],
  solutions: [GOOD],
  cooldown: 5,
  // Question longue comme en soirée (tables qui discutent).
  time: 150,
}

let socket: SocketHandle
let preview: SocketHandle
let hostCtx: BrowserContext
let host: Page
const ctx: Record<string, BrowserContext> = {}
const page: Record<string, Page> = {}
let gameUrl = ""

// ── Logs serveur ──────────────────────────────────────────────────────────────
const logs: string[] = []

const attachLogs = (handle: SocketHandle) => {
  const push = (d: Buffer) => {
    for (const line of String(d).split("\n")) {
      if (line.trim()) {
        logs.push(line)
      }
    }
  }

  handle.proc.stdout?.on("data", push)
  handle.proc.stderr?.on("data", push)
}

const mark = () => logs.length

const findLog = (re: RegExp, from = 0) =>
  logs.slice(from).filter((l) => re.test(l))

async function waitLog(re: RegExp, from: number, timeout: number) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    if (findLog(re, from).length > 0) {
      return
    }

    await new Promise((r) => setTimeout(r, 250))
  }

  throw new Error(`Log serveur attendu absent après ${timeout} ms : ${re}`)
}

// ── Serveur ───────────────────────────────────────────────────────────────────
function seedConfig() {
  fs.rmSync(CONFIG_DIR, { recursive: true, force: true })
  fs.mkdirSync(path.join(CONFIG_DIR, "quizz"), { recursive: true })
  fs.writeFileSync(
    path.join(CONFIG_DIR, "game.json"),
    JSON.stringify({ managerPassword: PASSWORD }),
  )
  fs.writeFileSync(
    path.join(CONFIG_DIR, "quizz", "reconnexion.json"),
    JSON.stringify({
      subject: "Banc reconnexion",
      questions: [QUESTION, QUESTION, QUESTION, QUESTION, QUESTION],
    }),
  )
}

async function bootSocket() {
  socket = await startSocket({
    port: SOCKET_PORT,
    configPath: CONFIG_DIR,
    fresh: false,
  })
  attachLogs(socket)
}

// Points persistés (instantané disque, réécrit toutes les 3 s).
function persistedPoints(): Record<string, number> {
  const file = path.join(CONFIG_DIR, "state", "games.json")
  const games = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    players: { username: string; points: number }[]
  }[]
  const result: Record<string, number> = {}

  for (const p of games[0]?.players ?? []) {
    result[p.username] = p.points
  }

  return result
}

// ── Navigateur ────────────────────────────────────────────────────────────────
async function login(p: Page) {
  await p.goto("/manager/config")
  const pwd = p.locator('input[type="password"]')
  await pwd.waitFor({ timeout: 15_000 })
  await pwd.fill(PASSWORD)
  await pwd.press("Enter")
  await expect(pwd).not.toBeVisible({ timeout: 15_000 })
}

// Bibliothèque actuelle : on sélectionne la carte du quiz puis « Démarrer la
// partie » dans le pied de page (le helper partagé cible l'ancien dashboard).
async function createGame(p: Page): Promise<string | null> {
  await p.getByRole("button", { name: "Banc reconnexion", exact: true }).click()
  const start = p.getByRole("button", { name: "Démarrer la partie" })
  await expect(start).toBeEnabled({ timeout: 10_000 })
  await start.click()
  await p.locator("#game-pin").waitFor({ timeout: 30_000 })

  return (await p.locator("#game-pin").textContent())?.trim() ?? null
}

const answerButtons = (p: Page) => p.locator("button.shadow-inset")
const others = (...excluded: string[]) =>
  NAMES.filter((n) => !excluded.includes(n))

// Le joueur est dans la partie (pas renvoyé à l'accueil) et l'overlay de
// reconnexion a disparu.
async function expectInGame(name: string, timeout = 20_000) {
  const p = page[name]!
  await expect(p.getByText(OVERLAY), `${name} : overlay disparu`).toBeHidden({
    timeout,
  })
  expect(p.url(), `${name} : toujours dans /party/`).toMatch(/\/party\//)
  await expect(p.locator("#pin-input"), `${name} : pas renvoyé à l'accueil`)
    .toHaveCount(0)
}

async function expectHostSeesAll() {
  for (const name of NAMES) {
    await expect(host.getByText(name).first(), `hôte voit ${name}`).toBeVisible(
      { timeout: 15_000 },
    )
  }
}

// Fait avancer l'écran hôte jusqu'à l'ouverture des réponses chez `watcher`.
// Ne clique QUE sur « Suivant » : « Couper le temps » arrêterait la question.
async function advanceToNextQuestion(watcher: string) {
  const button = host.locator("#start-round")
  const deadline = Date.now() + 90_000

  while (Date.now() < deadline) {
    if (await answerButtons(page[watcher]!).first().isVisible()) {
      return
    }

    const label = (await button.textContent().catch(() => null))?.trim()

    // « Démarrer la partie » : partie restaurée après un redémarrage serveur.
    const canAdvance = label === "Suivant" || label === "Démarrer la partie"

    if (canAdvance && (await button.isEnabled())) {
      await button.click()
    }

    await host.waitForTimeout(1000)
  }

  throw new Error("La question suivante ne s'est pas ouverte")
}

async function waitAnswersOpen(names: string[]) {
  for (const name of names) {
    await answerButtons(page[name]!).first().waitFor({
      state: "visible",
      timeout: 45_000,
    })
  }
}

async function answer(names: string[]) {
  for (const name of names) {
    await answerButtons(page[name]!).nth(GOOD).click()
  }
}

async function goOffline(name: string) {
  await ctx[name]!.setOffline(true)
}

async function goOnline(name: string) {
  await ctx[name]!.setOffline(false)
}

async function newPlayerContext(browser: Browser) {
  return browser.newContext({ ...devices["Pixel 7"], locale: "fr-FR" })
}

test.describe.configure({ mode: "serial" })

test.describe("18 — Reconnexion profonde, 7 joueurs", () => {
  test.beforeAll(async ({ browser }) => {
    seedConfig()
    await bootSocket()
    preview = await startPreview({
      webPort: WEB_PORT,
      wsTarget: `http://localhost:${SOCKET_PORT}`,
    })

    hostCtx = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      locale: "fr-FR",
    })
    host = await hostCtx.newPage()

    for (const name of NAMES) {
      ctx[name] = await newPlayerContext(browser)
      page[name] = await ctx[name]!.newPage()
    }
  })

  test.afterAll(async () => {
    await hostCtx?.close().catch(() => undefined)

    for (const c of Object.values(ctx)) {
      await c.close().catch(() => undefined)
    }

    await stopServer(socket).catch(() => undefined)
    await stopServer(preview).catch(() => undefined)
  })

  test("1 — 7 joueurs rejoignent le salon", async () => {
    await login(host)
    const pin = await createGame(host)
    expect(pin, "PIN généré").toBeTruthy()

    for (const name of NAMES) {
      await joinPlayer(page[name]!, pin!, name)
    }

    gameUrl = page.Alice!.url()
    await expectHostSeesAll()
  })

  test("2 — salon : veille longue, onglet tué, micro-coupure", async () => {
    const from = mark()

    // Alice verrouille son téléphone ; Bruno aussi, et le navigateur décharge
    // l'onglet (cas iOS fréquent) ; Chloé a une micro-coupure Wi-Fi.
    await goOffline("Alice")
    await goOffline("Bruno")
    await page.Bruno!.close()

    await goOffline("Chloe")
    await page.Chloe!.waitForTimeout(2000)
    await goOnline("Chloe")

    await waitLog(/\[DISCONNECT\] Alice .*place gardée/, from, SERVER_DETECTION_MS)
    await waitLog(/\[DISCONNECT\] Bruno .*place gardée/, from, SERVER_DETECTION_MS)

    // Au-delà des 30 s de l'ancien délai de retrait.
    await host.waitForTimeout(40_000)
    expect(findLog(/\[REMOVE\]/, from), "aucun joueur retiré du salon").toEqual(
      [],
    )

    const back = mark()
    await goOnline("Alice")
    await goOnline("Bruno")
    page.Bruno = await ctx.Bruno!.newPage()
    await page.Bruno.goto(gameUrl)

    await waitLog(/\[RECONNECT_FINISH\] Alice /, back, 30_000)
    await waitLog(/\[RECONNECT_FINISH\] Bruno /, back, 30_000)

    for (const name of NAMES) {
      await expectInGame(name)
    }

    await expectHostSeesAll()
  })

  test("3 — question longue : un téléphone se verrouille, le chrono continue", async () => {
    await host.locator("#start-round").click()
    await waitAnswersOpen(NAMES)

    const from = mark()
    await goOffline("Alice")
    await waitLog(/\[DISCONNECT\].*joueur=Alice /, from, SERVER_DETECTION_MS)

    // Les 6 autres répondent : avant le correctif, le chrono s'arrêtait ici.
    await answer(others("Alice"))
    await host.waitForTimeout(6000)

    for (const name of others("Alice")) {
      await expect(
        page[name]!.getByText("Score Total"),
        `${name} : la manche ne doit pas être coupée`,
      ).toHaveCount(0)
    }

    // Alice rallume son téléphone : elle peut encore répondre.
    await goOnline("Alice")
    await expectInGame("Alice")
    await answerButtons(page.Alice!).nth(GOOD).waitFor({ timeout: 20_000 })
    await answerButtons(page.Alice!).nth(GOOD).click()

    // Tout le monde a répondu → fin anticipée, et la réponse d'Alice compte.
    for (const name of NAMES) {
      await expect(page[name]!.getByText("Score Total")).toBeVisible({
        timeout: 20_000,
      })
    }

    await expect(page.Alice!.getByText("Bravo")).toBeVisible()
  })

  test("4 — joueur absent à l'ouverture + rechargement en pleine question", async () => {
    const from = mark()
    await goOffline("Gilles")
    await waitLog(/\[DISCONNECT\].*joueur=Gilles /, from, SERVER_DETECTION_MS)

    await advanceToNextQuestion("Alice")
    await waitAnswersOpen(others("Gilles"))

    // Chloé répond puis recharge la page : elle reste dans la partie et sa
    // réponse est conservée.
    await answerButtons(page.Chloe!).nth(GOOD).click()
    const reload = mark()
    await page.Chloe!.reload()
    await waitLog(/\[RECONNECT_SUCCESS\].*hasAnswered=true/, reload, 20_000)
    await expectInGame("Chloe")

    // Gilles était absent à l'ouverture : il ne bloque pas la fin anticipée.
    await answer(others("Gilles", "Chloe"))

    for (const name of others("Gilles")) {
      await expect(page[name]!.getByText("Score Total")).toBeVisible({
        timeout: 20_000,
      })
    }

    await expect(page.Chloe!.getByText("Bravo")).toBeVisible()

    await goOnline("Gilles")
    await expectInGame("Gilles")
  })

  test("5 — redémarrage du serveur en pleine partie (déploiement)", async () => {
    // Laisser l'instantané disque capturer les scores.
    await host.waitForTimeout(4500)
    const before = persistedPoints()
    expect(before.Alice, "Alice a marqué des points").toBeGreaterThan(0)

    await crashSocket(socket)
    const from = mark()
    await bootSocket()

    for (const name of NAMES) {
      await waitLog(new RegExp(`\\[RECONNECT_FINISH\\] ${name} `), from, 45_000)
    }

    for (const name of NAMES) {
      await expectInGame(name)
    }

    // Partie restaurée (non démarrée) : un joueur qui se remet en veille ne
    // doit plus être traité comme un joueur de salon, ni retiré.
    const sleep = mark()
    await goOffline("David")
    await waitLog(/\[DISCONNECT\].*joueur=David .*partie en cours/, sleep, SERVER_DETECTION_MS)
    await host.waitForTimeout(35_000)
    expect(findLog(/\[REMOVE\]/, from), "aucun joueur retiré").toEqual([])

    await goOnline("David")
    await expectInGame("David")

    await host.waitForTimeout(4500)
    expect(persistedPoints(), "scores intacts après redémarrage").toEqual(before)

    // L'hôte relance : la question suivante se joue normalement.
    await expect(host.locator("#start-round")).toBeEnabled({ timeout: 30_000 })
    await host.locator("#start-round").click()
    await waitAnswersOpen(NAMES)
    await answer(NAMES)

    for (const name of NAMES) {
      await expect(page[name]!.getByText("Score Total")).toBeVisible({
        timeout: 20_000,
      })
    }

    await host.waitForTimeout(4500)
    const after = persistedPoints()

    for (const name of NAMES) {
      expect(after[name], `${name} : points cumulés`).toBeGreaterThan(
        before[name]!,
      )
    }
  })

  test("6 — serveur injoignable plus de 8 s : bouton Réessayer", async () => {
    await crashSocket(socket)
    await host.waitForTimeout(12_000)

    await expect(page.Emma!.getByText(OVERLAY)).toBeVisible()
    const retry = page.Emma!.getByRole("button", { name: "Réessayer" })
    await expect(retry).toBeVisible()

    await bootSocket()
    await retry.click()

    for (const name of NAMES) {
      await expectInGame(name, 30_000)
    }
  })

  test("7 — même joueur dans deux onglets", async () => {
    const from = mark()
    const second = await ctx.Farid!.newPage()
    await second.goto(gameUrl)

    await waitLog(/\[TAKEOVER\] Triggered for Farid/, from, 20_000)
    await expect(second.getByText(OVERLAY)).toBeHidden({ timeout: 20_000 })

    // Pas de ping-pong infini entre les deux onglets.
    await host.waitForTimeout(10_000)
    const takeovers = findLog(/\[TAKEOVER\] Triggered for Farid/, from).length
    expect(takeovers, "pas de tempête de reprises entre onglets").toBeLessThan(4)

    // Le joueur ferme le 2e onglet et revient sur le premier.
    await second.close()
    const back = mark()
    await page.Farid!.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    )
    await waitLog(/\[RECONNECT_FINISH\] Farid /, back, 20_000)
    await expectInGame("Farid")
  })

  test("8 — l'écran hôte décroche puis revient", async () => {
    const from = mark()
    await hostCtx.setOffline(true)
    await waitLog(/Manager déconnecté/, from, SERVER_DETECTION_MS)

    // Les joueurs ne sont pas éjectés pendant l'absence de l'hôte.
    await host.waitForTimeout(5000)

    for (const name of NAMES) {
      await expectInGame(name)
    }

    await hostCtx.setOffline(false)
    await waitLog(/Manager reconnected/, from, 30_000)
    await expect(host.getByText(OVERLAY)).toBeHidden({ timeout: 20_000 })

    // La partie continue : question suivante jouée par tous.
    await advanceToNextQuestion("Alice")
    await waitAnswersOpen(NAMES)
    await answer(NAMES)

    for (const name of NAMES) {
      await expect(page[name]!.getByText("Score Total")).toBeVisible({
        timeout: 20_000,
      })
    }
  })
})
