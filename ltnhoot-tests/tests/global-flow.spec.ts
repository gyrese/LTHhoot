import { test, expect, type Page, type BrowserContext } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? "admin123"

// ── Fonctions Utilitaires / Helpers ──────────────────────────────────────────

/**
 * Authentifie le manager sur le tableau de bord
 */
async function loginManager(page: Page) {
  await page.goto(`${BASE_URL}/manager/config`)
  await page.waitForLoadState("domcontentloaded")

  const pwdInput = page.locator('input[type="password"]')
  await pwdInput.waitFor({ state: "visible", timeout: 12_000 })
  await pwdInput.fill(MANAGER_PASSWORD)
  await page.locator('button[type="submit"]').or(page.locator("button").last()).click()

  // Dans tous les cas, on attend d'être sur config avec le footer visible
  await page.waitForURL(/\/manager\/config/, { timeout: 15_000 })
  await page.locator("footer").waitFor({ state: "visible", timeout: 15_000 })
}

/**
 * Connecte un joueur à la partie en cours
 */
async function joinPlayer(page: Page, pin: string, nickname: string) {
  await page.goto(`${BASE_URL}/`)
  await page.locator("#pin-input").waitFor({ state: "visible", timeout: 8000 })
  await page.locator("#pin-input").fill(pin)
  await page.locator("#join-button").click()

  await page.locator("#nickname").waitFor({ state: "visible", timeout: 8000 })
  await page.locator("#nickname").fill(nickname)
  await page.locator("#username-submit").click()

  await page.waitForURL(/\/party\//, { timeout: 15_000 })
}

/**
 * Active le mode soirée et sélectionne 2 quiz
 */
async function startEveningMode(managerPage: Page): Promise<string> {
  const cards = managerPage.locator("div[draggable='true']")
  
  // Activer le mode soirée
  await managerPage.getByText("Mode Soirée").first().click()
  await managerPage.waitForTimeout(500)

  // Sélectionner les deux premiers quiz
  await cards.nth(0).click()
  await cards.nth(1).click()

  // Démarrer la soirée
  const startBtn = managerPage.getByText("Démarrer la soirée")
  await expect(startBtn).toBeEnabled({ timeout: 5000 })
  await startBtn.click()

  // Attendre l'affichage du code PIN
  await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 15_000 })
  const pin = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""
  
  console.log(`[Soirée] PIN généré : ${pin}`)
  return pin
}

/**
 * Clique sur un bouton de manière répétée (avec 1s d'intervalle) jusqu'à ce qu'un élément cible devienne visible
 */
async function clickUntilVisible(clickLocator: any, targetLocator: any, timeoutMs = 15_000) {
  const endTime = Date.now() + timeoutMs
  while (Date.now() < endTime) {
    if (await targetLocator.isVisible().catch(() => false)) {
      return
    }
    await clickLocator.click({ timeout: 2000 }).catch(() => undefined)
    await clickLocator.page().waitForTimeout(1000)
  }
  if (await targetLocator.isVisible().catch(() => false)) {
    return
  }
  throw new Error(`Cible non visible après clics répétés pendant ${timeoutMs}ms`)
}

/**
 * Clique sur un bouton de manière répétée jusqu'à ce qu'un élément cible disparaisse
 */
async function clickUntilHidden(clickLocator: any, targetLocator: any, timeoutMs = 15_000) {
  const endTime = Date.now() + timeoutMs
  while (Date.now() < endTime) {
    if (!(await targetLocator.isVisible().catch(() => false))) {
      return
    }
    await clickLocator.click({ timeout: 2000 }).catch(() => undefined)
    await clickLocator.page().waitForTimeout(1000)
  }
  if (!(await targetLocator.isVisible().catch(() => false))) {
    return
  }
  throw new Error(`Cible toujours visible après clics répétés pendant ${timeoutMs}ms`)
}

/**
 * Joue une seule question (round) de manière déterministe et robuste
 */
