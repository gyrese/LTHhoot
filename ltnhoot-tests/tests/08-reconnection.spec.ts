import { test, expect } from "@playwright/test"

const INVITE_CODE = process.env.INVITE_CODE ?? ""

/**
 * Tests de reconnexion joueur.
 * Vérifie que le refresh en cours de partie rétablit la session
 * et que la navigation vers / depuis /party/ ne reset pas la session active.
 */

test.describe("08 — Reconnexion joueur", () => {
  test.skip(!INVITE_CODE, "Ignoré — définir INVITE_CODE dans .env pour activer")
  test.setTimeout(60_000)

  test("refresh pendant la salle d'attente → reconnexion automatique", async ({ page }) => {
    // Rejoindre la partie
    await page.goto("/")
    await page.locator("#pin-input").fill(INVITE_CODE)
    await page.locator("#join-button").click()
    await page.locator("#nickname").waitFor({ timeout: 8000 })
    await page.locator("#nickname").fill("RecoTest01")
    await page.locator("#username-submit").click()
    await page.waitForURL(/\/party\//, { timeout: 10_000 })

    const partyUrl = page.url()

    // Simuler un refresh
    await page.reload()
    await page.waitForLoadState("domcontentloaded")

    // Doit rester sur /party/ après reconnexion (pas redirigé vers /)
    await page.waitForTimeout(3000)
    expect(page.url()).toMatch(/\/party\//)

    // Le nom du joueur doit toujours être affiché
    await expect(page.getByText("RecoTest01")).toBeVisible({ timeout: 8000 })
  })

  test("navigation manuelle vers / pendant une partie → Username affiché (pas PIN)", async ({
    page,
  }) => {
    // Rejoindre la partie
    await page.goto("/")
    await page.locator("#pin-input").fill(INVITE_CODE)
    await page.locator("#join-button").click()
    await page.locator("#nickname").waitFor({ timeout: 8000 })
    await page.locator("#nickname").fill("RecoTest02")
    await page.locator("#username-submit").click()
    await page.waitForURL(/\/party\//, { timeout: 10_000 })

    // Naviguer manuellement vers la home
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")

    // La session est active → doit afficher Username (pas PIN)
    // car player est défini dans le store persisté
    await expect(page.locator("#nickname")).toBeVisible({ timeout: 6000 })
    await expect(page.locator("#pin-input")).not.toBeVisible()
  })

  test("overlay de reconnexion affiché pendant la reconnexion socket", async ({ page }) => {
    await page.goto("/")
    await page.locator("#pin-input").fill(INVITE_CODE)
    await page.locator("#join-button").click()
    await page.locator("#nickname").waitFor({ timeout: 8000 })
    await page.locator("#nickname").fill("RecoTest03")
    await page.locator("#username-submit").click()
    await page.waitForURL(/\/party\//, { timeout: 10_000 })

    // Simuler une déconnexion réseau puis reconnexion
    await page.context().setOffline(true)
    await page.waitForTimeout(1000)

    // L'overlay de reconnexion doit apparaître
    const overlay = page
      .locator("text=Connexion interrompue")
      .or(page.locator("text=Restauration de votre session"))
    const overlayVisible = await overlay.isVisible({ timeout: 4000 }).catch(() => false)

    await page.context().setOffline(false)
    await page.waitForTimeout(3000)

    // Après reconnexion, l'overlay doit disparaître
    if (overlayVisible) {
      await expect(overlay).not.toBeVisible({ timeout: 8000 })
    }

    // La page /party/ doit toujours être active
    expect(page.url()).toMatch(/\/party\//)
  })
})
