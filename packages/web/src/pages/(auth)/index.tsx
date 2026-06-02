import { EVENTS } from "@rahoot/common/constants"
import Room from "@rahoot/web/features/game/components/join/Room"
import Username from "@rahoot/web/features/game/components/join/Username"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const PlayerAuthPage = () => {
  const { isConnected, connect, socket } = useSocket()
  const { player, reset } = usePlayerStore()
  const { t } = useTranslation()
  const hasCheckedSession = useRef(false)

  useEffect(() => {
    if (!isConnected) {
      connect()
    }
  }, [connect, isConnected])

  // Si le joueur arrive sur la page d'accueil avec une session persistée,
  // on vérifie UNE SEULE FOIS si la partie existe encore.
  // Ne pas re-déclencher si player/gameId changent (ex: nouveau join).
  useEffect(() => {
    if (isConnected && socket && !hasCheckedSession.current) {
      hasCheckedSession.current = true
      const { player: p, gameId: gid } = usePlayerStore.getState()

      if (p && gid) {
        socket.emit(EVENTS.PLAYER.RECONNECT, { gameId: gid })
      }
    }
  }, [isConnected, socket])

  useEvent(EVENTS.GAME.RESET, () => {
    reset()
  })

  useEvent("game:errorMessage", (message) => {
    toast.error(t(message))
  })

  if (player) {
    return <Username />
  }

  return <Room />
}

import { z } from "zod"

const searchSchema = z.object({
  pin: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v === null || v === undefined ? v : String(v))),
})

export const Route = createFileRoute("/(auth)/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: PlayerAuthPage,
})
