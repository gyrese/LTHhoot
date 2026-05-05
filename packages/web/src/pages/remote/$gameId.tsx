import { RemoteControl } from "@rahoot/web/features/game/components/remote/RemoteControl"
import { createFileRoute, useParams } from "@tanstack/react-router"

const RemotePage = () => {
  const { gameId } = useParams({ from: "/remote/$gameId" })
  return <RemoteControl gameId={gameId} />
}

export const Route = createFileRoute("/remote/$gameId")({
  component: RemotePage,
})
