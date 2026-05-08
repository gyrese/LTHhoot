import { EVENTS } from "@rahoot/common/constants"
import { STATUS, type Status } from "@rahoot/common/types/game/status"
import background from "@rahoot/web/assets/background.png"
import Loader from "@rahoot/web/components/Loader"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { MANAGER_SKIP_BTN } from "@rahoot/web/features/game/utils/constants"
import AnimatedPoints from "@rahoot/web/features/game/components/AnimatedPoints"
import clsx from "clsx"
import { createContext, useContext, type PropsWithChildren, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type GameConfig = {
  isHost: boolean
}

const GameConfigContext = createContext<GameConfig>({ isHost: false })

export const useGameConfig = () => useContext(GameConfigContext)

type Props = PropsWithChildren & {
  statusName: Status | undefined
  onNext?: () => void
  manager?: boolean
}

const GameWrapper = ({ children, statusName, onNext, manager }: Props) => {
  const { isConnected } = useSocket()
  const { player } = usePlayerStore()
  const { questionStates, setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()
  const [isDisabled, setIsDisabled] = useState(false)
  const next = statusName ? MANAGER_SKIP_BTN[statusName] : null

  useEvent(EVENTS.GAME.UPDATE_QUESTION, ({ current, total }) => {
    setQuestionStates({ current, total })
  })

  const { setCooldown } = useQuestionStore()
  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    toast.error(t(message))
    setIsDisabled(false)
  })

  useEffect(() => {
    setIsDisabled(false)
  }, [statusName])

  const handleNext = () => {
    setIsDisabled(true)
    onNext?.()
  }

  const isRoomScreen = !statusName || statusName === STATUS.SHOW_ROOM

  return (
    <GameConfigContext.Provider value={{ isHost: !!manager }}>
      <section
        className="relative flex h-dvh flex-col overflow-hidden"
        style={{
          backgroundImage: "url(/bg-salon.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Fond garage uniquement sur l'écran d'attente */}
        {isRoomScreen && (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-65 select-none"
            style={{ backgroundImage: `url(${background})` }}
          />
        )}
        {/* Overlay sombre pendant les questions */}
        {!isRoomScreen && (
          <div className="pointer-events-none absolute inset-0 bg-black/60" />
        )}

        <div className="z-10 flex w-full flex-1 flex-col">
          {!isConnected && !statusName ? null : (
            <>
              {/* Overlay compteur + bouton suivant (superposé, pas une barre) */}
              <div className="pointer-events-none absolute top-3 right-3 left-3 z-20 flex items-start justify-between">
                {questionStates && (
                  <div className="pointer-events-auto rounded-xl bg-black/50 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-sm">
                    {questionStates.current} / {questionStates.total}
                  </div>
                )}
                {manager && next && (
                  <button
                    id="start-round"
                    onClick={handleNext}
                    disabled={isDisabled}
                    className={clsx(
                      "pointer-events-auto rounded-xl bg-white/20 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30",
                      isDisabled && "pointer-events-none opacity-50",
                    )}
                  >
                    {t(next)}
                  </button>
                )}
              </div>

              {/* Contenu principal */}
              {children}

              {/* Barre joueur en bas (overlay) */}
              {!manager && (
                <div className="absolute right-0 bottom-0 left-0 z-20 flex items-center gap-3 bg-black/60 px-3 py-2.5 backdrop-blur-md">
                  {/* Avatar */}
                  {player?.avatar && (
                    <GameAvatar
                      seed={player.avatar}
                      animated
                      className="border-primary h-10 w-10 shrink-0 rounded-full border-2"
                    />
                  )}
                  {/* Pseudo */}
                  <p className="flex-1 truncate text-sm font-bold text-white">
                    {player?.username}
                  </p>
                  {/* Points */}
                  <div className="anim-pop-in bg-primary/20 text-primary ring-primary/40 shrink-0 rounded-lg px-3 py-1 text-sm font-black ring-1">
                    <AnimatedPoints to={player?.points ?? 0} className="mr-1" />
                    pts
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </GameConfigContext.Provider>
  )
}

export default GameWrapper