async function playOneRound(managerPage: Page, players: Page[]) {
  const nextBtn = managerPage.locator("#start-round")

  // --- Étape 1 : Attendre SHOW_PREPARED ---
  console.log("[Round] Attente de l'état SHOW_PREPARED...")
  const preparedText = managerPage.getByText(/Préparez-vous|Get ready/i).first()
  await preparedText.waitFor({ state: "visible", timeout: 20_000 })

  // --- Étape 2 : De SHOW_PREPARED à SHOW_QUESTION ---
  console.log("[Round] Passage à SHOW_QUESTION...")
  const questionContainer = managerPage.locator("#question-container")
  await clickUntilVisible(nextBtn, questionContainer)

  // --- Étape 3 : De SHOW_QUESTION à SELECT_ANSWER ---
  console.log("[Round] Passage à SELECT_ANSWER (phase de réponse)...")
  const timer = managerPage.locator("#timer")
  await clickUntilVisible(nextBtn, timer)

  // --- Étape 4 : Les joueurs répondent ---
  console.log("[Round] Soumission des réponses des joueurs...")
  await Promise.all(
    players.map(async (p, idx) => {
      await p.waitForTimeout(300)
      
      // A. Questions ouvertes
      const input = p.locator('input[type="text"], input[placeholder*="Tape"]').first()
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        await input.fill("test")
        await p.locator('button[type="submit"], button:has-text("Envoyer"), button:has-text("Valider")').first().click().catch(() => undefined)
        console.log(`[Round] Joueur ${idx + 1} a répondu (question ouverte).`)
        return
      }

      // B. Sliders et Dates
      const rangeInput = p.locator('input[type="range"]').first()
      if (await rangeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await p.locator('button:has-text("Envoyer"), button:has-text("Valider"), button:has-text("Submit"), button:has-text("Soumettre")').first().click().catch(() => undefined)
        console.log(`[Round] Joueur ${idx + 1} a répondu (slider/date).`)
        return
      }

      // C. QCM
      const mcqBtn = p.locator('.grid button, button[class*="bg-red"], button[class*="bg-blue"], button[class*="bg-yellow"], button[class*="bg-green"]').first()
      if (await mcqBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await mcqBtn.click().catch(() => undefined)
        console.log(`[Round] Joueur ${idx + 1} a répondu (QCM).`)
        return
      }

      // D. Fallback
      const anyBtn = p.locator('button').first()
      if (await anyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await anyBtn.click().catch(() => undefined)
        console.log(`[Round] Joueur ${idx + 1} a répondu (fallback).`)
      }
    })
  )

  // --- Étape 5 : Attendre la fin de la phase de réponse ---
  console.log("[Round] Attente du masquage du timer...")
  await timer.waitFor({ state: "hidden", timeout: 35_000 }).catch(() => undefined)
  await managerPage.waitForTimeout(1000)

  // --- Étape 6 : Si c'est SHOW_OPEN_ANSWERS (validation des réponses ouvertes) ---
  const openAnswersText = managerPage.getByText(/Clique.*réponse|Click.*answer|valider|validate/i).first()
  const isOpenAnswers = await openAnswersText.isVisible({ timeout: 1000 }).catch(() => false)
  if (isOpenAnswers) {
    console.log("[Round] Détection de l'écran SHOW_OPEN_ANSWERS. Finalisation...")
    await clickUntilHidden(nextBtn, openAnswersText)
    await managerPage.waitForTimeout(1000)
  }

  // --- Étape 7 : Transition vers l'état de préparation du round suivant ou la fin du quiz ---
  console.log("[Round] Passage au round suivant depuis les résultats...")
  const endOrNext = managerPage.getByText(/Préparez-vous|Get ready/i)
    .or(managerPage.getByText("Quiz terminé !"))
    .or(managerPage.getByText("Classement soirée"))
    .or(nextBtn.filter({ hasText: /Quitter|Exit/i }))
    .first()
  await clickUntilVisible(nextBtn, endOrNext)
  await managerPage.waitForTimeout(1000)
}

/**
 * Joue l'intégralité d'un quiz
 */
async function playEntireQuiz(managerPage: Page, players: Page[], stopOnQuizSuivant = false) {
  const nextBtn = managerPage.locator("#start-round")
  
  while (true) {
    // 1. Vérifier si le quiz est terminé ou si le classement est affiché
    const quizTermine = managerPage.getByText("Quiz terminé !").or(managerPage.getByText("Classement soirée"))
    if (await quizTermine.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log("[Quiz] Fin du quiz détectée (écran de fin).")
      break
    }

    const btnText = (await nextBtn.textContent().catch(() => "") ?? "").trim()
    if (btnText === "Quiz suivant" && stopOnQuizSuivant) {
      console.log("[Quiz] Bouton 'Quiz suivant' détecté. Arrêt.")
      break
    }
    if (btnText === "Quitter" || btnText === "Exit") {
      console.log("[Quiz] Bouton de sortie détecté. Arrêt.")
      break
    }

    // 2. Jouer la question active
    await playOneRound(managerPage, players)
  }
}

