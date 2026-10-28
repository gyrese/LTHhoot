import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  testMatch: "evening-tracking.spec.ts",
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: { baseURL: "http://localhost:3040", locale: "fr-FR" },
})
