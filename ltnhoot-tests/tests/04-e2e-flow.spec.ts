import { test, expect, type BrowserContext, type Page } from "@playwright/test"

const SOCKET_URL = process.env.SOCKET_URL ?? "https://ltnhoot.ltn.re"
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? "admin"
const BASE_URL = process.env.BASE_URL ?? "https://ltnhoot.ltn.re"
const INVITE_CODE = process.env.INVITE_CODE ?? ""

/**
 * Tests E2E complets : plusieurs contextes navigateur simulant manager + joueurs
 */

test.describe("04 — Flux E2E complet", () => {
  test.setTimeout(60_000)

  test("le serveur socket répond sur /socket.io/", async ({ request }) => {
    const res = await request.get(`${SOCKET_URL}/socket.io/?EIO=4&transport=polling`)
    expect(res.status()).toBeLessThan(500)
  })

  test("le frontend est accessible", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")
    const hasViteError = await page.locator("text=Internal Server Error").isVisible().catch(() => false)
    expect(hasViteError).toBeFalsy()
  })

  test("la page d'accueil joueur charge avec le champ PIN", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("#pin-input")).toBeVisible({ timeout: 6000 })
  })

  test("navigation manager → remote → retour fonctionne", async ({ page }) => {
    await page.goto("/remote")
    await expect(page.locator("input").first()).toBeVisible({ timeout: 5000 })
    await page.goto("/")
    await expect(page.locator("#pin-input")).toBeVisible({ timeout: 5000 })
    await page.goto("/remote")
    await expect(page.locator("input").first()).toBeVisible({ timeout: 5000 })
  })

  test("deux onglets joueur sur la même page fonctionnent indépendamment", async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()

    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()

    await Promise.all([p1.goto(BASE_URL), p2.goto(BASE_URL)])

    await expect(p1.locator("#pin-input")).toBeVisible({ timeout: 5000 })
    await expect(p2.locator("#pin-input")).toBeVisible({ timeout: 5000 })

    await p1.locator("#pin-input").fill("AAAAAA")
    await p2.locator("#pin-input").fill("BBBBBB")

    const val1 = await p1.locator("#pin-input").inputValue()
    const val2 = await p2.locator("#pin-input").inputValue()

    expect(val1).toBe("AAAAAA")
    expect(val2).toBe("BBBBBB")

    await ctx1.close()
    await ctx2.close()
  })

  test("la télécommande /remote affiche l'indicateur de connexion serveur", async ({ page }) => {
    await page.goto("/remote")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=connecté").or(page.locator("text=Connexion"))).toBeVisible({
      timeout: 5000,
    })
  })

  test("les routes invalides n'affichent pas d'erreur blanche", async ({ page }) => {
    await page.goto("/route-qui-nexiste-pas-du-tout")
    await page.waitForLoadState("domcontentloaded")
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.trim().length).toBeGreaterThan(0)
  })
})

/**
 * Test join avec un PIN de partie déjà ouverte (INVITE_CODE dans .env)
 */
test.describe("04c — Rejoindre une partie réelle avec PIN", () => {
  test.skip(!INVITE_CODE, "Ignoré — définir INVITE_CODE dans .env pour activer")
  test.setTimeout(30_000)

  test("joueur rejoint la salle avec le PIN réel", async ({ page }) => {
    await page.goto("/")
    await page.locator("#pin-input").waitFor({ timeout: 5000 })
    await page.locator("#pin-input").fill(INVITE_CODE)
    await page.locator("#join-button").click()

    // Arriver sur la page de saisie du pseudo
    await page.locator("#nickname").waitFor({ timeout: 8000 })
    await page.locator("#nickname").fill("TestAuto01")
    await page.locator("#username-submit").click()

    // Arriver dans la salle d'attente joueur — l'URL passe sur /party/...
    await page.waitForURL(/\/party\//, { timeout: 8000 })
    // Le nom du joueur est affiché en bas
    await expect(page.getByText("TestAuto01")).toBeVisible({ timeout: 5000 })
  })

  test("deux joueurs rejoignent simultanément avec le même PIN", async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()

    await Promise.all([p1.goto(BASE_URL), p2.goto(BASE_URL)])

    for (const [page, nick] of [[p1, "TestAuto_A"], [p2, "TestAuto_B"]] as const) {
      await page.locator("#pin-input").fill(INVITE_CODE)
      await page.locator("#join-button").click()
      await page.locator("#nickname").waitFor({ timeout: 8000 })
      await page.locator("#nickname").fill(nick)
      await page.locator("#username-submit").click()
    }

    // Vérifier que les deux joueurs sont dans la salle d'attente
    await p1.waitForURL(/\/party\//, { timeout: 8000 })
    await p2.waitForURL(/\/party\//, { timeout: 8000 })
    await expect(p1.getByText("TestAuto_A")).toBeVisible({ timeout: 5000 })
    await expect(p2.getByText("TestAuto_B")).toBeVisible({ timeout: 5000 })

    await ctx1.close()
    await ctx2.close()
  })
})

/**
 * Tests E2E avec partie réelle — nécessite SKIP_REAL_GAME=false dans l'env
 */
test.describe("04b — Flux E2E avec partie réelle", () => {
  test.skip(
    process.env.SKIP_REAL_GAME !== "false",
    "Ignoré par défaut — définir SKIP_REAL_GAME=false pour activer",
  )
  test.setTimeout(120_000)

  let managerCtx: BrowserContext
  let playerCtx: BrowserContext
  let managerPage: Page
  let playerPage: Page

  test.beforeEach(async ({ browser }) => {
    managerCtx = await browser.newContext()
    playerCtx = await browser.newContext()
    managerPage = await managerCtx.newPage()
    playerPage = await playerCtx.newPage()
  })

  test.afterEach(async () => {
    await managerCtx.close()
    await playerCtx.close()
  })

  test("flux complet : manager crée partie → joueur rejoint → partie démarre", async () => {
    await managerPage.goto(`${BASE_URL}/manager/config`)
    await managerPage.waitForLoadState("domcontentloaded")

    const hasQuiz = await managerPage
      .locator('[class*="card"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    if (!hasQuiz) {
      test.skip()
      return
    }

    await managerPage.locator('[class*="card"]').first().click()
    const startBtn = managerPage.locator('button:has-text("Démarrer")')
    await expect(startBtn).toBeEnabled({ timeout: 3000 })
    await startBtn.click()

    const inviteCode = await managerPage.locator("#game-pin").textContent({ timeout: 8000 })
    expect(inviteCode).toBeTruthy()

    await playerPage.goto(`${BASE_URL}/`)
    await playerPage.locator("#pin-input").fill(inviteCode!.trim())
    await playerPage.locator("#join-button").click()
    await playerPage.locator("#nickname").waitFor({ timeout: 5000 })
    await playerPage.locator("#nickname").fill("TestJoueur01")
    await playerPage.locator("#username-submit").click()

    await expect(playerPage.locator("#game-pin")).toBeVisible({ timeout: 6000 })
    const displayedCode = await playerPage.locator("#game-pin").textContent()
    expect(displayedCode?.trim()).toBe(inviteCode!.trim())
  })
})
