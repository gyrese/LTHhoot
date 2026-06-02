import { test, expect } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "https://ltnhoot.ltn.re"
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? ""
const SKIP_REAL_GAME = process.env.SKIP_REAL_GAME !== "false"

/**
 * Test 09 — Manager démarre une vraie partie
 * Vérifie : login → sélection quiz → démarrage → PIN affiché → joueur peut rejoindre
 */
test.describe("09 — Manager démarre une partie", () => {
  test.skip(!MANAGER_PASSWORD || SKIP_REAL_GAME, "Ignoré — MANAGER_PASSWORD + SKIP_REAL_GAME=false requis")
  test.setTimeout(60_000)

  async function loginManager(page: import("@playwright/test").Page) {
    await page.goto("/manager/config")
    await page.locator('input[type="password"]').waitFor({ timeout: 8000 })
    await page.locator('input[type="password"]').fill(MANAGER_PASSWORD)
    await page.locator('button[type="submit"]').or(page.locator("button").last()).click()
    await expect(page.locator('input[type="password"]')).not.toBeVisible({ timeout: 8000 })
  }

  test("sélection quiz → Démarrer → PIN visible sur l'écran manager", async ({ page }) => {
    await loginManager(page)

    const card = page.locator("div[draggable='true']").first()
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    await card.click()
    await expect(page.locator("footer button")).toBeEnabled({ timeout: 3000 })
    await page.locator("footer button").click()

    // Le PIN doit apparaître sur l'écran de salle d'attente manager
    await expect(page.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
    const pin = await page.locator("#game-pin").textContent()
    expect(pin?.trim().length).toBeGreaterThan(0)
  })

  test("PIN généré → joueur peut rejoindre avec ce PIN", async ({ browser }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      // Manager démarre la partie
      await managerPage.goto(`${BASE_URL}/manager/config`)
      await managerPage.locator('input[type="password"]').waitFor({ timeout: 8000 })
      await managerPage.locator('input[type="password"]').fill(MANAGER_PASSWORD)
      await managerPage.locator('button[type="submit"]').or(managerPage.locator("button").last()).click()
      await expect(managerPage.locator('input[type="password"]')).not.toBeVisible({ timeout: 8000 })

      const card = managerPage.locator("div[draggable='true']").first()
      if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip()
        return
      }

      await card.click()
      await managerPage.locator("footer button").click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""
      expect(pin.length).toBeGreaterThan(0)

      // Joueur rejoint avec le PIN généré
      await playerPage.goto(`${BASE_URL}/`)
      await playerPage.locator("#pin-input").fill(pin)
      await playerPage.locator("#join-button").click()
      await expect(playerPage.locator("#nickname")).toBeVisible({ timeout: 8000 })
      await playerPage.locator("#nickname").fill("TestJoueur09")
      await playerPage.locator("#username-submit").click()
      await playerPage.waitForURL(/\/party\//, { timeout: 10_000 })
      await expect(playerPage.getByText("TestJoueur09")).toBeVisible({ timeout: 6000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("bouton #start-round visible après que des joueurs ont rejoint", async ({ browser }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      await managerPage.goto(`${BASE_URL}/manager/config`)
      await managerPage.locator('input[type="password"]').waitFor({ timeout: 8000 })
      await managerPage.locator('input[type="password"]').fill(MANAGER_PASSWORD)
      await managerPage.locator('button[type="submit"]').or(managerPage.locator("button").last()).click()
      await expect(managerPage.locator('input[type="password"]')).not.toBeVisible({ timeout: 8000 })

      const card = managerPage.locator("div[draggable='true']").first()
      if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip()
        return
      }

      await card.click()
      await managerPage.locator("footer button").click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

      // Un joueur rejoint
      await playerPage.goto(`${BASE_URL}/`)
      await playerPage.locator("#pin-input").fill(pin)
      await playerPage.locator("#join-button").click()
      await playerPage.locator("#nickname").waitFor({ timeout: 8000 })
      await playerPage.locator("#nickname").fill("TestStart09")
      await playerPage.locator("#username-submit").click()
      await playerPage.waitForURL(/\/party\//, { timeout: 10_000 })

      // Le manager voit le bouton de démarrage de la question
      await expect(managerPage.locator("#start-round")).toBeVisible({ timeout: 8000 })
      await expect(managerPage.locator("#start-round")).toBeEnabled()
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })
})
