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

async function startSoireeGame(managerPage: Page, quizCount = 2): Promise<string> {
  const cards = managerPage.locator("div[draggable='true']")
  await managerPage.locator("[title*='soirée'], [title*='Soirée']").first().click()

  for (let i = 0; i < quizCount; i++) {
    await cards.nth(i).click()
  }

  await managerPage.getByText("Démarrer la soirée").click()
  await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })

  return (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""
}

async function startSingleGame(managerPage: Page): Promise<string> {
  const cards = managerPage.locator("div[draggable='true']")
  await cards.first().click()
  await managerPage.locator("footer button").last().click()
  await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })

  return (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""
}

async function clickStartRound(managerPage: Page) {
  const btn = managerPage.locator("#start-round")
  await btn.waitFor({ state: "visible", timeout: 30_000 })
  await btn.click()
  await managerPage.waitForTimeout(300)
}

// Joue un round complet : démarre, fait répondre les joueurs, attend la fin du timer
async function playRound(
  managerPage: Page,
  answerers: Page[],
): Promise<void> {
  // 1. Cliquer #start-round jusqu'à ce que le timer apparaisse (phase SELECT_ANSWER)
  //    Le manager passe par SHOW_ROOM → SHOW_QUESTION → SELECT_ANSWER en cliquant
  for (let i = 0; i < 5; i++) {
    if (await managerPage.locator("#timer").isVisible({ timeout: 500 }).catch(() => false)) {
      break
    }
    const startBtn = managerPage.locator("#start-round")
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click()
      await managerPage.waitForTimeout(500)
    }
  }

  // 2. Attendre confirmation timer visible
  await managerPage.locator("#timer").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined)

  // 3. Faire répondre les joueurs (clic sur la première réponse disponible)
  for (const playerPage of answerers) {
    const answer = playerPage.locator("button").filter({ hasText: /^[A-D]|Vrai|Faux|^\w/ }).first()
    if (await answer.isVisible({ timeout: 2000 }).catch(() => false)) {
      await answer.click().catch(() => undefined)
    }
  }

  // 4. Attendre la fin du round (timer disparaît) — 60s max (question 45s + buffer)
  await managerPage.locator("#timer").waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined)
}

// Avance entre rounds (résultat → leaderboard → prochaine question) jusqu'à apparition du timer
async function advanceToNextRound(managerPage: Page, maxClicks = 5): Promise<void> {
  for (let i = 0; i < maxClicks; i++) {
    const btn = managerPage.locator("#start-round")
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false)
    if (!visible) {
      return
    }
    const txt = (await btn.textContent().catch(() => "") ?? "").trim()
    if (txt === "Quitter" || txt === "Exit") {
      return
    }
    await btn.click()
    await managerPage.waitForTimeout(500)
    // Si le timer est apparu, le round suivant a commencé
    if (await managerPage.locator("#timer").isVisible({ timeout: 1000 }).catch(() => false)) {
      return
    }
  }
}

// ── Tests UI power-ups (sans partie réelle) ───────────────────────────────────

test.describe("14a — Power-ups — UI dashboard", () => {
  test.skip(!MANAGER_PASSWORD, "Ignoré — MANAGER_PASSWORD requis")
  test.setTimeout(30_000)

  test("le mode soirée affiche le footer soirée sans power-up bar (pas en jeu)", async ({ page }) => {
    await loginManager(page)
    await page.locator("[title*='soirée'], [title*='Soirée']").first().click()
    // La barre power-up est uniquement visible côté joueur pendant une partie
    // On vérifie qu'elle n'apparaît pas sur le dashboard manager
    await expect(page.locator("[title='Double Points']")).not.toBeVisible()
    await expect(page.locator("[title='Bouclier']")).not.toBeVisible()
  })
})

// ── Tests avec partie réelle (soirée avec 2 joueurs minimum) ──────────────────

