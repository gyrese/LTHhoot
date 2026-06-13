import { EVENTS } from "@rahoot/common/constants"
import Room from "@rahoot/web/features/game/components/join/Room"
import Username from "@rahoot/web/features/game/components/join/Username"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const PlayerAuthPage = () => {
  const { isConnected, connect } = useSocket()
  const { player, reset } = usePlayerStore()
  const { t } = useTranslation()

  useEffect(() => {
    if (!isConnected) {
      connect()
    }
  }, [connect, isConnected])

  // La reconnexion métier (PLAYER.RECONNECT si une session est persistée) est
  // émise une seule fois par le handler `connect` global du SocketProvider.
  // Ne pas la dupliquer ici sous peine de double reconnexion à chaque montage.

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
