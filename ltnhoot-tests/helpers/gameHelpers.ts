import type { BrowserContext, Page } from "@playwright/test"

const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? "admin"

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
