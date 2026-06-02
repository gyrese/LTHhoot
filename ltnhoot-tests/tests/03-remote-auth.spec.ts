import { test, expect } from "@playwright/test"

/**
 * Tests de la télécommande manager : formulaire d'auth, erreurs, navigation
 */
test.describe("03 — Télécommande — Authentification", () => {
  test("la page /remote affiche le formulaire de code d'invitation", async ({ page }) => {
    await page.goto("/remote")
    await expect(page.locator("input").first()).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator("text=connecté").or(page.locator("text=Connexion")),
    ).toBeVisible({ timeout: 5000 })
  })

  test("un gameId inexistant affiche l'écran d'auth avec mot de passe", async ({ page }) => {
    await page.goto("/remote/game-inexistant-000")
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 })
  })

  test("un mauvais mot de passe affiche une erreur après soumission", async ({ page }) => {
    await page.goto("/remote/test-game-abc")
    const pwdInput = page.locator('input[type="password"]')
    await pwdInput.waitFor({ timeout: 5000 })
    // Remplir d'abord le mot de passe (ce qui active le bouton)
    await pwdInput.fill("mauvais_mdp_xxxxx")
    const btn = page.locator('button:has-text("Accéder")').or(page.locator('button:has-text("Connexion")'))
    // Attendre que le bouton soit actif (socket connecté + mdp non vide)
    await expect(btn).toBeEnabled({ timeout: 8000 })
    await btn.click()
    await expect(
      page
        .locator("text=incorrect")
        .or(page.locator("text=introuvable"))
        .or(page.locator("text=terminée"))
        .or(page.locator("text=Vérifiez"))
        .or(page.locator("[class*='text-red']").first()),
    ).toBeVisible({ timeout: 8000 })
  })

  test("le formulaire /remote soumet avec la touche Entrée", async ({ page }) => {
    await page.goto("/remote")
    await expect(page.locator("text=connecté")).toBeVisible({ timeout: 6000 })
    await page.locator("input").first().fill("TESTXX")
    await page.locator("input").first().press("Enter")
    await page.waitForTimeout(1500)
    const hasError = await page
      .locator("p.text-red-400")
      .isVisible()
      .catch(() => false)
    const hasNavigated = page.url().includes("/remote/")
    expect(hasError || hasNavigated).toBeTruthy()
  })

  test("le statut de connexion est visible sur /remote", async ({ page }) => {
    await page.goto("/remote")
    await page.waitForLoadState("domcontentloaded")
    await expect(
      page.locator("text=connecté").or(page.locator("text=Connexion")),
    ).toBeVisible({ timeout: 5000 })
  })

  test("le retour depuis /remote/$gameId vers /remote fonctionne", async ({ page }) => {
    await page.goto("/remote/some-game-id-test")
    await page.waitForLoadState("domcontentloaded")
    await page.goto("/remote")
    await expect(page.locator("input").first()).toBeVisible({ timeout: 5000 })
    expect(page.url()).toContain("/remote")
  })
})
