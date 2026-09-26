/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "url"
import { defineConfig } from "vite"

// Cible du proxy temps-réel. Par défaut le socket local (:3001). Surchargeable
// par env (WS_PROXY_TARGET) pour servir un build de test contre un socket isolé
// sur un autre port — utile aux tests e2e de reprise après crash, sans toucher
// à la stack de dev qui tourne déjà sur 3000/3001.
const wsTarget = process.env.WS_PROXY_TARGET ?? "http://localhost:3001"

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      routeToken: "layout",
      routesDirectory: "./src/pages",
      generatedRouteTree: "./src/route.gen.ts",
      // Découpe chaque route en chunk chargé à la demande : la page joueur ne
      // télécharge plus l'éditeur (Konva, dnd…) ni le dashboard manager.
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@rahoot/web": fileURLToPath(new URL("./src", import.meta.url)),
      "@rahoot/common": fileURLToPath(
        new URL("../common/src", import.meta.url),
      ),
      "@rahoot/socket": fileURLToPath(
        new URL("../socket/src", import.meta.url),
      ),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/ws": {
        target: wsTarget,
        ws: true,
      },
      "/api": {
        target: wsTarget,
      },
      "/upload": {
        target: wsTarget,
      },
      "/ai-image": {
        target: wsTarget,
      },
      "/uploads": {
        target: wsTarget,
      },
      // Vignette de partage générée par le serveur (og:image).
      "/og": {
        target: wsTarget,
      },
    },
  },
  preview: {
    port: 3000,
    host: "0.0.0.0",
    // Reproduit le routage de l'hébergeur (nginx) pour tester le build en local.
    // Sans effet sur la prod : `vite preview` n'est utilisé qu'en local.
    proxy: {
      "/ws": {
        target: wsTarget,
        ws: true,
      },
      "/api": {
        target: wsTarget,
      },
      "/upload": {
        target: wsTarget,
      },
      "/ai-image": {
        target: wsTarget,
      },
      "/uploads": {
        target: wsTarget,
      },
      // Vignette de partage générée par le serveur (og:image).
      "/og": {
        target: wsTarget,
      },
    },
  },
  build: {
    // Seuil par défaut de Vite : le découpage par route + vendors ci-dessous
    // garde chaque chunk sous 500 kB, un dépassement signale une régression.
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        // Vendors isolés dans des chunks stables (cache navigateur conservé
        // d'un déploiement à l'autre) et, pour Konva/pptxgenjs, chargés
        // uniquement par les routes qui en ont besoin (éditeur, jeu).
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/u,
              priority: 30,
            },
            {
              name: "vendor-konva",
              test: /[\\/]node_modules[\\/](konva|react-konva|react-reconciler|use-image)[\\/]/u,
              priority: 20,
            },
            {
              name: "vendor-router",
              test: /[\\/]node_modules[\\/]@tanstack[\\/]/u,
              priority: 10,
            },
            {
              name: "vendor-i18n",
              test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/u,
              priority: 10,
            },
            {
              name: "vendor-socket",
              test: /[\\/]node_modules[\\/](socket\.io-client|engine\.io-client|engine\.io-parser|socket\.io-parser|@socket\.io)[\\/]/u,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    // Tests unitaires front (Vitest) : DOM simulé par jsdom, nettoyage du
    // rendu Testing Library entre chaque test (cf. src/test/setup.ts).
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
})