test.describe("14b — Power-ups — Flux in-game", () => {
  test.skip(!MANAGER_PASSWORD || SKIP_REAL_GAME, "Ignoré — MANAGER_PASSWORD + SKIP_REAL_GAME=false requis")
  test.setTimeout(600_000)

  test("la power-up bar n'est pas visible côté host en soirée", async ({ browser }) => {
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

      const pin = await startSoireeGame(managerPage)
      await joinPlayer(player1Page, pin, "PU_Host_J1")
      await joinPlayer(player2Page, pin, "PU_Host_J2")

      // Le host ne doit voir aucun power-up button (peu importe le type)
      const hostPowerUps = managerPage.locator("button[title*='Bouclier'], button[title*='Gel'], button[title*='Filet'], button[title*='Embrouille'], button[title*='Étincelle'], button[title*='Double'], button[title*='Triple'], button[title*='Bombe'], button[title*='Vol'], button[title*='Sniper']")
      await expect(hostPowerUps).toHaveCount(0)
    } finally {
      await managerCtx.close()
      await player1Ctx.close()
      await player2Ctx.close()
    }
  })

  test("chaque joueur reçoit un power-up commun à l'arrivée (cadeau de bienvenue)", async ({ browser }) => {
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

      const pin = await startSoireeGame(managerPage)
      await joinPlayer(player1Page, pin, "PU_Gift_J1")
      await joinPlayer(player2Page, pin, "PU_Gift_J2")

      // Chaque joueur doit avoir au moins 1 power-up commun visible dans sa barre
      const commonTitles = "button[title*='Bouclier'], button[title*='Gel'], button[title*='Filet'], button[title*='Embrouille'], button[title*='Étincelle']"
      await expect(player1Page.locator(commonTitles).first()).toBeVisible({ timeout: 10_000 })
      await expect(player2Page.locator(commonTitles).first()).toBeVisible({ timeout: 10_000 })
    } finally {
      await managerCtx.close()
      await player1Ctx.close()
      await player2Ctx.close()
    }
  })

  test("un joueur peut activer son power-up de bienvenue via le drawer", async ({ browser }) => {
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

      const pin = await startSoireeGame(managerPage)
      await joinPlayer(player1Page, pin, "PU_Act_J1")
      await joinPlayer(player2Page, pin, "PU_Act_J2")

      // Power-up commun reçu à l'arrivée
      const puBtn = player1Page.locator("button[title*='Bouclier'], button[title*='Gel'], button[title*='Filet'], button[title*='Embrouille'], button[title*='Étincelle']").first()
      await expect(puBtn).toBeVisible({ timeout: 10_000 })

      const puTitle = await puBtn.getAttribute("title")
      console.log(`Power-up J1 : ${puTitle}`)

      await puBtn.click()
      await expect(player1Page.getByText("Utiliser").first()).toBeVisible({ timeout: 5000 })
      await expect(player1Page.getByText("Annuler").first()).toBeVisible({ timeout: 3000 })

      // Si Embrouille (Scramble), nécessite une cible — sélectionner J2
      if (puTitle?.includes("Embrouille")) {
        await player1Page.locator("button").filter({ hasText: "PU_Act_J2" }).first().click()
      }

      await expect(player1Page.getByText("Utiliser").first()).toBeEnabled({ timeout: 3000 })
      await player1Page.getByText("Utiliser").first().click()

      // Drawer se ferme et power-up consommé
      await expect(player1Page.getByText("Utiliser")).not.toBeVisible({ timeout: 5000 })
      await expect(puBtn).not.toBeVisible({ timeout: 5000 })
    } finally {
      await managerCtx.close()
      await player1Ctx.close()
      await player2Ctx.close()
    }
  })

  test("le manager voit un toast SEULEMENT pour les power-ups non-self", async ({ browser }) => {
    // Règle UX : les power-ups self (SHIELD, SAFETY_NET, SPARK) restent privés
    // au joueur et n'apparaissent pas sur l'écran manager. Seuls les power-ups
    // qui affectent un ou plusieurs adversaires sont annoncés au manager.
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

      const pin = await startSoireeGame(managerPage)
      await joinPlayer(player1Page, pin, "PU_Toast_J1")
      await joinPlayer(player2Page, pin, "PU_Toast_J2")

      const puBtn = player1Page.locator("button[title*='Bouclier'], button[title*='Gel'], button[title*='Filet'], button[title*='Embrouille'], button[title*='Étincelle']").first()
      await expect(puBtn).toBeVisible({ timeout: 10_000 })

      const puTitle = await puBtn.getAttribute("title")
      const isNonSelf = puTitle?.includes("Gel") || puTitle?.includes("Embrouille")

      await puBtn.click()
      await expect(player1Page.getByText("Utiliser").first()).toBeVisible({ timeout: 5000 })

      if (puTitle?.includes("Embrouille")) {
        await player1Page.locator("button").filter({ hasText: "PU_Toast_J2" }).first().click()
      }

      await player1Page.getByText("Utiliser").first().click()
      await expect(player1Page.getByText("Utiliser")).not.toBeVisible({ timeout: 5000 })

      // Le toast PowerUpEffectToast contient "<username> → <powerup>" (flèche distinctive)
      const toastLocator = managerPage.getByText(/PU_Toast_J1\s*→/)

      if (isNonSelf) {
        // Power-up qui affecte les autres → manager voit le toast
        await expect(toastLocator.first()).toBeVisible({ timeout: 5000 })
      } else {
        // Power-up self → manager NE doit PAS voir de toast (avec flèche)
        await managerPage.waitForTimeout(2000)
        await expect(toastLocator).toHaveCount(0)
      }
    } finally {
      await managerCtx.close()
      await player1Ctx.close()
      await player2Ctx.close()
    }
  })
})

