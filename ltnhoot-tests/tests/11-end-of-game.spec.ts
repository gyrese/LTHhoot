import { test, expect } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "https://ltnhoot.ltn.re"
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? ""
const SKIP_REAL_GAME = process.env.SKIP_REAL_GAME !== "false"

/**
 * Test 11 — Fin de partie → redirection joueur vers la page PIN
 * Vérifie le bug corrigé : quand le manager termine/reset la partie,
 * le joueur est redirigé vers / et voit le champ PIN (pas bloqué sur Username).
 */
test.describe("11 — Fin de partie → redirection PIN", () => {
  test.skip(!MANAGER_PASSWORD || SKIP_REAL_GAME, "Ignoré — MANAGER_PASSWORD + SKIP_REAL_GAME=false requis")
  test.setTimeout(90_000)

  async function setupGame(browser: import("@playwright/test").Browser, nick: string) {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    // Login manager + démarrer la partie
    await managerPage.goto(`${BASE_URL}/manager/config`)
    await managerPage.locator('input[type="password"]').waitFor({ timeout: 8000 })
    await managerPage.locator('input[type="password"]').fill(MANAGER_PASSWORD)
    await managerPage.locator('button[type="submit"]').or(managerPage.locator("button").last()).click()
    await expect(managerPage.locator('input[type="password"]')).not.toBeVisible({ timeout: 8000 })

    const card = managerPage.locator("div[draggable='true']").first()
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) return null

    await card.click()
    await managerPage.locator("footer button").click()
    await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
    const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

    // Joueur rejoint
    await playerPage.goto(`${BASE_URL}/`)
    await playerPage.locator("#pin-input").fill(pin)
    await playerPage.locator("#join-button").click()
    await playerPage.locator("#nickname").waitFor({ timeout: 8000 })
    await playerPage.locator("#nickname").fill(nick)
    await playerPage.locator("#username-submit").click()
    await playerPage.waitForURL(/\/party\//, { timeout: 10_000 })
    await expect(playerPage.getByText(nick)).toBeVisible({ timeout: 6000 })

    return { managerCtx, playerCtx, managerPage, playerPage }
  }

  /** Clique "Fermer la session" et accepte le confirm dialog */
  async function endGame(managerPage: import("@playwright/test").Page) {
    managerPage.once("dialog", (dialog) => dialog.accept())
    await managerPage.locator('button:has-text("Fermer la session")').click()
  }

  test("manager ferme la session → joueur redirigé vers / avec champ PIN", async ({ browser }) => {
    const result = await setupGame(browser, "EndTest11A")
    if (!result) { test.skip(); return }
    const { managerCtx, playerCtx, managerPage, playerPage } = result

    try {
      await endGame(managerPage)

      // Le joueur doit être redirigé vers / avec #pin-input visible
      await playerPage.waitForURL(/\/$|\/\?/, { timeout: 20_000 })
      await expect(playerPage.locator("#pin-input")).toBeVisible({ timeout: 8000 })
      // Le champ username NE DOIT PAS être visible (session vidée)
      await expect(playerPage.locator("#nickname")).not.toBeVisible()
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("après fin de session → localStorage vidé (player=null)", async ({ browser }) => {
    const result = await setupGame(browser, "EndTest11B")
    if (!result) { test.skip(); return }
    const { managerCtx, playerCtx, managerPage, playerPage } = result

    try {
      await endGame(managerPage)
      await playerPage.waitForURL(/\/$|\/\?/, { timeout: 20_000 })
      await playerPage.locator("#pin-input").waitFor({ timeout: 8000 })

      const stored = await playerPage.evaluate(() =>
        localStorage.getItem("rahoot-player-storage"),
      )
      const parsed = stored ? JSON.parse(stored) : null
      expect(parsed?.state?.player).toBeFalsy()
      expect(parsed?.state?.gameId).toBeFalsy()
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("après fin de session → nouveau PIN saisissable immédiatement", async ({ browser }) => {
    const result = await setupGame(browser, "EndTest11C")
    if (!result) { test.skip(); return }
    const { managerCtx, playerCtx, managerPage, playerPage } = result

    try {
      await endGame(managerPage)
      await playerPage.waitForURL(/\/$|\/\?/, { timeout: 20_000 })
      const pinInput = playerPage.locator("#pin-input")
      await expect(pinInput).toBeVisible({ timeout: 8000 })

      await pinInput.fill("NOUVEAU")
      expect(await pinInput.inputValue()).toBe("NOUVEAU")
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })
})
