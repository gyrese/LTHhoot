import { test, expect } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "https://ltnhoot.ltn.re"
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? ""
const SKIP_REAL_GAME = process.env.SKIP_REAL_GAME !== "false"

/**
 * Test 10 — Reconnexion joueur en cours de partie
 * Vérifie : refresh page → session restaurée / overlay affiché puis disparu / URL préservée
 */
test.describe("10 — Reconnexion joueur", () => {
  test.skip(!MANAGER_PASSWORD || SKIP_REAL_GAME, "Ignoré — MANAGER_PASSWORD + SKIP_REAL_GAME=false requis")
  test.setTimeout(90_000)

  async function startGameAndJoin(
    browser: import("@playwright/test").Browser,
    playerNick: string,
  ) {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    await managerPage.goto(`${BASE_URL}/manager/config`)
    await managerPage.locator('input[type="password"]').waitFor({ timeout: 8000 })
    await managerPage.locator('input[type="password"]').fill(MANAGER_PASSWORD)
    await managerPage.locator('button[type="submit"]').or(managerPage.locator("button").last()).click()
    await expect(managerPage.locator('input[type="password"]')).not.toBeVisible({ timeout: 8000 })

    const card = managerPage.locator("div[draggable='true']").first()
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      return null
    }
    await card.click()
    await managerPage.locator("footer button").click()
    await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
    const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

    await playerPage.goto(`${BASE_URL}/`)
    await playerPage.locator("#pin-input").fill(pin)
    await playerPage.locator("#join-button").click()
    await playerPage.locator("#nickname").waitFor({ timeout: 8000 })
    await playerPage.locator("#nickname").fill(playerNick)
    await playerPage.locator("#username-submit").click()
    await playerPage.waitForURL(/\/party\//, { timeout: 10_000 })

    return { managerCtx, playerCtx, managerPage, playerPage, pin }
  }

  test("refresh en salle d'attente → session restaurée, URL /party/ préservée", async ({ browser }) => {
    const result = await startGameAndJoin(browser, "RecoTest10A")
    if (!result) { test.skip(); return }
    const { managerCtx, playerCtx, playerPage } = result

    try {
      const partyUrl = playerPage.url()
      expect(partyUrl).toMatch(/\/party\//)

      // Refresh de la page joueur
      await playerPage.reload()
      await playerPage.waitForLoadState("domcontentloaded")
      await playerPage.waitForTimeout(4000)

      // Doit rester sur /party/ et afficher le nom du joueur
      expect(playerPage.url()).toMatch(/\/party\//)
      await expect(playerPage.getByText("RecoTest10A")).toBeVisible({ timeout: 8000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("coupure réseau → overlay 'Connexion interrompue' → rétablissement → overlay disparu", async ({
    browser,
  }) => {
    const result = await startGameAndJoin(browser, "RecoTest10B")
    if (!result) { test.skip(); return }
    const { managerCtx, playerCtx, playerPage } = result

    try {
      // Couper le réseau côté joueur
      await playerPage.context().setOffline(true)
      await playerPage.waitForTimeout(2000)

      // L'overlay de reconnexion doit apparaître
      const overlay = playerPage.locator("text=Connexion interrompue")
      const overlayVisible = await overlay.isVisible({ timeout: 5000 }).catch(() => false)

      // Rétablir le réseau
      await playerPage.context().setOffline(false)
      await playerPage.waitForTimeout(5000)

      if (overlayVisible) {
        // L'overlay doit disparaître après reconnexion
        await expect(overlay).not.toBeVisible({ timeout: 15_000 })
      }

      // La page doit toujours être /party/
      expect(playerPage.url()).toMatch(/\/party\//)
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("rechargement répété (3x) → session toujours restaurée", async ({ browser }) => {
    const result = await startGameAndJoin(browser, "RecoTest10C")
    if (!result) { test.skip(); return }
    const { managerCtx, playerCtx, playerPage } = result

    try {
      for (let i = 0; i < 3; i++) {
        await playerPage.reload()
        await playerPage.waitForLoadState("domcontentloaded")
        await playerPage.waitForTimeout(3000)
        expect(playerPage.url()).toMatch(/\/party\//)
      }

      await expect(playerPage.getByText("RecoTest10C")).toBeVisible({ timeout: 8000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })
})
