import { expect, type BrowserContext, type Page } from "@playwright/test"

const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? "admin"

/**
 * Authentifie le manager et attend l'affichage du dashboard (footer visible).
 */
export async function loginManager(
  page: Page,
  password = MANAGER_PASSWORD,
): Promise<void> {
  await page.goto("/manager/config")
  await page.waitForLoadState("domcontentloaded")

  const pwdInput = page.locator('input[type="password"]')
  await pwdInput.waitFor({ state: "visible", timeout: 12_000 })
  await pwdInput.fill(password)
  await page
    .locator('button[type="submit"]')
    .or(page.locator("button").last())
    .click()

  await page.waitForURL(/\/manager\/config/, { timeout: 15_000 })
  await page.locator("footer").waitFor({ state: "visible", timeout: 15_000 })
}

/**
 * Sélectionne le premier quiz et démarre une partie simple.
 * Retourne le code d'invitation affiché dans le lobby (#game-pin), ou null si
 * aucun quiz n'est disponible.
 */
export async function createGame(managerPage: Page): Promise<string | null> {
  const card = managerPage.locator("div[draggable='true']").first()

  if (!(await card.isVisible({ timeout: 8000 }).catch(() => false))) {
    return null
  }

  await card.click()

  // La sélection du quiz active le bouton « Démarrer la partie » (disabled sinon).
  // On attend qu'il devienne cliquable : preuve que la sélection a bien pris.
  const startBtn = managerPage.locator('footer button:has-text("Démarrer")')
  await expect(startBtn).toBeEnabled({ timeout: 8000 })
  await startBtn.click()

  // Navigation vers /party/manager/$gameId, puis affichage du lobby (#game-pin).
  // Timeout large : la 1re visite de cette route compile un nouveau chunk Vite.
  await managerPage
    .waitForURL(/\/party\/manager\//, { timeout: 20_000 })
    .catch(() => undefined)
  await managerPage.locator("#game-pin").waitFor({ timeout: 25_000 })

  return (await managerPage.locator("#game-pin").textContent())?.trim() ?? null
}

/**
 * Rejoint une partie via le PIN et attend l'arrivée dans la salle d'attente
 * (URL /party/...). Variante de joinAsPlayer qui ne dépend pas de #game-pin.
 */
export async function joinPlayer(
  page: Page,
  pin: string,
  nickname: string,
): Promise<void> {
  await page.goto("/")
  await page.locator("#pin-input").waitFor({ state: "visible", timeout: 8000 })
  await page.locator("#pin-input").fill(pin)
  await page.locator("#join-button").click()
  await page.locator("#nickname").waitFor({ state: "visible", timeout: 8000 })
  await page.locator("#nickname").fill(nickname)
  await page.locator("#username-submit").click()
  await page.waitForURL(/\/party\//, { timeout: 15_000 })
}

/**
 * Rejoint la salle d'attente via l'interface web (page PIN → pseudo → lobby).
 */
export async function joinAsPlayer(
  page: Page,
  inviteCode: string,
  nickname: string,
): Promise<void> {
  await page.goto("/")
  await page.locator("#pin-input").waitFor({ timeout: 5000 })
  await page.locator("#pin-input").fill(inviteCode)
  await page.locator("#join-button").click()
  await page.locator("#nickname").waitFor({ timeout: 5000 })
  await page.locator("#nickname").fill(nickname)
  await page.locator("#username-submit").click()
  await page.locator("#game-pin").waitFor({ timeout: 5000 })
}

/**
 * Ouvre la télécommande manager et s'authentifie avec le mot de passe.
 */
export async function openRemoteControl(
  context: BrowserContext,
  gameId: string,
  password = MANAGER_PASSWORD,
): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/remote/${gameId}`)
  const pwdInput = page.locator('input[type="password"]')
  await pwdInput.waitFor({ timeout: 5000 })
  await pwdInput.fill(password)
  await page.locator('button').last().click()
  // Attendre l'affichage du dashboard (bouton action ou tabs)
  await page.locator('button:has-text("Jeu")').or(page.locator('[data-tab]')).waitFor({ timeout: 8000 })
  return page
}

/**
 * Attend que le texte d'un statut de jeu soit visible sur la page.
 */
export async function waitForGameStatus(
  page: Page,
  statusLabel: string,
  timeout = 10000,
): Promise<void> {
  await page.locator(`text=${statusLabel}`).waitFor({ timeout })
}
