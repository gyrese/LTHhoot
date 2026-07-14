import { EVENTS } from "@rahoot/common/constants"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import GuestLogin from "@rahoot/web/features/manager/components/GuestLogin"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

const GuestAuthPage = () => {
  const { setConfig } = useManagerStore()
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (!isConnected) {
      return
    }

    socket?.emit(EVENTS.MANAGER.GET_CONFIG)
  }, [isConnected])

  useEvent(EVENTS.MANAGER.CONFIG, (data) => {
    // Une session admin encore active (ou la ré-auth automatique rc_pwd)
    // répond aussi au GET_CONFIG émis au montage : sans ce filtre, la page
    // basculait seule vers le dashboard admin au bout de quelques secondes.
    if (data.role !== "guest") {
      return
    }

    setConfig(data)
    navigate({ to: "/manager/config" })
  })

  const handleAuth = (name: string, password: string) => {
    // Credentials en localStorage pour la ré-authentification automatique à la
    // reconnexion (cf. socket-context) — exclusifs de la session admin (rc_pwd).
    localStorage.removeItem("rc_pwd")
    localStorage.setItem("rc_guest", JSON.stringify({ name, password }))
    socket?.emit(EVENTS.MANAGER.GUEST_AUTH, { name, password })
  }

  return <GuestLogin onSubmit={handleAuth} />
}

export const Route = createFileRoute("/(auth)/manager/guest")({
  component: GuestAuthPage,
})