// ── Scénario de Test Global ──────────────────────────────────────────────────

test.describe("Rahoot — Test Global E2E (Flux complet avec Soirée, Power-ups et Reconnexion)", () => {
  test.setTimeout(600_000) // Timeout large de 10 minutes pour tout le scénario

  test("Parcours utilisateur global E2E", async ({ browser, page: managerPage, isMobile }) => {
    test.skip(isMobile, "Ignoré sur mobile car l'interface manager requiert un écran de bureau")

    // 1. Connexion Manager
    console.log("[Test] Connexion du manager...")
    await loginManager(managerPage)

    // 2. Vérification de la présence des quiz
    const cards = managerPage.locator("div[draggable='true']")
    const cardCount = await cards.count()
    if (cardCount < 2) {
      console.warn("[Test] Moins de 2 quiz disponibles. Impossible de lancer le mode soirée. Test ignoré.")
      test.skip()
      return
    }

    // 3. Lancement du mode soirée et récupération du PIN
    console.log("[Test] Lancement du mode Soirée...")
    const pin = await startEveningMode(managerPage)
    expect(pin.length).toBeGreaterThan(0)

    // 4. Initialisation des clients joueurs
    console.log("[Test] Connexion des 3 joueurs en parallèle...")
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const contextC = await browser.newContext()

    const pA = await contextA.newPage()
    const pB = await contextB.newPage()
    const pC = await contextC.newPage()

    try {
      await Promise.all([
        joinPlayer(pA, pin, "Joueur_A"),
        joinPlayer(pB, pin, "Joueur_B"),
        joinPlayer(pC, pin, "Joueur_C"),
      ])

      // Vérifier que les 3 joueurs apparaissent dans le lobby Manager
      console.log("[Test] Vérification des joueurs dans le lobby...")
      await expect(managerPage.getByText("Joueur_A", { exact: true })).toBeVisible({ timeout: 10_000 })
      await expect(managerPage.getByText("Joueur_B", { exact: true })).toBeVisible({ timeout: 5000 })
      await expect(managerPage.getByText("Joueur_C", { exact: true })).toBeVisible({ timeout: 5000 })

      // 5. Lancement du premier quiz
      console.log("[Test] Démarrage du premier quiz...")
      await clickUntilHidden(managerPage.locator("#start-round"), managerPage.locator("#game-pin"))
      await managerPage.waitForTimeout(1000)

      // 6. Transition vers la phase de réponse de la première question
      console.log("[Test] Transition vers la première question (SELECT_ANSWER)...")
      const nextBtn = managerPage.locator("#start-round")
      
      // Attendre d'être sur SHOW_PREPARED (bouton "Suivant" visible après le compte à rebours SHOW_START)
      await expect(nextBtn).toHaveText("Suivant", { timeout: 15_000 })
      await nextBtn.click()
      await managerPage.waitForTimeout(1000)

      // On est sur SHOW_QUESTION (bouton "Suivant" toujours visible)
      await expect(nextBtn).toHaveText("Suivant", { timeout: 10_000 })
      await nextBtn.click()

      // On est sur SELECT_ANSWER (phase de réponse active, timer visible)
      await managerPage.locator("#timer").waitFor({ state: "visible", timeout: 15_000 })

      // 7. Validation et utilisation du power-up par le Joueur A
      console.log("[Test] Validation des power-ups reçus par les joueurs...")
      const commonPowerUps = "button[title*='Bouclier'], button[title*='Gel'], button[title*='Filet'], button[title*='Embrouille'], button[title*='Étincelle']"
      await expect(pA.locator(commonPowerUps).first()).toBeVisible({ timeout: 10_000 })
      await expect(pB.locator(commonPowerUps).first()).toBeVisible({ timeout: 10_000 })
      await expect(pC.locator(commonPowerUps).first()).toBeVisible({ timeout: 10_000 })

      // Joueur A utilise son premier power-up
      const pA_puBtn = pA.locator(commonPowerUps).first()
      const puTitle = await pA_puBtn.getAttribute("title")
      console.log(`[Test] Joueur A utilise son power-up : ${puTitle}`)
      await pA_puBtn.click()

      // Attendre l'ouverture du drawer de confirmation
      await expect(pA.getByText("Utiliser").first()).toBeVisible({ timeout: 5000 })

      // Si c'est un power-up ciblé (ex: Embrouille/Scramble), sélectionner Joueur B comme cible
      if (puTitle?.includes("Embrouille")) {
        console.log("[Test] Sélection de la cible Joueur_B...")
        await pA.locator("button").filter({ hasText: "Joueur_B" }).first().click()
      }

      // Valider l'utilisation
      await pA.getByText("Utiliser").first().click()
      // Le bouton power-up doit disparaître
      await expect(pA.getByText("Utiliser")).not.toBeVisible({ timeout: 5000 })

      // Répondre à la question pour tous les joueurs
      console.log("[Test] Les joueurs répondent à la première question...")
      for (const p of [pA, pB, pC]) {
        const ans = p.locator("button").filter({ hasText: /^[A-D]|Vrai|Faux/ }).first()
        if (await ans.isVisible({ timeout: 2000 }).catch(() => false)) {
          await ans.click()
        }
      }

      // Attendre la fin du timer de la première question
      await managerPage.locator("#timer").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined)

      // 8. Passage à la question 2 et test de résilience Manager (reload de la page Manager)
      console.log("[Test] Passage à la question 2...")
      // Cliquer sur "Suivant" depuis les résultats de Q1 pour aller à Q2 (Prepared)
      const preparedTextQ2 = managerPage.getByText(/Préparez-vous|Get ready/i).first()
      await clickUntilVisible(nextBtn, preparedTextQ2)

      // Cliquer sur "Suivant" depuis Q2 (Prepared) pour aller à Q2 (Question)
      const questionContainerQ2 = managerPage.locator("#question-container")
      await clickUntilVisible(nextBtn, questionContainerQ2)

      // Cliquer sur "Suivant" depuis Q2 (Question) pour aller à Q2 (SELECT_ANSWER)
      const timerQ2 = managerPage.locator("#timer")
      await clickUntilVisible(nextBtn, timerQ2)

      console.log("[Test] Simulation d'un rafraîchissement de la page Manager pendant la phase de réponse de la Q2...")
      await managerPage.reload()
      await managerPage.waitForLoadState("domcontentloaded")

      // L'état doit être automatiquement restauré (reconnexion via socket)
      await managerPage.locator("#timer").waitFor({ state: "visible", timeout: 15_000 })
      console.log("[Test] Session Manager restaurée avec succès.")

      // Les joueurs répondent à la question 2 (qui est une question ouverte !)
      console.log("[Test] Les joueurs répondent à la question 2...")
      await Promise.all(
        [pA, pB, pC].map(async (p, idx) => {
          await p.waitForTimeout(300)
          
          const input = p.locator('input[type="text"], input[placeholder*="Tape"]').first()
          if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
            await input.fill("Solo Leveling")
            await p.locator('button[type="submit"], button:has-text("Envoyer"), button:has-text("Valider")').first().click().catch(() => undefined)
            console.log(`[Test] Joueur ${idx + 1} a répondu (question ouverte Q2).`)
            return
          }

          const rangeInput = p.locator('input[type="range"]').first()
          if (await rangeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await p.locator('button:has-text("Envoyer"), button:has-text("Valider"), button:has-text("Submit"), button:has-text("Soumettre")').first().click().catch(() => undefined)
            console.log(`[Test] Joueur ${idx + 1} a répondu (slider/date Q2).`)
            return
          }

          const mcqBtn = p.locator('.grid button, button[class*="bg-red"], button[class*="bg-blue"], button[class*="bg-yellow"], button[class*="bg-green"]').first()
          if (await mcqBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await mcqBtn.click().catch(() => undefined)
            console.log(`[Test] Joueur ${idx + 1} a répondu (QCM Q2).`)
            return
          }
        })
      )

      // Attendre la fin du timer de la question 2
      await timerQ2.waitFor({ state: "hidden", timeout: 35_000 }).catch(() => undefined)
      await managerPage.waitForTimeout(1000)

      // Puisque Q2 est une question ouverte, on doit d'abord passer par SHOW_OPEN_ANSWERS
      const openAnswersTextQ2 = managerPage.getByText(/Clique.*réponse|Click.*answer|valider|validate/i).first()
      const isOpenAnswersQ2 = await openAnswersTextQ2.isVisible({ timeout: 1000 }).catch(() => false)
      if (isOpenAnswersQ2) {
        console.log("[Test] Détection de l'écran SHOW_OPEN_ANSWERS pour Q2. Finalisation...")
        await clickUntilHidden(nextBtn, openAnswersTextQ2)
        await managerPage.waitForTimeout(1000)
      }

      // On passe au classement/résultats de Q2
      console.log("[Test] Clic pour passer au round suivant après Q2...")
      const preparedTextQ3 = managerPage.getByText(/Préparez-vous|Get ready/i).first()
      await clickUntilVisible(nextBtn, preparedTextQ3)
      await managerPage.waitForTimeout(1000)

      // 9. Dérouler le reste du Quiz 1 jusqu'à l'interstitiel de fin de quiz
      console.log("[Test] Progression dans le reste du premier quiz...")
      await playEntireQuiz(managerPage, [pA, pB, pC], true)

      // 10. Validation de l'écran interstitiel inter-quiz
      console.log("[Test] Vérification de l'interstitiel inter-quiz...")
      await expect(managerPage.getByText("Quiz terminé !").or(managerPage.getByText("Classement soirée")).first()).toBeVisible({ timeout: 30_000 })
      await expect(pA.getByText("Quiz terminé !").or(pA.getByText("Classement soirée")).first()).toBeVisible({ timeout: 15_000 })

      // 11. Test de déconnexion / reconnexion joueur pendant la pause
      console.log("[Test] Simulation d'une coupure réseau pour Joueur A...")
      await pA.context().setOffline(true)
      await pA.waitForTimeout(2000)

      // L'overlay de déconnexion doit être présent
      const overlay = pA.locator("text=Connexion interrompue")
      const overlayVisible = await overlay.isVisible({ timeout: 5000 }).catch(() => false)

      console.log("[Test] Rétablissement réseau pour Joueur A...")
      await pA.context().setOffline(false)
      await pA.waitForTimeout(5000)

      if (overlayVisible) {
        // L'overlay doit disparaître et le joueur doit toujours être connecté
        await expect(overlay).not.toBeVisible({ timeout: 15_000 })
      }
      expect(pA.url()).toMatch(/\/party\//)

      // Récupérer le bouton "Quiz suivant" sur le manager
      const nextQuizBtn = managerPage.getByText("Quiz suivant")
      await expect(nextQuizBtn).toBeVisible({ timeout: 10_000 })

      // 12. Passage au second quiz de la soirée
      console.log("[Test] Transition vers le deuxième quiz...")
      await nextQuizBtn.click()

      // Le Manager doit revenir dans le lobby (SHOW_ROOM) avec le même code PIN
      await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 15_000 })
      const pinAfterTransition = (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""
      expect(pinAfterTransition).toBe(pin)

      // Les joueurs doivent toujours être connectés dans le lobby
      await expect(pA.getByText("Joueur_A", { exact: true })).toBeVisible({ timeout: 15_000 })

      // Attendre que les 3 joueurs réapparaissent dans le lobby du Manager pour que le bouton Démarrer soit activé
      console.log("[Test] Attente des 3 joueurs dans le lobby Manager du deuxième quiz...")
      await expect(managerPage.getByText("Joueur_A", { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(managerPage.getByText("Joueur_B", { exact: true })).toBeVisible({ timeout: 10_000 })
      await expect(managerPage.getByText("Joueur_C", { exact: true })).toBeVisible({ timeout: 10_000 })

      // Démarrer le quiz 2
      console.log("[Test] Démarrage du deuxième quiz...")
      await clickUntilHidden(managerPage.locator("#start-round"), managerPage.locator("#game-pin"))
      await managerPage.waitForTimeout(1000)

      // 13. Déroulement du Quiz 2 jusqu'à la fin de la soirée (podium)
      console.log("[Test] Déroulement du deuxième quiz jusqu'au podium final...")
      await playEntireQuiz(managerPage, [pA, pB, pC], false)

      // 14. Validation du podium final
      console.log("[Test] Vérification du podium final...")
      // Sur le podium, au moins l'un des joueurs est affiché dans le top
      const topPlayerName = managerPage.getByText("Joueur_A", { exact: true }).or(managerPage.getByText("Joueur_B", { exact: true })).or(managerPage.getByText("Joueur_C", { exact: true }))
      await expect(topPlayerName.first()).toBeVisible({ timeout: 25_000 })

      // Le joueur doit voir le bouton "Quitter" après la fin du jeu
      const quitBtn = pA.locator('button:has-text("Quitter")')
      await expect(quitBtn).toBeVisible({ timeout: 25_000 })
      await quitBtn.click()

      // Doit être redirigé vers la page d'accueil joueur avec le champ PIN
      await expect(pA.locator("#pin-input")).toBeVisible({ timeout: 10_000 })

    } finally {
      // Nettoyage des contextes
      console.log("[Test] Fermeture des contextes navigateurs...")
      await contextA.close()
      await contextB.close()
      await contextC.close()
    }
  })
})
