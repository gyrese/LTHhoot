import { defineConfig, devices } from "@playwright/test"

// Config DÉDIÉE au banc de reconnexion multi-joueurs (18-reconnexion-profonde).
//
// Stack ISOLÉE gérée par le test (cf. helpers/recoveryServer) :
//  - web : `vite preview` sur :3040, proxy /ws → :3041
//  - socket : :3041, lancé/tué par le test, CONFIG_PATH dédié (.reconnect-config)
//
// Pré-requis : builds à jour
//   pnpm --filter @rahoot/socket build && pnpm --filter @rahoot/web build

export default defineConfig({
  testDir: "./tests",
  testMatch: "18-reconnexion-profonde.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 240_000,

  use: {
    baseURL: "http://localhost:3040",
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
