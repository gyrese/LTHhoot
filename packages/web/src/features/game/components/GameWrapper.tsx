import { EVENTS } from "@rahoot/common/constants"
import { STATUS, type Status } from "@rahoot/common/types/game/status"
import background from "@rahoot/web/assets/background.png"
import Loader from "@rahoot/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { MANAGER_SKIP_BTN } from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import { type PropsWithChildren, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

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
    <section
      className="relative flex h-dvh flex-col overflow-hidden"
      style={{ backgroundImage: "url(/bg-salon.png)", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {/* Fond garage uniquement sur l'écran d'attente */}
      {isRoomScreen && (
        <div
          className="absolute inset-0 pointer-events-none select-none bg-cover bg-center bg-no-repeat opacity-65"
          style={{ backgroundImage: `url(${background})` }}
        />
      )}
      {/* Overlay sombre pendant les questions */}
      {!isRoomScreen && (
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
      )}

      <div className="z-10 flex w-full flex-1 flex-col">
        {!isConnected && !statusName ? (
          <div className="flex h-full w-full flex-1 flex-col items-center justify-center">
            <Loader className="h-30" />
            <h1 className="text-4xl font-bold text-white">{t("common:connecting")}</h1>
          </div>
        ) : (
          <>
            {/* Overlay compteur + bouton suivant (superposé, pas une barre) */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-start justify-between pointer-events-none">
              {questionStates && (
                <div className="pointer-events-auto rounded-xl bg-black/50 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-sm">
                  {questionStates.current} / {questionStates.total}
                </div>
              )}
              {manager && next && (
                <button
                  onClick={handleNext}
                  disabled={isDisabled}
                  className={clsx(
                    "pointer-events-auto rounded-xl bg-white/20 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/30 transition-colors",
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
              <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between bg-black/50 px-4 py-2 backdrop-blur-sm">
                <p className="font-bold text-white">{player?.username}</p>
                <div className="rounded-lg bg-white/20 px-3 py-1 text-sm font-bold text-white">
                  {player?.points}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default GameWrapper
