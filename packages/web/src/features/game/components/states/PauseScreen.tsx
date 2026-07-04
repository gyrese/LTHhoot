import { EVENTS } from "@rahoot/common/constants"
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { Coffee, Play } from "lucide-react"
import { motion } from "motion/react"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["PAUSED"]
}

const PauseScreen = ({ data: { text } }: Props) => {
  const { socket } = useSocket()
  const { isHost } = useGameConfig()
  const { gameId } = useManagerStore()
  const { t } = useTranslation()

  const handleResume = () => {
    if (!gameId) {
      return
    }

    socket?.emit(EVENTS.MANAGER.RESUME_GAME, { gameId })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-xl"
    >
      <Coffee className="anim-pop-in size-16 text-orange-400" />

      <h2 className="text-center text-3xl font-black text-white drop-shadow-lg md:text-4xl">
        {t("game:pause.title", "Pause")}
      </h2>

      <p className="text-center text-sm text-white/50">{t(text)}</p>

      {isHost ? (
        <button
          onClick={handleResume}
          className="flex items-center gap-2 rounded-2xl bg-orange-500 px-8 py-3 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-105 hover:bg-orange-400"
        >
          <Play className="size-5 fill-current" />
          {t("game:pause.resume", "Reprendre la partie")}
        </button>
      ) : (
        <p className="text-sm text-white/50">
          {t("game:pause.waitingHost", "En attente de l'hôte…")}
        </p>
      )}
    </motion.div>
  )
}

export default PauseScreen
