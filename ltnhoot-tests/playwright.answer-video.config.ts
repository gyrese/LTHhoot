import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  testMatch: "answer-video.spec.ts",
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3050",
    locale: "fr-FR",
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
  },
})
