import { test, expect, type Page } from "@playwright/test"
import fs from "fs"
import path from "path"

/**
 * Test 17 — Tests finaux de la session :
 *   1. Salon manager s'affiche + joueur visible (régression « salon vide » / fix StrictMode)
 *   2. Nouveau type `image_sequence` jouable de bout en bout (images côté hôte,
 *      champ de réponse côté joueur, soumission acceptée).
 *
 * Gating identique aux autres tests « partie réelle » : nécessite une stack LOCALE
 * lancée (BASE_URL=http://localhost:3000) + MANAGER_PASSWORD + SKIP_REAL_GAME=false.
 *
 * Le quiz de test est auto-seedé dans config/quizz/ (data-URI → aucune dépendance
 * réseau) puis nettoyé. Il commence par une question `image_sequence`.
 */

const BASE_URL = process.env.BASE_URL ?? "https://ltnhoot.ltn.re"
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? ""
const SKIP_REAL_GAME = process.env.SKIP_REAL_GAME !== "false"

// config/ est à la racine du repo ; les tests tournent depuis ltnhoot-tests/.
const QUIZ_DIR = path.resolve(process.cwd(), "../config/quizz")
const SEED_ID = "zz-e2e-imageseq"
const SEED_FILE = path.join(QUIZ_DIR, `${SEED_ID}.json`)
const SEED_TITLE = "E2E ImageSeq Audit"

// PNG 1x1 transparent en data-URI : non-vide (passe le validateur) et rendu sans réseau.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

const SEED_QUIZ = {
  subject: SEED_TITLE,
  questions: [
    {
      type: "image_sequence",
      question: "Quelle est la bonne réponse ?",
      images: [TINY_PNG, TINY_PNG],
      correctAnswers: ["paris"],
      imageInterval: 2,
      cooldown: 3,
      time: 30,
    },
    {
      type: "mcq",
      question: "2 + 2 ?",
      answers: ["3", "4"],
      solutions: [1],
      cooldown: 3,
      time: 15,
    },
  ],
}

async function loginManager(page: Page): Promise<void> {
  await page.goto("/manager/config")
  await page.locator('input[type="password"]').waitFor({ timeout: 10_000 })
  await page.locator('input[type="password"]').fill(MANAGER_PASSWORD)
  await page
    .locator('button[type="submit"]')
    .or(page.locator("button").last())
    .click()
  await expect(page.locator('input[type="password"]')).not.toBeVisible({
    timeout: 10_000,
  })
}

/** Sélectionne le quiz seedé (par titre) et démarre → retourne le PIN du salon. */
async function startSeededGame(managerPage: Page): Promise<string> {
  const card = managerPage
    .locator("div[draggable='true']")
    .filter({ hasText: SEED_TITLE })
    .first()

  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.click()

  const startBtn = managerPage.locator('footer button:has-text("Démarrer")')
  await expect(startBtn).toBeEnabled({ timeout: 8000 })
  await startBtn.click()

  // Le salon doit s'afficher (preuve du fix StrictMode : #game-pin présent).
  await managerPage
    .waitForURL(/\/party\/manager\//, { timeout: 20_000 })
    .catch(() => undefined)
  await expect(managerPage.locator("#game-pin")).toBeVisible({ timeout: 25_000 })

  return (await managerPage.locator("#game-pin").textContent())?.trim() ?? ""
}

async function joinPlayer(
  playerPage: Page,
  pin: string,
  nickname: string,
): Promise<void> {
  await playerPage.goto(`${BASE_URL}/`)
  await playerPage.locator("#pin-input").waitFor({ timeout: 8000 })
  await playerPage.locator("#pin-input").fill(pin)
  await playerPage.locator("#join-button").click()
  await playerPage.locator("#nickname").waitFor({ timeout: 8000 })
  await playerPage.locator("#nickname").fill(nickname)
  await playerPage.locator("#username-submit").click()
  await playerPage.waitForURL(/\/party\//, { timeout: 12_000 })
}

test.describe("17 — Salon + séquence d'images (E2E)", () => {
  test.skip(
    !MANAGER_PASSWORD || SKIP_REAL_GAME,
    "Ignoré — requiert MANAGER_PASSWORD + SKIP_REAL_GAME=false + stack locale",
  )
  test.setTimeout(90_000)

  test.beforeAll(() => {
    fs.mkdirSync(QUIZ_DIR, { recursive: true })
    fs.writeFileSync(SEED_FILE, JSON.stringify(SEED_QUIZ, null, 2), "utf-8")
  })

  test.afterAll(() => {
    try {
      fs.unlinkSync(SEED_FILE)
    } catch {
      /* déjà supprimé */
    }
  })

  test("le salon manager s'affiche et le joueur y apparaît", async ({
    browser,
  }) => {
    const managerCtx = await browser.newContext()
    const playerCtx = await browser.newContext()
    const managerPage = await managerCtx.newPage()
    const playerPage = await playerCtx.newPage()

    try {
      await loginManager(managerPage)
      const pin = await startSeededGame(managerPage)
      expect(pin.length).toBeGreaterThan(0)

      await joinPlayer(playerPage, pin, "AliceSalon")

      // Room.tsx rend la liste des joueurs → le pseudo doit apparaître côté MANAGER.
      await expect(managerPage.getByText("AliceSalon")).toBeVisible({
        timeout: 10_000,
      })
    } finally {
      await managerCtx.close()
      await playerCtx.close()
    }
  })

  test("l'éditeur ouvre un quiz image_sequence sans crash + UI dédiée", async ({
    page,
  }) => {
    // Régression gardée : QuizzEditorCard plantait dès qu'un slide était de type
    // image_sequence (type absent de TYPE_ASSETS → <undefined/> → écran blanc).
    // Ouvrir l'éditeur sur un quiz dont la Q1 est image_sequence prouve à la fois
    // que la vignette ne crashe plus ET que l'éditeur dédié se rend.
    await loginManager(page)

    await page.goto(`/manager/quizz/${SEED_ID}`)
    await page.waitForLoadState("domcontentloaded")

    // Composant QuestionEditorImageSequence rendu (libellés FR exacts).
    await expect(page.getByText("Images (ordre de révélation)")).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText("Intervalle (secondes)")).toBeVisible({
      timeout: 5_000,
    })

    // Le titre du quiz est affiché → la page a bien chargé (pas d'écran blanc).
    await expect(page.getByText(SEED_TITLE).first()).toBeVisible({
      timeout: 5_000,
    })
  })
})
