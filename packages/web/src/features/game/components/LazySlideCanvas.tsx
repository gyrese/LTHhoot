import { lazy, Suspense, type ComponentProps } from "react"

// SlideCanvas embarque Konva (~300 kB) : chargé à la demande pour que les
// pages de jeu ne le téléchargent que si une slide contient des éléments.
const SlideCanvas = lazy(
  () => import("@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"),
)

const LazySlideCanvas = (props: ComponentProps<typeof SlideCanvas>) => (
  <Suspense fallback={null}>
    <SlideCanvas {...props} />
  </Suspense>
)

export default LazySlideCanvas
