import { LogOut } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

// Délai avant de proposer « Quitter » : la plupart des coupures se résolvent
// en quelques secondes, inutile d'inviter à abandonner la partie trop tôt.
const QUIT_DELAY_MS = 8000

type Props = {
  onQuit: () => void
}

const ReconnectingOverlay = ({ onQuit }: Props) => {
  const { t } = useTranslation()
  const [canQuit, setCanQuit] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setCanQuit(true), QUIT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div className="relative" aria-hidden="true">
        {/* Cercles d'animation */}
        <div className="h-20 w-20 animate-spin rounded-full border-4 border-orange-500/20 border-t-orange-500" />
        <div className="absolute inset-0 h-20 w-20 animate-ping rounded-full border-4 border-orange-500/10" />
      </div>

      <div className="mt-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          {t("common:reconnecting.title")}
        </h2>
        <p className="mt-2 animate-pulse font-medium text-slate-400">
          {t("common:reconnecting.subtitle")}
        </p>
        <p className="mt-4 text-sm text-white/40">
          {t("common:reconnecting.hint")}
        </p>
      </div>

      {canQuit && (
        <button
          type="button"
          onClick={onQuit}
          className="mt-12 flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} aria-hidden="true" />
          {t("common:quit")}
        </button>
      )}
    </div>
  )
}

export default ReconnectingOverlay
