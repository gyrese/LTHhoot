import { test, expect, type Page } from "@playwright/test"
import { io as ioClient } from "socket.io-client"
import * as path from "path"
import { createGame, joinPlayer } from "../helpers/gameHelpers"
import {
  crashSocket,
  startPreview,
  startSocket,
  stopServer,
  type SocketHandle,
} from "../helpers/recoveryServer"

// Connexion manager — pattern éprouvé (cf. test 09) : on remplit le mot de passe
// et on attend que le champ disparaisse (= authentifié). On évite le helper
// partagé loginManager qui fait un waitForURL après un submit SPA sans navigation.
async function login(page: Page, password: string): Promise<void> {
  await page.goto("/manager/config")
  const pwd = page.locator('input[type="password"]')
  await pwd.waitFor({ timeout: 12_000 })
  await pwd.fill(password)
  // Validation par Entrée (ManagerPassword gère onKeyDown) — plus fiable que de
  // cibler le bouton custom (qui n'a pas de type="submit").
  await pwd.press("Enter")
  await expect(pwd).not.toBeVisible({ timeout: 12_000 })
}

/**
 * Test 16 — Validation PROFONDE du Palier 0 (résilience temps-réel).
 *
 * Stack isolée (cf. playwright.recovery.config.ts) : web `vite preview` :3010,
 * socket :3011 lancé/tué par CE test. Le socket utilise un CONFIG_PATH dédié
 * (mot de passe seedé par défaut = "PASSWORD", quiz d'exemple).
 *
 * Couvre :
 *  - 0.2 Persistance/reprise : une partie + ses joueurs SURVIVENT à un kill -9
 *    brutal du process socket (sans la persistance, le serveur relancé ignore la
 *    partie → le joueur serait éjecté vers l'accueil).
 *  - 0.3 Livraison de réponse : la réponse d'un joueur est réellement reçue et
 *    scorée côté serveur (accusé de réception), prouvé par l'écran de résultat.
 */

const WEB_PORT = 3020
const SOCKET_PORT = 3021
const WS_TARGET = `http://localhost:${SOCKET_PORT}`
const CONFIG_DIR = path.join(process.cwd(), ".recovery-config")
const PASSWORD = "test123" // mot de passe RÉEL seedé par le helper (le défaut "PASSWORD" est refusé)

let socket: SocketHandle
let preview: SocketHandle

test.describe.configure({ mode: "serial" })

