import type { PlayerStatusDataMap } from "@rahoot/common/types/game/status"
import { EVENTS } from "@rahoot/common/constants"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import { useEvent } from "@rahoot/web/features/game/contexts/socket-context"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import Loader from "@rahoot/web/components/Loader"
import { LogOut } from "lucide-react"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useNavigate } from "@tanstack/react-router"

type Props = {
  data: PlayerStatusDataMap["WAIT"]
}

type LobbyPlayer = { id: string; username: string; avatar?: string }
const WAITING_ANIMATION_STATES = ["waiting"] as const

const Wait = ({ data: { text } }: Props) => {
  const { t } = useTranslation()
  const { reset } = usePlayerStore()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<LobbyPlayer[]>([])

  useEvent(EVENTS.GAME.NEW_PLAYER, (player) => {
    setPlayers((prev) => [...prev, player])
  })

  useEvent(EVENTS.GAME.REMOVE_PLAYER, (playerId) => {
    setPlayers((prev) => prev.filter((p) => p.id !== playerId))
  })

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-3">
        <Loader className="anim-wiggle h-20" />
        <h2 className="anim-slide-up text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
          {t(text)}
        </h2>
        <div className="dot-loader text-white" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <button
          onClick={() => {
            reset()
            navigate({ to: "/" })
          }}
          className="mt-4 flex items-center gap-2 text-sm font-bold text-white/40 transition-colors hover:text-white/80"
        >
          <LogOut size={16} />
          {t("common:quit", "Quitter la session")}
        </button>
      </div>

      {players.length > 0 && (
        /* Conteneur scrollable — hauteur limitée pour laisser le loader visible */
        <div className="max-h-56 w-full overflow-y-auto px-1">
          <div className="flex flex-wrap justify-center gap-4">
            <AnimatePresence>
              {players.map((player, i) => (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, scale: 0.4, y: -16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.4, y: 16 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <GameAvatar
                    seed={player.avatar || player.username}
                    animated
                    animationStates={WAITING_ANIMATION_STATES}
                    className="h-16 w-16 rounded-full border-2 border-white/50 shadow-md"
                    style={{ animationDelay: `${(i % 6) * 0.2}s` }}
                  />
                  {/* Username — max-w élargi, lisible sur petits écrans */}
                  <span className="max-w-20 truncate text-center text-xs font-bold text-white drop-shadow">
                    {player.username}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </section>
  )
}

export default Wait
