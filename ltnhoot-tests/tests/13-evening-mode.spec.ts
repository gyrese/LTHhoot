import { test, expect, type Page } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173"
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? ""
const SKIP_REAL_GAME = process.env.SKIP_REAL_GAME !== "false"

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginManager(page: Page) {
  await page.goto(`${BASE_URL}/manager`)
  await page.waitForLoadState("domcontentloaded")

  // Si déjà authentifié, redirigé vers /manager/config rapidement
  const redirected = await page.waitForURL(/\/manager\/config/, { timeout: 5000 }).then(() => true).catch(() => false)

  if (!redirected) {
    // Non authentifié — attendre le formulaire mot de passe
    await page.locator('input[type="password"]').waitFor({ state: "visible", timeout: 10_000 })
    await page.locator('input[type="password"]').fill(MANAGER_PASSWORD)
    await page.locator('button[type="submit"]').or(page.locator("button").last()).click()
    await page.waitForURL(/\/manager\/config/, { timeout: 15_000 })
  }

  // Attendre que le footer du dashboard soit visible (config chargée)
  await page.locator("footer").waitFor({ state: "visible", timeout: 15_000 })
}

async function joinPlayer(page: Page, pin: string, nickname: string) {
  await page.goto(`${BASE_URL}/`)
  await page.locator("#pin-input").fill(pin)
  await page.locator("#join-button").click()
  await page.locator("#nickname").waitFor({ timeout: 8000 })
  await page.locator("#nickname").fill(nickname)
  await page.locator("#username-submit").click()
  await page.waitForURL(/\/party\//, { timeout: 10_000 })
}

async function advanceToEnd(managerPage: Page, maxClicks = 200): Promise<boolean> {
  for (let i = 0; i < maxClicks; i++) {
    const btn = managerPage.locator("#start-round")
    const appeared = await btn
      .waitFor({ state: "visible", timeout: 90_000 })
      .then(() => true)
      .catch(() => false)

    if (!appeared) {
      return true
    }

    const btnText = (await btn.textContent().catch(() => "") ?? "").trim()
    if (btnText === "Quitter" || btnText === "Exit") {
      return true
    }

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

// ── Tests UI (sans partie réelle) ─────────────────────────────────────────────

test.describe("13a — Mode Soirée — UI sans partie réelle", () => {
  test.skip(!MANAGER_PASSWORD, "Ignoré — MANAGER_PASSWORD requis")
  test.setTimeout(30_000)

  test("le bouton Mode Soirée est présent dans le footer du dashboard", async ({ page }) => {
    await loginManager(page)
    await expect(page.getByText("Mode Soirée")).toBeVisible({ timeout: 5000 })
  })

  test("cliquer sur Mode Soirée affiche le footer soirée avec Démarrer la soirée désactivé", async ({ page }) => {
    await loginManager(page)
    await page.getByText("Mode Soirée").first().click()
    await expect(page.getByText("Démarrer la soirée")).toBeVisible({ timeout: 3000 })
    await expect(page.getByText("Démarrer la soirée")).toBeDisabled()
  })

  test("sélectionner 1 quiz en mode soirée affiche un badge numéroté sur la carte", async ({ page }) => {
    await loginManager(page)
    await page.getByText("Mode Soirée").first().click()

    const cards = page.locator("div[draggable='true']")
    const cardCount = await cards.count()

    if (cardCount === 0) {
      test.skip()
      return
    }

    await cards.first().click()
    // Badge "1" visible sur la carte sélectionnée
    await expect(page.locator("div[draggable='true']").first().locator("text=1")).toBeVisible({ timeout: 3000 })
    // Démarrer toujours désactivé (besoin de 2 quiz min)
    await expect(page.getByText("Démarrer la soirée")).toBeDisabled()
  })

  test("sélectionner 2 quiz active le bouton Démarrer la soirée", async ({ page }) => {
    await loginManager(page)
    await page.getByText("Mode Soirée").first().click()

    const cards = page.locator("div[draggable='true']")
    const cardCount = await cards.count()

    if (cardCount < 2) {
      test.skip()
      return
    }

    await cards.nth(0).click()
    await cards.nth(1).click()
    await expect(page.getByText("Démarrer la soirée")).toBeEnabled({ timeout: 3000 })
  })

  test("les pills des quiz sélectionnés apparaissent dans le footer soirée", async ({ page }) => {
    await loginManager(page)
    await page.getByText("Mode Soirée").first().click()

    const cards = page.locator("div[draggable='true']")
    if (await cards.count() < 2) { test.skip(); return }

    await cards.nth(0).click()
    await cards.nth(1).click()

    // Le footer soirée doit afficher les badges n°1 et n°2
    const footer = page.locator("footer")
    await expect(footer.getByText("1", { exact: true }).first()).toBeVisible({ timeout: 3000 })
    await expect(footer.getByText("2", { exact: true }).first()).toBeVisible({ timeout: 3000 })
  })

  test("désactiver le mode soirée revient au footer normal avec Démarrer la partie", async ({ page }) => {
    await loginManager(page)
    await page.getByText("Mode Soirée").first().click()
    await expect(page.getByText("Démarrer la soirée")).toBeVisible({ timeout: 3000 })

    // Cliquer sur le bouton de désactivation du mode soirée (premier bouton du footer soirée)
    await page.locator("footer button").first().click()
    // Le footer soirée disparaît, le footer normal réapparaît
    await expect(page.getByText("Démarrer la soirée")).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Mode Soirée")).toBeVisible({ timeout: 3000 })
  })

  test("re-cliquer sur une carte sélectionnée la retire de la liste soirée", async ({ page }) => {
    await loginManager(page)
    await page.getByText("Mode Soirée").first().click()

    const cards = page.locator("div[draggable='true']")
    if (await cards.count() < 2) { test.skip(); return }

    await cards.nth(0).click()
    await cards.nth(1).click()
    await expect(page.getByText("Démarrer la soirée")).toBeEnabled({ timeout: 3000 })

    // Re-cliquer le premier quiz → retiré
    await cards.nth(0).click()
    await expect(page.getByText("Démarrer la soirée")).toBeDisabled()
  })
})

// ── Tests avec partie réelle ──────────────────────────────────────────────────

test.describe("13b — Mode Soirée — Flux complet", () => {
  test.skip(!MANAGER_PASSWORD || SKIP_REAL_GAME, "Ignoré — MANAGER_PASSWORD + SKIP_REAL_GAME=false requis")
  test.setTimeout(600_000)

  test("flux soirée 2 quiz : PIN stable entre les quiz, interstitiel visible", async ({ browser }) => {
    const managerCtx = await browser.newContext()
    const player1Ctx = await browser.newContext()
    const player2Ctx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const player1Page = await player1Ctx.newPage()
    const player2Page = await player2Ctx.newPage()

    try {
      await loginManager(managerPage)

      const cards = managerPage.locator("div[draggable='true']")
      if (await cards.count() < 2) { test.skip(); return }

      // Activer mode soirée et sélectionner 2 quiz
      await managerPage.getByText("Mode Soirée").first().click()
      await cards.nth(0).click()
      await cards.nth(1).click()
      await expect(managerPage.getByText("Démarrer la soirée")).toBeEnabled({ timeout: 3000 })

      // Démarrer la soirée
      await managerPage.getByText("Démarrer la soirée").click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""
      expect(pin.length).toBeGreaterThan(0)

      // Deux joueurs rejoignent
      await joinPlayer(player1Page, pin, "Soiree_J1")
      await joinPlayer(player2Page, pin, "Soiree_J2")

      // Manager démarre le quiz 1
      await managerPage.locator("#start-round").click()

      // Avancer tout le quiz 1
      let i = 0
      while (i < 100) {
        const btn = managerPage.locator("#start-round")
        const visible = await btn.waitFor({ state: "visible", timeout: 90_000 }).then(() => true).catch(() => false)
        if (!visible) break

        const txt = (await btn.textContent().catch(() => "") ?? "").trim()
        // Quand l'interstitiel soirée apparaît, on s'arrête avant de cliquer "Quiz suivant"
        const interstitiel = managerPage.getByText("Quiz terminé !")
        if (await interstitiel.isVisible().catch(() => false)) break

        if (!await btn.isEnabled().catch(() => false)) {
          await managerPage.waitForTimeout(500)
          i++
          continue
        }

        await btn.click()
        await managerPage.waitForTimeout(300)
        i++
      }

      // Vérifier l'interstitiel de fin de quiz 1
      await expect(managerPage.getByText("Quiz terminé !")).toBeVisible({ timeout: 30_000 })
      await expect(managerPage.getByText("Classement soirée")).toBeVisible({ timeout: 5000 })

      // Le joueur voit aussi l'interstitiel
      await expect(player1Page.getByText("Quiz terminé !")).toBeVisible({ timeout: 15_000 })

      // PIN doit être le même (on vérifie qu'on peut naviguer vers le PIN avec le même code)
      const pinAfterQuiz1 = (await managerPage.locator("#game-pin").textContent().catch(() => ""))?.trim()
      // Si #game-pin n'est pas visible sur l'interstitiel, c'est normal — on teste après
      // que le SHOW_ROOM se réaffiche avec le même PIN

      // Cliquer Quiz suivant (ou attendre le countdown de 10s)
      const nextBtn = managerPage.getByText("Quiz suivant")
      if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nextBtn.click()
      }

      // Après Quiz suivant → retour SHOW_ROOM avec même PIN
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 15_000 })
      const pinAfterPause = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""
      expect(pinAfterPause).toBe(pin) // PIN IDENTIQUE

      // Les joueurs existants voient l'écran d'attente
      await expect(player1Page.getByText("Soiree_J1", { exact: true })).toBeVisible({ timeout: 10_000 })

      // Démarrer quiz 2
      await managerPage.locator("footer button").last().click()

      // Avancer quiz 2 jusqu'à la fin
      const ended = await advanceToEnd(managerPage)
      expect(ended).toBe(true)

      // Podium final
      await expect(managerPage.getByText("Soiree_J1").or(managerPage.getByText("Soiree_J2"))).toBeVisible({ timeout: 20_000 })
    } finally {
      await managerCtx.close()
      await player1Ctx.close()
      await player2Ctx.close()
    }
  })

  test("nouveau joueur peut rejoindre pendant la pause inter-quiz avec le même PIN", async ({ browser }) => {
    const managerCtx = await browser.newContext()
    const player1Ctx = await browser.newContext()
    const newPlayerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const player1Page = await player1Ctx.newPage()
    const newPlayerPage = await newPlayerCtx.newPage()

    try {
      await loginManager(managerPage)

      const cards = managerPage.locator("div[draggable='true']")
      if (await cards.count() < 2) { test.skip(); return }

      await managerPage.getByText("Mode Soirée").first().click()
      await cards.nth(0).click()
      await cards.nth(1).click()
      await managerPage.getByText("Démarrer la soirée").click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

      await joinPlayer(player1Page, pin, "Ancien_J1")

      // Avancer quiz 1 jusqu'à l'interstitiel
      await managerPage.locator("#start-round").click()
      await expect(managerPage.getByText("Quiz terminé !")).toBeVisible({ timeout: 180_000 })

      // Cliquer Quiz suivant
      const nextBtn = managerPage.getByText("Quiz suivant")
      if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextBtn.click()
      }

      // SHOW_ROOM ré-affiché avec même PIN
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 15_000 })

      // Nouveau joueur rejoint pendant la pause
      await joinPlayer(newPlayerPage, pin, "Nouveau_J2")
      await expect(newPlayerPage.getByText("Nouveau_J2", { exact: true })).toBeVisible({ timeout: 5000 })

      // L'ancien joueur est toujours connecté
      await expect(player1Page.getByText("Ancien_J1", { exact: true })).toBeVisible({ timeout: 5000 })
    } finally {
      await managerCtx.close()
      await player1Ctx.close()
      await newPlayerCtx.close()
    }
  })
})
