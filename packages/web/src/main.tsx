import Toaster from "@rahoot/web/components/Toaster"
import "@rahoot/web/i18n"
import "@rahoot/web/index.css"
import { routeTree } from "@rahoot/web/route.gen"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { MotionConfig } from "motion/react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  // eslint-disable-next-line no-unused-vars
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/*
     * Avec reducedMotion="user", prefers-reduced-motion est respecté par TOUTES
     * les animations Framer Motion (transforms/layout neutralisés, opacité gardée).
     * Le @media CSS ne couvrait que les animations CSS, pas les transforms inline
     * de Motion (podium, leaderboard, power-ups, interstitiel…).
     */}
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
      <Toaster />
    </MotionConfig>
  </StrictMode>,
)
