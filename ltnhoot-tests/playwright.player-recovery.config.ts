import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  testMatch: "player-recovery.spec.ts",
  workers: 1,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3030",
    locale: "fr-FR",
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
  },
})
