import { createFileRoute } from "@tanstack/react-router"
import PresentationPage from "@rahoot/web/features/presentation/PresentationPage"

export const Route = createFileRoute("/presentation")({
  component: PresentationPage,
})
