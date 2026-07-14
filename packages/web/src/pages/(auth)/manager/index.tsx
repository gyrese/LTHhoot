import { EVENTS } from "@rahoot/common/constants"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import ManagerPassword from "@rahoot/web/features/manager/components/ManagerPassword"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

const ManagerAuthPage = () => {
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
    // Symétrique de la page invité : une session invitée encore active ne
    // doit pas aspirer la page de connexion admin vers le dashboard.
    if (data.role === "guest") {
      return
    }

    setConfig(data)
    navigate({ to: "/manager/config" })
  })

  const handleAuth = (password: string) => {
    // Stocké en localStorage : le PIN doit survivre à la fermeture de l'onglet
    // pour que la ré-authentification automatique fonctionne (cf. socket-context).
    // Exclusif de la session invité (rc_guest) : une seule identité à la fois.
    localStorage.removeItem("rc_guest")
    localStorage.setItem("rc_pwd", password)
    socket?.emit(EVENTS.MANAGER.AUTH, password)
  }

  return <ManagerPassword onSubmit={handleAuth} />
}

export const Route = createFileRoute("/(auth)/manager/")({
  component: ManagerAuthPage,
})
