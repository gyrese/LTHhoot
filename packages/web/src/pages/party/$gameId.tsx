import { useEffect } from "react"
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
  const { isConnected, socket } = useSocket()
  const { gameId: gameIdParam } = useParams({ from: "/party/$gameId" })
  const { status, setStatus, reset } = usePlayerStore()
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

  // Resync métier dès que la connexion est établie (et à chaque reconnexion).
  // Dépendre d'isConnected — PAS de socket.connected lu au montage — couvre le
  // rechargement complet de la page (onglet déchargé par le mobile en veille) :
  // au montage le socket n'est pas encore connecté, l'émission part au moment
  // où il l'est. Le serveur identifie le joueur par clientId (localStorage),
  // donc la session est restaurée même si le store a été vidé entre-temps.
  useEffect(() => {
    if (isConnected && socket && gameIdParam) {
      socket.emit(EVENTS.PLAYER.RECONNECT, { gameId: gameIdParam })
    }
  }, [isConnected, socket, gameIdParam])

  // UseSocket déplacé en haut

  useEffect(() => {
    return () => {
      console.log("[DEBUG] PlayerGamePage unmounted, cleaning up store")
      reset()
      setQuestionStates(null)
    }
  }, [reset, setQuestionStates])

  // GAME.RESET est toujours traité : le serveur ne l'émet plus lors d'un
  // takeover du même clientId (retiré côté serveur), donc chaque RESET restant
  // est autoritaire (partie expirée/fermée, joueur retiré ou kické). L'ignorer
  // pendant une reconnexion laissait le joueur bloqué sur un écran vide.
  useEvent(EVENTS.GAME.RESET, (message) => {
    console.log(`[DEBUG] Processing GAME.RESET (msg: ${message})`)
    navigate({ to: "/", search: { pin: undefined } })
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