// ── Tests de régression — quiz unique (s'assurer que rien n'est cassé) ────────

test.describe("14c — Régression — quiz unique sans power-ups", () => {
  test.skip(!MANAGER_PASSWORD || SKIP_REAL_GAME, "Ignoré — MANAGER_PASSWORD + SKIP_REAL_GAME=false requis")
  test.setTimeout(300_000)

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

      const txt = (await btn.textContent().catch(() => "") ?? "").trim()
      if (txt === "Quitter" || txt === "Exit") {
        return true
      }

      if (!await btn.isEnabled().catch(() => false)) {
        await managerPage.waitForTimeout(500)
        continue
      }

      await btn.click()
      await managerPage.waitForTimeout(300)
    }

    return false
  }

  test("quiz unique : le flux existant fonctionne toujours (pas de power-up bar côté host)", async ({ browser }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      await loginManager(managerPage)

      const cards = managerPage.locator("div[draggable='true']")
      if (!await cards.first().isVisible({ timeout: 5000 }).catch(() => false)) { test.skip(); return }

      // Sélectionner et lancer quiz classique (PAS mode soirée)
      await cards.first().click()
      await managerPage.locator("footer button").last().click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

      await joinPlayer(playerPage, pin, "Regress_J1")

      // Pas de mode soirée footer visible (on est en mode quiz unique)
      await expect(managerPage.getByText("Démarrer la soirée")).not.toBeVisible()

      // Avancer jusqu'à la fin (le flux complet doit fonctionner sans erreur)
      const ended = await advanceToEnd(managerPage)
      expect(ended).toBe(true)

      // Pas de power-up bar côté host pendant tout le flux
      await expect(managerPage.locator("[title='Double Points']")).not.toBeVisible()
      await expect(managerPage.locator("[title='Bouclier']")).not.toBeVisible()

      // Podium visible
      await expect(managerPage.getByText("Regress_J1")).toBeVisible({ timeout: 20_000 })

      // Joueur voit le bouton Quitter
      await expect(playerPage.locator('button:has-text("Quitter")')).toBeVisible({ timeout: 25_000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("quiz unique : le bouton Mode Soirée ne perturbe pas la sélection classique", async ({ page }) => {
    await loginManager(page)

    const cards = page.locator("div[draggable='true']")
    if (!await cards.first().isVisible({ timeout: 5000 }).catch(() => false)) { test.skip(); return }

    // Sélectionner un quiz classiquement
    await cards.first().click()
    await expect(page.getByText("Démarrer la partie")).toBeEnabled({ timeout: 3000 })

    // Cliquer Mode Soirée → la sélection classique doit être réinitialisée
    await page.locator("[title*='soirée'], [title*='Soirée']").first().click()
    await expect(page.getByText("Démarrer la soirée")).toBeVisible({ timeout: 3000 })

    // Désactiver le mode soirée → retour au footer classique (premier bouton du footer soirée)
    await page.locator("footer button").first().click()
    // Vérifier que le footer soirée a disparu et que le footer normal est revenu
    await expect(page.getByText("Démarrer la soirée")).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator("[title*='soirée'], [title*='Soirée']").first()).toBeVisible({ timeout: 3000 })
    await expect(page.getByText("Démarrer la soirée")).not.toBeVisible()
  })

  test("quiz unique avec power-ups activés : les joueurs reçoivent un cadeau de bienvenue", async ({ browser }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      await loginManager(managerPage)

      const cards = managerPage.locator("div[draggable='true']")
      if (!await cards.first().isVisible({ timeout: 5000 }).catch(() => false)) { test.skip(); return }

      // Sélectionner un quiz
      await cards.first().click()

      // Activer les power-ups via le checkbox du footer classique
      const powerUpsCheckbox = managerPage.locator("footer input[type='checkbox']")
      await expect(powerUpsCheckbox).toBeVisible({ timeout: 5000 })
      await powerUpsCheckbox.check()

      // Démarrer la partie (bouton "Démarrer la partie")
      await managerPage.locator("footer button").last().click()
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 10_000 })
      const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""

      // Joueur rejoint
      await joinPlayer(playerPage, pin, "SinglePU_J1")

      // Le joueur doit recevoir un power-up de bienvenue
      const commonTitles = "button[title*='Bouclier'], button[title*='Gel'], button[title*='Filet'], button[title*='Embrouille'], button[title*='Étincelle']"
      await expect(playerPage.locator(commonTitles).first()).toBeVisible({ timeout: 10_000 })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })
})
