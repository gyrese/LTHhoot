import { EVENTS } from "@rahoot/common/constants"
import { STATUS } from "@rahoot/common/types/game/status"
import GameWrapper from "@rahoot/web/features/game/components/GameWrapper"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import {
  GAME_STATE_COMPONENTS_MANAGER,
  MANAGER_SKIP_EVENTS,
  isKeyOf,
} from "@rahoot/web/features/game/utils/constants"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ManagerGamePage = () => {
  const navigate = useNavigate()
  const { gameId: gameIdParam } = useParams({ from: "/party/manager/$gameId" })
  const { socket, isReconnecting } = useSocket()
  const { gameId, status, setStatus, setPlayers, reset } =
    useManagerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS_MANAGER) {
      setStatus(name, data)
    }
  })

  // Centralisation de la gestion des joueurs dans le store manager
  // (évite la perte de la liste lors des re-mount de Room — bug mode soirée)
  useEvent(EVENTS.MANAGER.NEW_PLAYER, (newPlayer) => {
    const current = useManagerStore.getState().players

    if (current.some((p) => p.id === newPlayer.id)) {
      // Mettre à jour le joueur existant (ex. points modifiés par un power-up)
      setPlayers(current.map((p) => (p.id === newPlayer.id ? newPlayer : p)))

      
return
    }

    setPlayers([...current, newPlayer])
  })

  useEvent(EVENTS.MANAGER.REMOVE_PLAYER, (playerId) => {
    const current = useManagerStore.getState().players
    setPlayers(current.filter((p) => p.id !== playerId))
  })

  useEvent(EVENTS.MANAGER.PLAYER_KICKED, (playerId) => {
    const current = useManagerStore.getState().players
    setPlayers(current.filter((p) => p.id !== playerId))
  })

  useEvent("connect", () => {
    if (gameIdParam) {
      socket?.emit(EVENTS.MANAGER.RECONNECT, { gameId: gameIdParam })
    }
  })

  useEvent(
    EVENTS.MANAGER.SUCCESS_RECONNECT,
    (data) => {
      console.log(`[RECONNECT_MANAGER] Succès → gameId=${data.gameId} players=${data.players.length} status=${data.status.name} timer=${data.timer}`)
      
      // Hydratation atomique du store manager
      useManagerStore.getState().hydrate({
        gameId: data.gameId,
        status: data.status as any,
        players: data.players,
      })
      setQuestionStates(data.currentQuestion)

      if (data.timer && data.timer > 0) {
        useQuestionStore.getState().setCooldown(data.timer)
      }
    },
  )

  // UseSocket déplacé en haut

  useEffect(() => {
    return () => {
      console.log("[DEBUG] ManagerGamePage unmounted, cleaning up store")
      reset()
      setQuestionStates(null)
    }
  }, [reset, setQuestionStates])

  useEvent(EVENTS.GAME.RESET, (message) => {
    if (isReconnecting) {
      console.log(`[DEBUG] Ignored MANAGER GAME.RESET during reconnect (msg: ${message})`)

      return
    }

    console.log(`[DEBUG] Processing MANAGER GAME.RESET (msg: ${message})`)
    navigate({ to: "/manager/config" })
    toast.error(t(message))
  })

  const handleSkip = () => {
    if (!status) {
      return
    }

    if (status.name === STATUS.FINISHED) {
      navigate({ to: "/manager/config" })

      return
    }

    if (!gameId) {
      return
    }

    if (isKeyOf(MANAGER_SKIP_EVENTS, status.name)) {
      socket?.emit(MANAGER_SKIP_EVENTS[status.name], { gameId })
    }
  }

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS_MANAGER, status.name)
      ? GAME_STATE_COMPONENTS_MANAGER[status.name]
      : null

  return (
    <GameWrapper statusName={status?.name} onNext={handleSkip} manager>
      {CurrentComponent && <CurrentComponent data={status!.data as never} />}
    </GameWrapper>
  )
}

export const Route = createFileRoute("/party/manager/$gameId")({
  component: ManagerGamePage,
})
