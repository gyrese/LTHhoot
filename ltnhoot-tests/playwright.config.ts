import { defineConfig, devices } from "@playwright/test"
import * as dotenv from "dotenv"

dotenv.config()

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.BASE_URL ?? "https://ltnhoot.ltn.re",
    locale: "fr-FR",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Empêche Chromium de geler les onglets en arrière-plan : indispensable
        // aux tests temps-réel multi-contextes (manager + joueurs), sinon le
        // socket de l'onglet inactif tombe en ping timeout et la partie se reset.
        launchOptions: {
          args: [
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
          ],
        },
      },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
})
