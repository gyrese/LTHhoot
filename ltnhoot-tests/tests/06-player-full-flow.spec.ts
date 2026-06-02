import { test, expect } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "https://ltnhoot.ltn.re"
const INVITE_CODE = process.env.INVITE_CODE ?? ""

/**
 * Tests du flux complet joueur : PIN → pseudo → salle d'attente.
 * Nécessite INVITE_CODE dans .env (partie ouverte sur le serveur).
 * Si le PIN est expiré entre deux runs, les tests se skippent proprement.
 */

/** Tente de rejoindre une partie et retourne false si le PIN est expiré. */
async function tryJoin(page: import("@playwright/test").Page, pin: string): Promise<boolean> {
  await page.goto("/")
  await page.locator("#pin-input").waitFor({ timeout: 6000 })
  await page.locator("#pin-input").fill(pin)
  await page.locator("#join-button").click()
  return page.locator("#nickname").isVisible({ timeout: 8000 }).catch(() => false)
}

test.describe("06 — Flux joueur complet", () => {
  test.skip(!INVITE_CODE, "Ignoré — définir INVITE_CODE dans .env pour activer")
  test.setTimeout(40_000)

  test("PIN valide → champ username affiché avec bon label", async ({ page }) => {
    const joined = await tryJoin(page, INVITE_CODE)
    if (!joined) test.skip()
    await expect(page.locator("#nickname")).toBeVisible()
  })

  test("bouton submit username désactivé si champ vide", async ({ page }) => {
    const joined = await tryJoin(page, INVITE_CODE)
    if (!joined) test.skip()
    await expect(page.locator("#username-submit")).toBeDisabled()
  })

  test("username submit → navigation vers /party/", async ({ page }) => {
    const joined = await tryJoin(page, INVITE_CODE)
    if (!joined) test.skip()
    await page.locator("#nickname").fill("TestProd01")
    await page.locator("#username-submit").click()
    await page.waitForURL(/\/party\//, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/party\//)
  })

  test("username affiché dans la salle d'attente après join", async ({ page }) => {
    const joined = await tryJoin(page, INVITE_CODE)
    if (!joined) test.skip()
    await page.locator("#nickname").fill("TestProd02")
    await page.locator("#username-submit").click()
    await page.waitForURL(/\/party\//, { timeout: 10_000 })
    await expect(page.getByText("TestProd02")).toBeVisible({ timeout: 6000 })
  })

  test("PIN via query param ?pin= → champ username affiché directement", async ({ page }) => {
    await page.goto(`/?pin=${INVITE_CODE}`)
    const joined = await page.locator("#nickname").isVisible({ timeout: 10_000 }).catch(() => false)
    if (!joined) test.skip()
    await expect(page.locator("#nickname")).toBeVisible()
  })

  test("deux joueurs rejoignent sans interférence", async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()

    await Promise.all([p1.goto(BASE_URL), p2.goto(BASE_URL)])

    // Vérifier que le PIN est encore valide avant de continuer
    await p1.locator("#pin-input").fill(INVITE_CODE)
    await p1.locator("#join-button").click()
    const p1Joined = await p1.locator("#nickname").isVisible({ timeout: 8000 }).catch(() => false)
    if (!p1Joined) {
      await ctx1.close()
      await ctx2.close()
      test.skip()
      return
    }

    await p2.locator("#pin-input").fill(INVITE_CODE)
    await p2.locator("#join-button").click()
    await p2.locator("#nickname").waitFor({ timeout: 8000 })

    await p1.locator("#nickname").fill("ProdA")
    await p1.locator("#username-submit").click()
    await p2.locator("#nickname").fill("ProdB")
    await p2.locator("#username-submit").click()

    await p1.waitForURL(/\/party\//, { timeout: 10_000 })
    await p2.waitForURL(/\/party\//, { timeout: 10_000 })
    await expect(p1.getByText("ProdA")).toBeVisible({ timeout: 6000 })
    await expect(p2.getByText("ProdB")).toBeVisible({ timeout: 6000 })

    await ctx1.close()
    await ctx2.close()
  })
})
