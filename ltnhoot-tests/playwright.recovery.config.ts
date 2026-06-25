import { defineConfig, devices } from "@playwright/test"

// Config DÉDIÉE au test de reprise après crash (Palier 0).
//
// Stack ISOLÉE, gérée PAR LE TEST lui-même (cf. helpers/recoveryServer) :
//  - web : `vite preview` sur :3020 (build de prod ; pas `vite dev` à cause du
//    StrictMode qui casse la création de partie), proxy /ws → :3021.
//  - socket : :3021, lancé/tué brutalement par le test.
// Ports volontairement « neufs » (3020/3021) pour ne pas heurter la stack de dev
// (3000/3001) ni d'éventuels restes Playwright sur 3010.
//
// Pré-requis : builds à jour
//   pnpm --filter @rahoot/socket build && pnpm --filter @rahoot/web build

export default defineConfig({
  testDir: "./tests",
  testMatch: "16-crash-recovery.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 150_000,

  use: {
    baseURL: "http://localhost:3020",
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
