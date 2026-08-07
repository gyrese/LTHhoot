import { SoloQuizView } from "@rahoot/web/features/game/components/solo/SoloQuizView"
import { createFileRoute, useParams } from "@tanstack/react-router"

const SoloPage = () => {
  const { quizzId } = useParams({ from: "/solo/$quizzId" })

  return <SoloQuizView quizzId={quizzId} />
}

export const Route = createFileRoute("/solo/$quizzId")({
  component: SoloPage,
})