test.describe("16 — Résilience Palier 0 (crash recovery + ack)", () => {
  test.setTimeout(150_000)

  test.beforeAll(async () => {
    socket = await startSocket({
      port: SOCKET_PORT,
      configPath: CONFIG_DIR,
      fresh: true,
    })
    preview = await startPreview({ webPort: WEB_PORT, wsTarget: WS_TARGET })
  })

  test.afterAll(async () => {
    await stopServer(socket).catch(() => undefined)
    await stopServer(preview).catch(() => undefined)
  })

  test("0.2 — une partie survit à un kill brutal du socket et les clients se reconnectent", async ({
    browser,
  }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      // 1) Partie créée + joueur dans le lobby
      await login(managerPage, PASSWORD)
      const pin = await createGame(managerPage)
      expect(pin, "un PIN doit être généré").toBeTruthy()

      await joinPlayer(playerPage, pin!, "CrashTestA")
      expect(playerPage.url()).toMatch(/\/party\//)
      // Le joueur apparaît côté manager (preuve qu'il est bien dans la partie)
      await expect(managerPage.getByText("CrashTestA")).toBeVisible({
        timeout: 10_000,
      })

      // 2) Laisser l'autosave (3s) capturer la partie + le joueur sur disque
      await playerPage.waitForTimeout(4500)

      // 3) CRASH brutal du process socket (SIGKILL = aucun arrêt propre)
      await crashSocket(socket)

      // 4) Redémarrage : le serveur recharge la partie depuis l'instantané
      socket = await startSocket({
        port: SOCKET_PORT,
        configPath: CONFIG_DIR,
        fresh: false,
      })

      // 5) Laisser les clients se reconnecter (et un éventuel RESET se produire)
      await playerPage.waitForTimeout(13_000)

      // 6) ASSERTIONS : la partie a survécu.
      //    - Le joueur est TOUJOURS dans la partie (URL /party/), pas renvoyé à
      //      l'accueil (#pin-input). Sans persistance, il aurait reçu un RESET.
      expect(playerPage.url(), "le joueur doit rester dans /party/").toMatch(
        /\/party\//,
      )
      await expect(
        playerPage.locator("#pin-input"),
        "le joueur ne doit PAS être renvoyé à l'accueil",
      ).toHaveCount(0)

      //    - Le manager retrouve son lobby (PIN) sur la partie restaurée.
      await expect(
        managerPage.locator("#game-pin"),
        "le manager doit retrouver le lobby restauré",
      ).toBeVisible({ timeout: 20_000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("0.3 — la réponse d'un joueur est livrée et scorée (accusé de réception)", async ({
    browser,
  }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      await login(managerPage, PASSWORD)
      const pin = await createGame(managerPage)
      expect(pin, "un PIN doit être généré").toBeTruthy()

      await joinPlayer(playerPage, pin!, "AckTest")
      await expect(managerPage.getByText("AckTest")).toBeVisible({
        timeout: 10_000,
      })

      // Lancer la première question
      const startRound = managerPage.locator("#start-round")
      await expect(startRound).toBeEnabled({ timeout: 10_000 })
      await startRound.click()

      // Attendre la phase de réponse côté joueur (boutons de réponse cliquables).
      // ~15s de phases (start/cooldown/prepared/question) avant l'ouverture.
      const answerButtons = playerPage.locator("button.shadow-inset")
      await answerButtons.first().waitFor({ state: "visible", timeout: 35_000 })

      // Cliquer la BONNE réponse (index 1 = "Good answer", solutions:[1], non mélangé).
      await answerButtons.nth(1).click()

      // Un seul joueur ayant répondu → auto-fin de manche → écran de résultat.
      // Si la réponse n'était PAS livrée (bug d'origine), pas d'auto-fin (timer
      // complet) et le joueur serait scoré "Dommage" : l'assertion ci-dessous
      // échouerait. La voir passer vite prouve la livraison + le scoring correct.
      await expect(
        playerPage.getByText("Score Total"),
        "le joueur doit atteindre l'écran de résultat (réponse reçue)",
      ).toBeVisible({ timeout: 12_000 })
      await expect(
        playerPage.getByText("Bravo"),
        "réponse correcte bien comptabilisée côté serveur",
      ).toBeVisible({ timeout: 5_000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("0.1 — un throw (sync ET async) dans un handler n'éjecte personne (garde-fou)", async () => {
    // Client socket BRUT (pas un navigateur) connecté directement au socket de test.
    const client = ioClient(`http://localhost:${SOCKET_PORT}`, {
      path: "/ws",
      transports: ["polling", "websocket"],
      auth: { clientId: "guard-test-client" },
    })

    try {
      await new Promise<void>((resolve, reject) => {
        client.on("connect", () => resolve())
        client.on("connect_error", (e) => reject(e))
        setTimeout(() => reject(new Error("timeout connexion client brut")), 10_000)
      })

      // Déclenche plusieurs exceptions de handler (sync + async rejetée).
      for (let i = 0; i < 5; i += 1) {
        client.emit("__test_throw_sync")
        client.emit("__test_throw_async")
      }

      await new Promise((r) => setTimeout(r, 1500))

      // Le serveur est TOUJOURS debout et répond (le garde-fou a isolé les throws).
      const res = await fetch(`http://localhost:${SOCKET_PORT}/health`)
      expect(res.ok, "le serveur répond toujours après les throws").toBeTruthy()
      const health = (await res.json()) as { status: string }
      expect(health.status).toBe("ok")

      // Le client fautif n'a même pas été déconnecté : l'exception est confinée.
      expect(
        client.connected,
        "le client n'est pas déconnecté par l'exception",
      ).toBe(true)
    } finally {
      client.disconnect()
    }
  })

  test("0.3 — coupure réseau au clic → réponse livrée à la reconnexion (retry/ack)", async ({
    browser,
  }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      await login(managerPage, PASSWORD)
      const pin = await createGame(managerPage)
      expect(pin).toBeTruthy()

      await joinPlayer(playerPage, pin!, "OfflineAck")
      await expect(managerPage.getByText("OfflineAck")).toBeVisible({
        timeout: 10_000,
      })

      const startRound = managerPage.locator("#start-round")
      await expect(startRound).toBeEnabled({ timeout: 10_000 })
      await startRound.click()

      const answerButtons = playerPage.locator("button.shadow-inset")
      await answerButtons.first().waitFor({ state: "visible", timeout: 35_000 })

      // Couper le réseau JUSTE avant de répondre, puis cliquer : l'émission est
      // bufferisée. Sans ack/retry, la réponse serait perdue silencieusement.
      await playerCtx.setOffline(true)
      await answerButtons.nth(1).click()
      await playerPage.waitForTimeout(1500)
      await playerCtx.setOffline(false)

      // La réponse finit par être livrée à la reconnexion → écran de résultat.
      await expect(
        playerPage.getByText("Score Total"),
        "réponse livrée après reconnexion (retry/ack), pas de perte silencieuse",
      ).toBeVisible({ timeout: 25_000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("multi-joueurs — deux joueurs répondent, les deux sont scorés correctement", async ({
    browser,
  }) => {
    const managerCtx = await browser.newContext()
    const p1Ctx = await browser.newContext()
    const p2Ctx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const p1 = await p1Ctx.newPage()
    const p2 = await p2Ctx.newPage()

    try {
      await login(managerPage, PASSWORD)
      const pin = await createGame(managerPage)
      expect(pin).toBeTruthy()

      await joinPlayer(p1, pin!, "Multi1")
      await joinPlayer(p2, pin!, "Multi2")
      await expect(managerPage.getByText("Multi1")).toBeVisible({ timeout: 10_000 })
      await expect(managerPage.getByText("Multi2")).toBeVisible({ timeout: 10_000 })

      const startRound = managerPage.locator("#start-round")
      await expect(startRound).toBeEnabled({ timeout: 10_000 })
      await startRound.click()

      const b1 = p1.locator("button.shadow-inset")
      const b2 = p2.locator("button.shadow-inset")
      await b1.first().waitFor({ state: "visible", timeout: 35_000 })
      await b2.first().waitFor({ state: "visible", timeout: 10_000 })

      await b1.nth(1).click() // bonne réponse (index 1)
      await b2.nth(0).click() // mauvaise réponse (index 0 = "No")

      // Les deux atteignent leur résultat, avec le bon verdict chacun.
      await expect(p1.getByText("Score Total")).toBeVisible({ timeout: 15_000 })
      await expect(p2.getByText("Score Total")).toBeVisible({ timeout: 15_000 })
      await expect(p1.getByText("Bravo")).toBeVisible({ timeout: 5_000 })
      await expect(p2.getByText("Dommage")).toBeVisible({ timeout: 5_000 })
    } finally {
      await managerCtx.close()
      await p1Ctx.close()
      await p2Ctx.close()
    }
  })
})
