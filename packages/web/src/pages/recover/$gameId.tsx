import { EVENTS } from "@rahoot/common/constants"
import Background from "@rahoot/web/components/Background"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"

function RecoverPage() {
  const { gameId } = Route.useParams()
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation("recovery")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [token] = useState(() => window.location.hash.slice(1))
  const recover = () => {
    if (!socket || !isConnected || pending) {
      return
    }
    // Vérifier le stockage avant de consommer le lien à usage unique.
    try {
      localStorage.setItem("recovery-storage-check", "1")
      localStorage.removeItem("recovery-storage-check")
    } catch {
      setError(t("storage"))
      return
    }
    setPending(true)
    setError("")
    socket
      .timeout(8000)
      .emit(EVENTS.PLAYER.RECOVER, { gameId, token }, (err, result) => {
        if (err || !result || "error" in result) {
          setPending(false)
          setError(t(err ? "network" : "invalid"))
          return
        }
        try {
          localStorage.setItem("client_id", result.clientId)
          usePlayerStore.getState().reset()
          usePlayerStore.getState().setGameId(gameId)
          // Recréer la connexion avec l'identité restaurée, puis resynchroniser
          // score, réponse, inventaire et chronomètre depuis le serveur.
          window.location.replace(`/party/${encodeURIComponent(gameId)}`)
        } catch {
          setPending(false)
          setError(t("storage"))
        }
      })
  }
  let buttonLabel = isConnected ? "resume" : "connecting"
  if (pending) {
    buttonLabel = "restoring"
  }
  return (
    <Background>
      <main className="mx-4 w-full max-w-sm rounded-2xl bg-black/80 p-6 text-white">
        <h1 className="text-2xl font-bold">{t("resume")}</h1>
        <p className="mt-3 text-white/80">{t("resumeHelp")}</p>
        {error && (
          <p role="alert" className="mt-4 text-red-300">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={recover}
          disabled={!isConnected || pending || !token}
          className="mt-6 min-h-12 w-full rounded-xl bg-orange-500 px-4 font-bold text-black disabled:opacity-50"
        >
          {t(buttonLabel)}
        </button>
        {!token && (
          <p role="alert" className="mt-4">
            {t("invalid")}
          </p>
        )}
      </main>
    </Background>
  )
}

export const Route = createFileRoute("/recover/$gameId")({
  component: RecoverPage,
})
