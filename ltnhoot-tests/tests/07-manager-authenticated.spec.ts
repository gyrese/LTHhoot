import { test, expect } from "@playwright/test"

const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? ""
const INVITE_CODE = process.env.INVITE_CODE ?? ""
const SKIP_REAL_GAME = process.env.SKIP_REAL_GAME !== "false"

/**
 * Tests manager authentifié : dashboard, sélection quiz, démarrage de partie.
 * Nécessite MANAGER_PASSWORD dans .env.
 *
 * Flux /remote :
 *   /remote/        → saisie du code de partie (pas de mot de passe)
 *   /remote/$gameId → authentification mot de passe manager
 */

test.describe("07 — Manager authentifié", () => {
  test.skip(!MANAGER_PASSWORD, "Ignoré — définir MANAGER_PASSWORD dans .env pour activer")
  test.setTimeout(30_000)

  async function loginManager(page: import("@playwright/test").Page) {
    await page.goto("/manager/config")
    await page.locator('input[type="password"]').waitFor({ timeout: 8000 })
    await page.locator('input[type="password"]').fill(MANAGER_PASSWORD)
    await page.locator('button[type="submit"]').or(page.locator("button").last()).click()
    await expect(page.locator('input[type="password"]')).not.toBeVisible({ timeout: 8000 })
  }

  // ── /remote : page de saisie de code (sans mot de passe) ────────────────
  test("télécommande /remote — statut serveur connecté visible", async ({ page }) => {
    await page.goto("/remote")
    await page.waitForLoadState("domcontentloaded")
    await expect(page.locator("text=Serveur connecté")).toBeVisible({ timeout: 8000 })
  })

  test("télécommande /remote — bouton Rejoindre désactivé si champ vide", async ({ page }) => {
    await page.goto("/remote")
    await page.waitForLoadState("domcontentloaded")
    // Le bouton "Rejoindre →" doit être désactivé tant que le champ est vide
    await expect(page.locator('button:has-text("Rejoindre")')).toBeDisabled({ timeout: 5000 })
  })

  test.describe("07r — Télécommande avec code de partie réel", () => {
    test.skip(!INVITE_CODE, "Ignoré — définir INVITE_CODE dans .env pour activer")

    test("saisie du code → navigation vers /remote/$gameId", async ({ page }) => {
      await page.goto("/remote")
      await page.waitForLoadState("domcontentloaded")
      await page.locator('input[placeholder="Ex : ABC123"]').fill(INVITE_CODE)
      await page.locator('button:has-text("Rejoindre")').click()
      // Navigue vers /remote/$gameId avec le formulaire de mot de passe
      await page.waitForURL(/\/remote\/.+/, { timeout: 8000 })
      expect(page.url()).toMatch(/\/remote\/.+/)
    })

    test("auth manager sur /remote/$gameId avec bon mot de passe", async ({ page }) => {
      await page.goto("/remote")
      await page.waitForLoadState("domcontentloaded")
      await page.locator('input[placeholder="Ex : ABC123"]').fill(INVITE_CODE)
      await page.locator('button:has-text("Rejoindre")').click()
      await page.waitForURL(/\/remote\/.+/, { timeout: 8000 })
      // Formulaire de mot de passe manager
      await page.locator('input[type="password"]').waitFor({ timeout: 6000 })
      await page.locator('input[type="password"]').fill(MANAGER_PASSWORD)
      await page.locator('button[type="submit"]').or(page.locator("button").last()).click()
      // Après auth : le panneau de contrôle doit s'afficher (plus de champ password)
      await expect(page.locator('input[type="password"]')).not.toBeVisible({ timeout: 6000 })
    })
  })

  // ── /manager/config : dashboard ─────────────────────────────────────────
  test("connexion avec le bon mot de passe affiche le dashboard", async ({ page }) => {
    await loginManager(page)
    // Le dashboard contient des cartes quiz (div[draggable]) ou un message vide
    const hasCards = await page.locator("div[draggable='true']").first().isVisible({ timeout: 6000 }).catch(() => false)
    const hasEmpty = await page.locator("text=Aucun, text=aucun, text=notFound").first().isVisible({ timeout: 2000 }).catch(() => false)
    expect(hasCards || hasEmpty).toBeTruthy()
  })

  test("connexion avec mauvais mot de passe → reste sur la page password", async ({ page }) => {
    await page.goto("/manager/config")
    await page.locator('input[type="password"]').waitFor({ timeout: 8000 })
    await page.locator('input[type="password"]').fill("mauvais_mdp_xyz_9999")
    await page.locator('button[type="submit"]').or(page.locator("button").last()).click()
    await page.waitForTimeout(2000)
    // Doit rester sur la page password
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 3000 })
  })

  test("sélectionner un quiz active le bouton Démarrer la partie", async ({ page }) => {
    await loginManager(page)
    const card = page.locator("div[draggable='true']").first()
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }
    await card.click()
    // Bouton dans le footer — texte "Démarrer la partie" (fr) ou "Start Game" (en)
    const startBtn = page.locator("footer button")
    await expect(startBtn).toBeEnabled({ timeout: 5000 })
  })

  test("sans sélection, le bouton footer est désactivé", async ({ page }) => {
    await loginManager(page)
    const startBtn = page.locator("footer button")
    await expect(startBtn).toBeDisabled({ timeout: 5000 })
  })

  test.describe("07b — Démarrer une partie réelle", () => {
    test.skip(SKIP_REAL_GAME, "Ignoré — définir SKIP_REAL_GAME=false pour activer")
    test.setTimeout(60_000)

    test("démarrer une partie génère un PIN affiché", async ({ page }) => {
      await loginManager(page)
      const card = page.locator("div[draggable='true']").first()
      if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip()
        return
      }
      await card.click()
      await page.locator("footer button").click()
      // Le PIN de la partie doit apparaître dans le manager display
      await expect(page.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = await page.locator("#game-pin").textContent()
      expect(pin?.trim().length).toBeGreaterThan(0)
    })
  })
})
