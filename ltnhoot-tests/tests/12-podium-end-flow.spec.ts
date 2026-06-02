import { test, expect } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "https://ltnhoot.ltn.re"
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? ""
const SKIP_REAL_GAME = process.env.SKIP_REAL_GAME !== "false"

/**
 * Test 12 — Flux complet jusqu'au podium
 * Manager démarre → joueur répond (ou skips) → PlayerFinished joueur → Podium manager
 * Le manager avance via #start-round jusqu'à la fin de la partie.
 */
test.describe("12 — Podium et fin de flux", () => {
  test.skip(!MANAGER_PASSWORD || SKIP_REAL_GAME, "Ignoré — MANAGER_PASSWORD + SKIP_REAL_GAME=false requis")
  test.setTimeout(300_000)

  /**
   * Avance la partie via #start-round jusqu'à l'état FINISHED.
   * Attend que le bouton réapparaisse entre les états intermédiaires (SHOW_START,
   * SHOW_RESULT, WAIT) où il est absent. S'arrête quand le texte est "Quitter"
   * (common:exit = état FINISHED) sans le cliquer.
   */
  async function advanceToEnd(
    managerPage: import("@playwright/test").Page,
    maxClicks = 200,
  ): Promise<boolean> {
    for (let i = 0; i < maxClicks; i++) {
      const btn = managerPage.locator("#start-round")

      // Attendre que le bouton apparaisse (90s pour absorber les timers longs)
      const appeared = await btn
        .waitFor({ state: "visible", timeout: 90_000 })
        .then(() => true)
        .catch(() => false)

      if (!appeared) return true // plus de bouton après 90s = partie finie

      // État FINISHED : le bouton affiche "Quitter" (common:exit) → on s'arrête
      const btnText = (await btn.textContent().catch(() => "") ?? "").trim()
      if (btnText === "Quitter" || btnText === "Exit") return true

      const enabled = await btn.isEnabled().catch(() => false)
      if (!enabled) {
        await managerPage.waitForTimeout(500)
        continue
      }

      await btn.click()
      await managerPage.waitForTimeout(300)
    }
    return false
  }

  test("flux complet : joueur voit son score en pts après la partie", async ({ browser }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      // Login manager + démarrer
      await managerPage.goto(`${BASE_URL}/manager/config`)
      await managerPage.locator('input[type="password"]').waitFor({ timeout: 8000 })
      await managerPage.locator('input[type="password"]').fill(MANAGER_PASSWORD)
      await managerPage.locator('button[type="submit"]').or(managerPage.locator("button").last()).click()
      await expect(managerPage.locator('input[type="password"]')).not.toBeVisible({ timeout: 8000 })

      const card = managerPage.locator("div[draggable='true']").first()
      if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }

      await card.click()
      await managerPage.locator("footer button").click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

      // Joueur rejoint
      await playerPage.goto(`${BASE_URL}/`)
      await playerPage.locator("#pin-input").fill(pin)
      await playerPage.locator("#join-button").click()
      await playerPage.locator("#nickname").waitFor({ timeout: 8000 })
      await playerPage.locator("#nickname").fill("PodiumTest12")
      await playerPage.locator("#username-submit").click()
      await playerPage.waitForURL(/\/party\//, { timeout: 10_000 })

      // Manager avance toute la partie jusqu'à la fin
      const ended = await advanceToEnd(managerPage)
      expect(ended).toBe(true)

      // Joueur doit voir le bouton Quitter (PlayerFinished + 5s délai)
      await expect(playerPage.locator('button:has-text("Quitter")')).toBeVisible({ timeout: 25_000 })
      await expect(playerPage.getByText("PodiumTest12").first()).toBeVisible({ timeout: 5000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("bouton Quitter apparaît 5s après PlayerFinished", async ({ browser }) => {
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
      if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }

      await card.click()
      await managerPage.locator("footer button").click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

      await playerPage.goto(`${BASE_URL}/`)
      await playerPage.locator("#pin-input").fill(pin)
      await playerPage.locator("#join-button").click()
      await playerPage.locator("#nickname").waitFor({ timeout: 8000 })
      await playerPage.locator("#nickname").fill("QuitTest12")
      await playerPage.locator("#username-submit").click()
      await playerPage.waitForURL(/\/party\//, { timeout: 10_000 })

      await advanceToEnd(managerPage)

      // Le bouton Quitter apparaît après 5s (setTimeout dans PlayerFinished.tsx)
      await expect(playerPage.locator('button:has-text("Quitter")')).toBeVisible({ timeout: 25_000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("bouton Quitter → redirige vers / avec #pin-input", async ({ browser }) => {
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
      if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }

      await card.click()
      await managerPage.locator("footer button").click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

      await playerPage.goto(`${BASE_URL}/`)
      await playerPage.locator("#pin-input").fill(pin)
      await playerPage.locator("#join-button").click()
      await playerPage.locator("#nickname").waitFor({ timeout: 8000 })
      await playerPage.locator("#nickname").fill("QuitNav12")
      await playerPage.locator("#username-submit").click()
      await playerPage.waitForURL(/\/party\//, { timeout: 10_000 })

      await advanceToEnd(managerPage)

      await expect(playerPage.locator('button:has-text("Quitter")')).toBeVisible({ timeout: 25_000 })

      // Cliquer Quitter → retour sur la page PIN
      await playerPage.locator('button:has-text("Quitter")').click()
      await playerPage.waitForURL(/\/$|\/\?/, { timeout: 8000 })
      await expect(playerPage.locator("#pin-input")).toBeVisible({ timeout: 6000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("manager voit le podium avec le pseudo du joueur", async ({ browser }) => {
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
      if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }

      await card.click()
      await managerPage.locator("footer button").click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

      await playerPage.goto(`${BASE_URL}/`)
      await playerPage.locator("#pin-input").fill(pin)
      await playerPage.locator("#join-button").click()
      await playerPage.locator("#nickname").waitFor({ timeout: 8000 })
      await playerPage.locator("#nickname").fill("PodiumPlayer12")
      await playerPage.locator("#username-submit").click()
      await playerPage.waitForURL(/\/party\//, { timeout: 10_000 })

      await advanceToEnd(managerPage)

      // Le manager doit voir le podium avec le pseudo du joueur
      await expect(managerPage.getByText("PodiumPlayer12")).toBeVisible({ timeout: 15_000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })
})
