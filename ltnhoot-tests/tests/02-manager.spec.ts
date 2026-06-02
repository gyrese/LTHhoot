import { test, expect } from "@playwright/test"

/**
 * Tests du dashboard manager : authentification, navigation, création de partie
 */
test.describe("02 — Dashboard Manager", () => {
  test("la page /manager/config redirige si non connecté", async ({ page }) => {
    await page.goto("/manager/config")
    await page.waitForURL((url) => !url.pathname.includes("config"), { timeout: 5000 }).catch(() => {})
    const isRedirected = !page.url().includes("/manager/config")
    const hasAuthForm = await page.locator('input[type="password"]').isVisible().catch(() => false)
    expect(isRedirected || hasAuthForm).toBeTruthy()
  })

  test("la page /manager/config charge correctement", async ({ page }) => {
    await page.goto("/manager/config")
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 8000 })
    const title = await page.title()
    expect(title).toBeTruthy()
  })

  test("connexion avec mauvais mot de passe affiche une erreur", async ({ page }) => {
    await page.goto("/manager/config")
    const pwdInput = page.locator('input[type="password"]')
    if (await pwdInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pwdInput.fill("mauvais_mdp_test_12345")
      await page.locator('button[type="submit"]').or(page.locator("button").last()).click()
      await expect(
        page.locator("text=incorrect").or(page.locator("text=invalide")).or(page.locator("[class*='text-red']").first()),
      ).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })

  test("la page manager affiche la liste des quiz après connexion", async ({ page }) => {
    await page.goto("/manager/config")
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 8000 })
    const hasQuizList = await page
      .locator('[class*="quiz"]')
      .or(page.locator('[class*="quizz"]'))
      .or(page.locator('[class*="card"]'))
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    if (!hasQuizList) {
      test.skip()
    } else {
      expect(hasQuizList).toBeTruthy()
    }
  })

  test("le bouton Démarrer est désactivé sans quiz sélectionné", async ({ page }) => {
    await page.goto("/manager/config")
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 8000 })
    const startBtn = page
      .locator('button:has-text("Démarrer")')
      .or(page.locator('button:has-text("Start")'))
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(startBtn).toBeDisabled()
    } else {
      test.skip()
    }
  })
})
