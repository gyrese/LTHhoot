import {
  test,
  expect,
  devices,
  type Browser,
  type Page,
} from "@playwright/test"
import { io } from "socket.io-client"
import { createGame, joinPlayer, loginManager } from "../helpers/gameHelpers"

/**
 * Test 15 — Suite « connexions » (audit stabilité).
 *
 * Couvre les trois corrections d'audit côté connexion :
 *  - #1 Transport WebSocket avec fallback polling (upgrade réellement effectué)
 *  - #2 La session n'est plus détruite quand l'écran principal tombe alors que
 *       des joueurs sont connectés
 *  - reconnexions joueur (reload + coupure réseau) sans « déco sauvage »
 *  - connexion massive simultanée (joueurs qui « n'arrivent pas à se connecter »)
 *  - télécommande qui rejoint et suit les joueurs
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const SOCKET_URL = process.env.SOCKET_URL ?? BASE_URL
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? "admin123"
const SKIP_REAL_GAME = process.env.SKIP_REAL_GAME !== "false"

// ─── 15A — Connectivité & transport (ne nécessite pas de partie) ───────────────

test.describe("15A — Connectivité socket & transport WebSocket", () => {
  test.setTimeout(40_000)

  test("le endpoint Engine.IO /ws répond au handshake polling", async ({
    request,
  }) => {
    // Le serveur expose Socket.IO sur le path /ws (et non /socket.io).
    const res = await request.get(
      `${SOCKET_URL}/ws/?EIO=4&transport=polling`,
    )
    expect(res.status()).toBe(200)
    const body = await res.text()
    // Paquet "open" Engine.IO : commence par 0 puis un JSON contenant le sid.
    expect(body).toContain("sid")
  })

  test("le transport bascule en WebSocket après upgrade (fix #1)", async () => {
    // Validation déterministe, indépendante du navigateur : un client Socket.IO
    // se connecte (polling d'abord) puis DOIT basculer en WebSocket. En mode
    // polling-only (avant le fix), engine.transport.name resterait « polling ».
    //
    // SOCKET_URL doit pointer là où /ws est servi : en prod le domaine (nginx
    // relaie l'Upgrade), en local le serveur socket (http://localhost:3001).
    const socket = io(SOCKET_URL, {
      path: "/ws",
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: false,
      timeout: 10_000,
    })

    try {
      await new Promise<void>((resolve, reject) => {
        socket.on("connect", () => resolve())
        socket.on("connect_error", (e) => reject(e))
        setTimeout(() => reject(new Error("timeout de connexion")), 12_000)
      })

      // Après le probe d'upgrade, le transport actif doit être « websocket ».
      await expect
        .poll(() => socket.io.engine?.transport?.name, { timeout: 15_000 })
        .toBe("websocket")
    } finally {
      socket.close()
    }
  })

  test("la home joueur affiche le champ PIN une fois connectée", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(page.locator("#pin-input")).toBeVisible({ timeout: 8000 })
  })

  test("la télécommande /remote signale « Serveur connecté »", async ({
    page,
  }) => {
    await page.goto("/remote")
    await expect(
      page.locator("text=connecté").or(page.locator("text=Connexion")),
    ).toBeVisible({ timeout: 8000 })
  })
})

// ─── 15B — Connexion massive & reconnexions (partie réelle) ────────────────────

test.describe("15B — Connexion massive & reconnexions joueur", () => {
  test.skip(
    SKIP_REAL_GAME,
    "Ignoré — définir SKIP_REAL_GAME=false (+ MANAGER_PASSWORD) pour activer",
  )
  test.describe.configure({ mode: "serial" })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "Le dashboard manager nécessite un écran de bureau")
  })

  test("8 joueurs rejoignent simultanément et sont tous vus par le manager", async ({
    browser,
  }) => {
    test.setTimeout(120_000)

    const managerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    await loginManager(managerPage, MANAGER_PASSWORD)

    const pin = await createGame(managerPage)
    if (!pin) {
      await managerCtx.close()
      test.skip(true, "Aucun quiz disponible côté serveur")

      return
    }

    const COUNT = 8
    const contexts = await Promise.all(
      Array.from({ length: COUNT }, () => browser.newContext()),
    )

    try {
      const pages = await Promise.all(contexts.map((c) => c.newPage()))
      const names = pages.map((_, i) => `Masse_${String(i + 1).padStart(2, "0")}`)

      // Connexion strictement simultanée
      await Promise.all(pages.map((p, i) => joinPlayer(p, pin, names[i])))

      // Tous les joueurs doivent apparaître dans le lobby manager
      for (const name of names) {
        await expect(
          managerPage.getByText(name, { exact: true }),
        ).toBeVisible({ timeout: 20_000 })
      }
    } finally {
      await Promise.all(contexts.map((c) => c.close()))
      await managerCtx.close()
    }
  })

  test("reconnexion par rechargements répétés (5×) → toujours dans /party/", async ({
    browser,
  }) => {
    test.setTimeout(90_000)

    const { managerCtx, playerCtx, playerPage } = await setupGameWithPlayer(
      browser,
      "RechargeX5",
    )

    try {
      for (let i = 0; i < 5; i += 1) {
        await playerPage.reload()
        await playerPage.waitForLoadState("domcontentloaded")
        await playerPage.waitForTimeout(2500)
        expect(playerPage.url()).toMatch(/\/party\//)
      }

      await expect(
        playerPage.getByText("RechargeX5"),
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      await playerCtx.close()
      await managerCtx.close()
    }
  })

  test("coupure réseau → reconnexion auto, joueur conservé + WebSocket rétabli", async ({
    browser,
  }) => {
    test.setTimeout(90_000)

    const { managerCtx, playerCtx, playerPage } = await setupGameWithPlayer(
      browser,
      "CoupureNet",
    )

    try {
      // Coupure réseau brutale côté joueur
      await playerPage.context().setOffline(true)
      await playerPage.waitForTimeout(3000)

      const overlay = playerPage.locator("text=Connexion interrompue")
      const overlayShown = await overlay
        .isVisible({ timeout: 5000 })
        .catch(() => false)

      // Rétablissement
      await playerPage.context().setOffline(false)

      if (overlayShown) {
        // L'overlay de reconnexion doit disparaître une fois le réseau revenu
        await expect(overlay).not.toBeVisible({ timeout: 20_000 })
      }

      // Garantie centrale : le joueur reste dans la partie, pas d'éjection vers
      // l'accueil (anti « déco sauvage »). Le transport (polling ou WebSocket)
      // est rétabli automatiquement par Socket.IO.
      expect(playerPage.url()).toMatch(/\/party\//)
      await expect(
        playerPage.getByText("CoupureNet"),
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      await playerCtx.close()
      await managerCtx.close()
    }
  })
})

// ─── 15C — Robustesse session : écran principal absent (fix #2) ────────────────

test.describe("15C — Session conservée quand l'écran principal tombe", () => {
  test.skip(
    SKIP_REAL_GAME,
    "Ignoré — définir SKIP_REAL_GAME=false (+ MANAGER_PASSWORD) pour activer",
  )
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "Le dashboard manager nécessite un écran de bureau")
  })

  test("écran principal fermé en salon + joueur présent → session NON détruite (fix #2)", async ({
    browser,
  }) => {
    // Le timer de reset « manager absent » est de 30 s : on attend au-delà pour
    // prouver que la garde hasConnectedPlayers conserve la session.
    test.setTimeout(120_000)

    const { managerCtx, playerCtx, playerPage } = await setupGameWithPlayer(
      browser,
      "SurvivantSession",
    )

    try {
      // L'écran principal disparaît brutalement (fermeture = coupure socket).
      await managerCtx.close()

      // Au-delà des 30 s de grâce du reset manager.
      await playerPage.waitForTimeout(35_000)

      // Le joueur recharge : sa session doit toujours exister côté serveur.
      await playerPage.reload()
      await playerPage.waitForLoadState("domcontentloaded")
      await playerPage.waitForTimeout(4000)

      // Sans le fix #2, la partie aurait été détruite → RESET → retour accueil.
      expect(playerPage.url()).toMatch(/\/party\//)
      await expect(
        playerPage.getByText("SurvivantSession"),
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      await playerCtx.close()
    }
  })
})

// ─── 15D — Télécommande ────────────────────────────────────────────────────────

test.describe("15D — Télécommande (connexion via PIN)", () => {
  test.skip(
    SKIP_REAL_GAME,
    "Ignoré — définir SKIP_REAL_GAME=false (+ MANAGER_PASSWORD) pour activer",
  )
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "Le dashboard manager nécessite un écran de bureau")
  })

  test("la télécommande rejoint via PIN + mot de passe et voit le joueur", async ({
    browser,
  }) => {
    test.setTimeout(90_000)

    const { managerCtx, playerCtx, pin } = await setupGameWithPlayer(
      browser,
      "JoueurTeleco",
    )

    const remoteCtx = await browser.newContext()
    const remotePage = await remoteCtx.newPage()

    try {
      // Saisie du code d'invitation sur /remote → navigation vers /remote/$gameId
      await remotePage.goto("/remote")
      const codeInput = remotePage.locator("input").first()
      await codeInput.waitFor({ state: "visible", timeout: 8000 })
      await codeInput.fill(pin)
      await remotePage
        .locator('button:has-text("Rejoindre")')
        .or(remotePage.locator("button").last())
        .click()

      // Écran d'authentification
      const pwd = remotePage.locator('input[type="password"]')
      await pwd.waitFor({ state: "visible", timeout: 10_000 })
      await pwd.fill(MANAGER_PASSWORD)
      await remotePage
        .locator('button:has-text("Accéder")')
        .or(remotePage.locator("button").last())
        .click()

      // Le dashboard de la télécommande affiche le joueur connecté
      await expect(
        remotePage.getByText("JoueurTeleco"),
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await remoteCtx.close()
      await playerCtx.close()
      await managerCtx.close()
    }
  })
})

// ─── 15E — Joueur MOBILE + manager bureau (scénario prod réel) ─────────────────

test.describe("15E — Joueur mobile avec manager bureau", () => {
  test.skip(
    SKIP_REAL_GAME,
    "Ignoré — définir SKIP_REAL_GAME=false (+ MANAGER_PASSWORD) pour activer",
  )
  // Ces tests créent EUX-MÊMES leurs contextes (manager bureau + joueur Pixel 7),
  // indépendamment du device du projet. On ne les exécute donc qu'une seule fois.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Contextes explicites — exécuté une seule fois (projet chromium)",
    )
  })

  test("joueur mobile : reload puis coupure réseau → reste connecté, pas d'éjection", async ({
    browser,
  }) => {
    test.setTimeout(120_000)

    // Manager sur un écran de bureau, joueur sur un vrai profil mobile.
    const managerCtx = await browser.newContext({
      ...devices["Desktop Chrome"],
    })
    const playerCtx = await browser.newContext({ ...devices["Pixel 7"] })
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      await loginManager(managerPage, MANAGER_PASSWORD)

      const pin = await createGame(managerPage)
      if (!pin) {
        test.skip(true, "Aucun quiz disponible côté serveur")

        return
      }

      await joinPlayer(playerPage, pin, "MobilePlayer")
      await expect(
        managerPage.getByText("MobilePlayer", { exact: true }),
      ).toBeVisible({ timeout: 15_000 })

      // 1) Rechargement de l'onglet mobile → session restaurée
      await playerPage.reload()
      await playerPage.waitForLoadState("domcontentloaded")
      await playerPage.waitForTimeout(3000)
      expect(playerPage.url()).toMatch(/\/party\//)

      // 2) Coupure réseau mobile (passage tunnel / veille radio) → reconnexion
      await playerPage.context().setOffline(true)
      await playerPage.waitForTimeout(3000)

      const overlay = playerPage.locator("text=Connexion interrompue")
      const overlayShown = await overlay
        .isVisible({ timeout: 5000 })
        .catch(() => false)

      await playerPage.context().setOffline(false)

      if (overlayShown) {
        await expect(overlay).not.toBeVisible({ timeout: 20_000 })
      }

      // Le joueur mobile est toujours dans la partie (anti « déco sauvage »)
      expect(playerPage.url()).toMatch(/\/party\//)
      await expect(
        playerPage.getByText("MobilePlayer"),
      ).toBeVisible({ timeout: 10_000 })

      // Le manager le voit toujours comme connecté
      await expect(
        managerPage.getByText("MobilePlayer", { exact: true }),
      ).toBeVisible({ timeout: 10_000 })
    } finally {
      await playerCtx.close()
      await managerCtx.close()
    }
  })
})

// ─── Helpers locaux ────────────────────────────────────────────────────────────

/**
 * Monte une partie (manager + 1 quiz) et y connecte un joueur. Skippe le test
 * si aucun quiz n'est disponible.
 */
async function setupGameWithPlayer(
  browser: Browser,
  playerNick: string,
): Promise<{
  managerCtx: import("@playwright/test").BrowserContext
  playerCtx: import("@playwright/test").BrowserContext
  managerPage: Page
  playerPage: Page
  pin: string
}> {
  const managerCtx = await browser.newContext()
  const managerPage = await managerCtx.newPage()
  await loginManager(managerPage, MANAGER_PASSWORD)

  const pin = await createGame(managerPage)
  if (!pin) {
    await managerCtx.close()
    test.skip(true, "Aucun quiz disponible côté serveur")
    throw new Error("unreachable")
  }

  const playerCtx = await browser.newContext()
  const playerPage = await playerCtx.newPage()
  await joinPlayer(playerPage, pin, playerNick)

  await expect(
    managerPage.getByText(playerNick, { exact: true }),
  ).toBeVisible({ timeout: 15_000 })

  return { managerCtx, playerCtx, managerPage, playerPage, pin }
}
