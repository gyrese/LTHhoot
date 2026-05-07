import { EVENTS } from "@rahoot/common/constants"
import GameWrapper from "@rahoot/web/features/game/components/GameWrapper"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import {
  GAME_STATE_COMPONENTS,
  isKeyOf,
} from "@rahoot/web/features/game/utils/constants"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const PlayerGamePage = () => {
  const navigate = useNavigate()
  const { socket, isReconnecting } = useSocket()
  const { gameId: gameIdParam } = useParams({ from: "/party/$gameId" })
  const { status, setPlayer, setGameId, setStatus, reset } = usePlayerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()

  // La reconnexion est maintenant gérée globalement par le SocketProvider
  // pour assurer que l'overlay Reconnecting s'affiche correctement.

  useEvent(
    EVENTS.PLAYER.SUCCESS_RECONNECT,
    (data) => {
      console.log(
        `[RECONNECT] Succès → gameId=${data.gameId} joueur=${data.player.username} status=${data.status.name} timer=${data.timer}`,
      )
      // On utilise hydrate pour un remplacement atomique de l'état
      usePlayerStore.getState().hydrate({
        gameId: data.gameId,
        player: data.player,
        status: data.status as any,
      })
      setQuestionStates(data.currentQuestion)

      // Si un timer est en cours, on l'injecte dans le store pour resync immédiate
      if (data.timer && data.timer > 0) {
        useQuestionStore.getState().setCooldown(data.timer)
      }
    },
  )

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS) {
      setStatus(name, data)
    }
  })

  // useSocket déplacé en haut

  useEvent(EVENTS.GAME.RESET, (message) => {
    if (isReconnecting) {
      console.log(`[DEBUG] Ignored GAME.RESET during reconnect (msg: ${message})`)

      return
    }

    console.log(`[DEBUG] Processing GAME.RESET (msg: ${message})`)
    navigate({ to: "/", search: { pin: undefined } })
    reset()
    setQuestionStates(null)
    toast.error(t(message))
  })

  if (!gameIdParam) {
    return null
  }

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS, status.name)
      ? GAME_STATE_COMPONENTS[status.name]
      : null

  return (
    <GameWrapper statusName={status?.name}>
      {CurrentComponent && <CurrentComponent data={status!.data as never} />}
    </GameWrapper>
  )
}

export const Route = createFileRoute("/party/$gameId")({
  component: PlayerGamePage,
})
