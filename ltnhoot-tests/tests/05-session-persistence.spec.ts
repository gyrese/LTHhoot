import { test, expect } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "https://ltnhoot.ltn.re"
const INVITE_CODE = process.env.INVITE_CODE ?? ""

/**
 * Tests de persistance de session joueur.
 * Vérifie que le fix "PLAYER.RECONNECT une seule fois" fonctionne correctement :
 * - Vieille session localStorage → auto-effacée si partie expirée → PIN affiché
 * - Nouveau join valide → username affiché → PAS de reset intempestif
 */

test.describe("05 — Persistance de session joueur", () => {
  test.setTimeout(30_000)

  test("sans localStorage : le champ PIN est affiché immédiatement", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")
    await expect(page.locator("#pin-input")).toBeVisible({ timeout: 6000 })
  })

  test("session localStorage expirée → effacée auto → PIN affiché", async ({ page }) => {
    // Injecter une fausse session persistée (gameId inexistant)
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")

    await page.evaluate(() => {
      localStorage.setItem(
        "rahoot-player-storage",
        JSON.stringify({
          state: {
            gameId: "PARTIE-INEXISTANTE-000000",
            player: { username: "VieuxJoueur", points: 0 },
            status: null,
          },
          version: 0,
        }),
      )
    })

    // Recharger la page avec la fausse session
    await page.reload()
    await page.waitForLoadState("domcontentloaded")

    // Le serveur répond GAME.RESET → session vidée → PIN affiché (pas Username)
    await expect(page.locator("#pin-input")).toBeVisible({ timeout: 10_000 })
    // S'assurer que le champ username n'est PAS affiché
    await expect(page.locator("#nickname")).not.toBeVisible()
  })

  test("session localStorage expirée → localStorage effacé après reset", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")

    await page.evaluate(() => {
      localStorage.setItem(
        "rahoot-player-storage",
        JSON.stringify({
          state: {
            gameId: "PARTIE-INEXISTANTE-000000",
            player: { username: "VieuxJoueur", points: 0 },
            status: null,
          },
          version: 0,
        }),
      )
    })

    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    await page.locator("#pin-input").waitFor({ timeout: 10_000 })

    const stored = await page.evaluate(() => localStorage.getItem("rahoot-player-storage"))
    const parsed = stored ? JSON.parse(stored) : null
    // Après reset, gameId et player doivent être null
    expect(parsed?.state?.gameId).toBeFalsy()
    expect(parsed?.state?.player).toBeFalsy()
  })

})

test.describe("05b — PIN valide sans reset (nécessite INVITE_CODE)", () => {
  test.skip(!INVITE_CODE, "Ignoré — définir INVITE_CODE dans .env pour activer")
  test.setTimeout(30_000)

  test("PIN valide → username affiché → PAS de reset intempestif", async ({ page }) => {
    await page.goto("/")
    await page.locator("#pin-input").waitFor({ timeout: 6000 })
    await page.locator("#pin-input").fill(INVITE_CODE)
    await page.locator("#join-button").click()

    // Doit afficher le champ username, PAS revenir au PIN
    await expect(page.locator("#nickname")).toBeVisible({ timeout: 8000 })

    // Attendre 3 secondes pour s'assurer qu'aucun GAME.RESET intempestif ne se déclenche
    await page.waitForTimeout(3000)
    await expect(page.locator("#nickname")).toBeVisible()
    await expect(page.locator("#pin-input")).not.toBeVisible()
  })
})
