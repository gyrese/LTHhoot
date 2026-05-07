import { EVENTS } from "@rahoot/common/constants"
import logo from "@rahoot/web/assets/logo.png"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

const RemoteIndexPage = () => {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Le serveur répond avec le gameId si le code est valide
  useEvent(EVENTS.GAME.SUCCESS_ROOM, (gameId) => {
    navigate({ to: "/remote/$gameId", params: { gameId } })
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    setError("Code invalide ou partie introuvable.")
    setIsLoading(false)
    console.error(message)
  })

  const handleSubmit = () => {
    const code = inviteCode.trim().toUpperCase()

    if (code.length < 3) {
      setError("Entrez le code d'invitation affiché sur l'écran principal.")

      
return
    }

    if (!socket) {
      setError("Connexion au serveur en cours...")

      
return
    }

    setError("")
    setIsLoading(true)
    socket.emit(EVENTS.PLAYER.JOIN, code)
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-slate-950 to-black p-6">
      {/* Ambiance */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 left-1/3 h-64 w-64 animate-pulse rounded-full bg-orange-500/6 blur-3xl" />
        <div className="absolute right-1/4 bottom-20 h-48 w-48 animate-pulse rounded-full bg-violet-500/6 blur-3xl [animation-delay:1.5s]" />
      </div>

      {/* Logo */}
      <div className="relative text-center">
        <img
          src={logo}
          alt="LTNHoot!"
          className="mx-auto h-16 w-auto object-contain"
        />
        <div className="mt-2 text-xs tracking-[0.3em] text-white/30 uppercase">
          Télécommande
        </div>
      </div>

      {/* Carte */}
      <div className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-400" : "animate-pulse bg-red-400"}`}
          />
          <span className="text-xs text-white/40">
            {isConnected ? "Serveur connecté" : "Connexion..."}
          </span>
        </div>

        <label className="mb-2 block text-xs font-semibold tracking-widest text-white/50 uppercase">
          Code d'invitation
        </label>
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value.toUpperCase())
            setError("")
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Ex : ABC123"
          maxLength={8}
          className="mb-3 w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-center font-mono text-xl font-bold tracking-widest text-white uppercase placeholder-white/20 transition-all focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
          autoFocus
        />

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={isLoading || !isConnected || !inviteCode.trim()}
          className="w-full rounded-xl bg-orange-500 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/25 disabled:shadow-none"
        >
          {isLoading ? "Recherche..." : "Rejoindre →"}
        </button>
      </div>

      <p className="relative max-w-xs text-center text-xs text-white/20">
        Le code s'affiche sur l'écran principal en salle d'attente.
      </p>
    </div>
  )
}

export const Route = createFileRoute("/remote/")({
  component: RemoteIndexPage,
})
