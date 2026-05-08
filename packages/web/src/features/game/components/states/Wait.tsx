import type { PlayerStatusDataMap } from "@rahoot/common/types/game/status"
import { EVENTS } from "@rahoot/common/constants"
import { useEvent } from "@rahoot/web/features/game/contexts/socket-context"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import Loader from "@rahoot/web/components/Loader"
import { LogOut } from "lucide-react"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useNavigate } from "@tanstack/react-router"

type Props = {
  data: PlayerStatusDataMap["WAIT"]
}

const Wait = ({ data: { text } }: Props) => {
  const { t } = useTranslation()
  const { reset } = usePlayerStore()
  const navigate = useNavigate()
  const [totalPlayers, setTotalPlayers] = useState(0)

  useEvent(EVENTS.GAME.TOTAL_PLAYERS, (total) => {
    setTotalPlayers(total)
  })

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-3">
        <Loader className="anim-wiggle h-20" />
        <h2 className="anim-slide-up text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
          {t(text)}
        </h2>

        {totalPlayers > 0 && (
          <div className="anim-pop-in mt-2 flex items-center justify-center rounded-full bg-white/10 px-5 py-2 backdrop-blur-sm">
            <span className="text-lg font-bold text-white">
              {totalPlayers} {t("game:playersJoined", "joueurs connectés")}
            </span>
          </div>
        )}

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
    </section>
  )
}

export default Wait
