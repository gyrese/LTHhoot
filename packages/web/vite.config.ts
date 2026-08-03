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
    chunkSizeWarningLimit: 2000,
  },
})
