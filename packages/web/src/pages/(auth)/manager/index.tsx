import { EVENTS } from "@rahoot/common/constants"
import Card from "@rahoot/web/components/Card"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import ManagerPassword from "@rahoot/web/features/manager/components/ManagerPassword"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

const ManagerAuthPage = () => {
  const { setConfig } = useManagerStore()
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation()
  // Session ouverte avec le PIN de télécommande : elle ne donne accès qu'au
  // pilotage d'une partie, jamais au dashboard (config émise vide).
  const [isRemoteSession, setIsRemoteSession] = useState(false)

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

    if (data.role === "remote") {
      setIsRemoteSession(true)

      return
    }

    setIsRemoteSession(false)
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

  // Retour au formulaire : on oublie le PIN mémorisé, sinon le socket-context
  // rouvrirait la même session télécommande à la prochaine reconnexion.
  const handleUseAnotherCode = () => {
    socket?.emit(EVENTS.MANAGER.LOGOUT)
    localStorage.removeItem("rc_pwd")
    setIsRemoteSession(false)
  }

  if (isRemoteSession) {
    return (
      <Card>
        <p className="text-center text-lg font-bold text-gray-800">
          {t("manager:remoteOnly.title")}
        </p>
        <p className="mt-1 text-center text-sm text-gray-600">
          {t("manager:remoteOnly.hint")}
        </p>
        <Link
          to="/remote"
          className="btn-shadow bg-primary mt-4 flex min-h-11 items-center justify-center rounded-md p-2 text-lg font-semibold text-white"
        >
          {t("manager:remoteOnly.open")}
        </Link>
        <button
          type="button"
          onClick={handleUseAnotherCode}
          className="mt-3 min-h-11 w-full text-sm font-semibold text-gray-600 underline-offset-2 hover:underline"
        >
          {t("manager:remoteOnly.useAnotherCode")}
        </button>
      </Card>
    )
  }

  return <ManagerPassword onSubmit={handleAuth} />
}

export const Route = createFileRoute("/(auth)/manager/")({
  component: ManagerAuthPage,
})
