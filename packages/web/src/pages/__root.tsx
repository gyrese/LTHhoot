import {
  SocketProvider,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { useEffect } from "react"

const GameLayout = () => {
  const { connect } = useSocket()

  // Connexion INITIALE seulement (autoConnect: false). Les reconnexions sont
  // gérées par Socket.IO, le watchdog du SocketProvider et le bouton
  // « Réessayer ». Relancer connect() à chaque perte de connexion annulait
  // les déconnexions décidées par le serveur : deux onglets d'un même joueur
  // se reprenaient la session en boucle (cf. test e2e 18).
  useEffect(() => {
    connect()
  }, [connect])

  useEffect(() => {
    document.body.classList.add("bg-secondary")

    return () => {
      document.body.classList.remove("bg-secondary")
    }
  }, [])

  return (
    <div className="bg-secondary antialiased">
      <Outlet />
    </div>
  )
}

export const Route = createRootRoute({
  component: () => (
    <SocketProvider>
      <GameLayout />
    </SocketProvider>
  ),
})
