// Mesure le bouton « Valider » du tri dans le VRAI parcours de jeu, sur
// plusieurs tailles de mobile. Le conteneur de jeu est en overflow-hidden :
// si le bouton dépasse le bas du viewport, il est définitivement inatteignable.
const { chromium, devices } = require("@playwright/test")

const BASE = "http://localhost:3000"
const PIN = process.env.MANAGER_PIN || "1234"
const QUIZ = "ZZ-TEST-TRI-TEMP"

const TARGETS = [
  { name: "Android 360x640", width: 360, height: 640 },
  { name: "iPhone SE 375x667", width: 375, height: 667 },
  { name: "iPhone 12 390x844", width: 390, height: 844 },
]

const run = async (browser, target) => {
  // Contexte 1 : l'animateur, sur desktop.
  const mgrCtx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  })
  const mgr = await mgrCtx.newPage()
  await mgr.goto(`${BASE}/manager/config`)
  const pwd = mgr.locator('input[type="password"]')
  await pwd.waitFor({ state: "visible", timeout: 30000 })
  await pwd.fill(PIN)
  await mgr.keyboard.press("Enter")
  await mgr.locator("footer").waitFor({ state: "visible", timeout: 30000 })

  await mgr.locator(`text=${QUIZ}`).first().click()
  await mgr.locator('footer button:has-text("Démarrer")').click()
  await mgr.waitForURL(/\/party\/manager\//, { timeout: 30000 })
  const pin = (await mgr.locator("#game-pin").innerText()).trim()

  // Contexte 2 : le joueur, sur le mobile testé.
  const plCtx = await browser.newContext({
    ...devices["Pixel 5"],
    viewport: { width: target.width, height: target.height },
    isMobile: true,
    hasTouch: true,
  })
  const pl = await plCtx.newPage()
  await pl.goto(BASE)
  await pl.locator("input").first().fill(pin)
  await pl.keyboard.press("Enter")
  await pl.waitForTimeout(1200)
  await pl.locator("input").first().fill("Zoe")
  await pl.keyboard.press("Enter")
  await pl.waitForTimeout(2500)

  await mgr.locator('button:has-text("Démarrer")').first().click()

  // On attend l'écran de réponse du tri.
  await pl.locator('button:has-text("Valider")').waitFor({ timeout: 40000 })
  await pl.waitForTimeout(800)

  const box = await pl.locator('button:has-text("Valider")').boundingBox()
  const vh = target.height
  const visible = box && box.y + box.height <= vh
  const overflow = box ? Math.round(box.y + box.height - vh) : null

  const shot = `puzzle-${target.width}x${target.height}.png`
  await pl.screenshot({ path: shot })

  console.log(
    `[${target.name}] bas du bouton = ${box ? Math.round(box.y + box.height) : "?"}px / viewport ${vh}px ` +
      `→ ${visible ? "VISIBLE" : `HORS ECRAN (+${overflow}px)`}  (${shot})`,
  )

  // Le bouton est-il réellement cliquable ?
  let clickable = false
  try {
    await pl
      .locator('button:has-text("Valider")')
      .click({ timeout: 4000, trial: true })
    clickable = true
  } catch {
    clickable = false
  }
  console.log(`[${target.name}] cliquable = ${clickable}`)

  await plCtx.close()
  await mgrCtx.close()

  return { target: target.name, visible, clickable, overflow }
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const results = []
  for (const t of TARGETS) {
    try {
      results.push(await run(browser, t))
    } catch (e) {
      console.log(`[${t.name}] ERREUR: ${e.message.split("\n")[0]}`)
      results.push({ target: t.name, error: true })
    }
  }
  await browser.close()
  console.log("\n=== RESUME ===")
  results.forEach((r) =>
    console.log(
      r.error
        ? `${r.target}: erreur`
        : `${r.target}: visible=${r.visible} cliquable=${r.clickable}`,
    ),
  )
})()
