import { test, expect } from "@playwright/test"

/**
 * Tests du flux d'entrée joueur : page PIN → pseudo → salle d'attente
 */
test.describe("01 — Rejoindre une partie", () => {
  test("la page /remote affiche le formulaire code d'invitation", async ({ page }) => {
    await page.goto("/remote")
    await expect(page.locator("input").first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator("button").last()).toBeVisible()
  })

  test("un code invalide affiche un message d'erreur", async ({ page }) => {
    await page.goto("/remote")
    await expect(page.locator("text=connecté")).toBeVisible({ timeout: 6000 })
    await page.locator("input").first().fill("XXXXXX")
    await page.locator("button").last().click()
    // Le message d'erreur est dans un <p class="... text-red-400">
    await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 6000 })
  })

  test("le bouton est désactivé sans code saisi", async ({ page }) => {
    await page.goto("/remote")
    const btn = page.locator("button").last()
    await expect(btn).toBeDisabled({ timeout: 5000 })
  })

  test("la page / affiche le champ PIN joueur", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("#pin-input")).toBeVisible({ timeout: 5000 })
    await expect(page.locator("#join-button")).toBeVisible()
  })

  test("un PIN invalide ne navigue pas vers une autre page", async ({ page }) => {
    await page.goto("/")
    await page.locator("#pin-input").fill("000000")
    await page.locator("#join-button").click()
    // Le formulaire ne navigue pas — on reste sur la page d'accueil
    await page.waitForTimeout(2000)
    expect(page.url()).toMatch(/\/$|\/\?/)
    // Le champ PIN est toujours visible
    await expect(page.locator("#pin-input")).toBeVisible()
  })

  test("Entrée clavier sur le champ PIN soumet le formulaire", async ({ page }) => {
    await page.goto("/")
    await page.locator("#pin-input").fill("000000")
    await page.locator("#pin-input").press("Enter")
    // La soumission ne navigue pas sur un PIN inexistant
    await page.waitForTimeout(2000)
    expect(page.url()).toMatch(/\/$|\/\?/)
    await expect(page.locator("#pin-input")).toBeVisible()
  })
})
