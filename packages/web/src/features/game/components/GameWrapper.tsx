import { EVENTS } from "@rahoot/common/constants"
import { STATUS, type Status } from "@rahoot/common/types/game/status"
import { POWER_UP_CATALOG, POWER_UP_TYPE, type PowerUp } from "@rahoot/common/types/powerup"
import background from "@rahoot/web/assets/background.png"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { MANAGER_SKIP_BTN } from "@rahoot/web/features/game/utils/constants"
import AnimatedPoints from "@rahoot/web/features/game/components/AnimatedPoints"
import EveningInterstitiel from "@rahoot/web/features/game/components/states/EveningInterstitiel"
import PowerUpBar from "@rahoot/web/features/game/components/PowerUpBar"
import PowerUpEarnedToast from "@rahoot/web/features/game/components/PowerUpEarnedToast"
import PowerUpConfirmDrawer from "@rahoot/web/features/game/components/PowerUpConfirmDrawer"
import PowerUpEffectToast from "@rahoot/web/features/game/components/PowerUpEffectToast"
import clsx from "clsx"
import { createContext, useContext, type PropsWithChildren, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { AnimatePresence, motion } from "motion/react"

type EveningLeaderboardEntry = {
  id: string
  username: string
  avatar?: string
  points: number
  rank: number
}

type EveningData = {
  gameId: string
  quizIndex: number
  totalQuizzes: number
  subject: string
  leaderboard: EveningLeaderboardEntry[]
}

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
  const { isConnected, socket } = useSocket()
  const { player, gameId: playerGameId, updatePoints } = usePlayerStore()
  const { gameId: managerGameId } = useManagerStore()
  const { questionStates, setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()
  const [isDisabled, setIsDisabled] = useState(false)
  const [eveningData, setEveningData] = useState<EveningData | null>(null)
  const [powerUps, setPowerUps] = useState<PowerUp[]>([])
  const [earnedPowerUp, setEarnedPowerUp] = useState<PowerUp | null>(null)
  const [drawerPowerUp, setDrawerPowerUp] = useState<PowerUp | null>(null)
  const [otherPlayers, setOtherPlayers] = useState<{ id: string; username: string; avatar?: string }[]>([])
  const next = statusName ? MANAGER_SKIP_BTN[statusName] : null
  const activeGameId = managerGameId ?? playerGameId

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

  useEvent(EVENTS.EVENING.QUIZ_COMPLETE, (data) => {
    if (!activeGameId) {
      return
    }

    setEveningData({ gameId: activeGameId, ...data })
  })

  useEvent(EVENTS.POWER_UP.EARNED, (powerUp) => {
    setPowerUps((prev) => [...prev.slice(-2), powerUp])
    setEarnedPowerUp(powerUp)
  })

  useEvent(EVENTS.POWER_UP.INVENTORY, (inventory) => {
    setPowerUps(inventory)
  })

  // Demander l'inventaire au mount et aux changements de phase (joueur uniquement)
  useEffect(() => {
    if (!manager && socket) {
      socket.emit(EVENTS.POWER_UP.GET_INVENTORY)
    }
  }, [manager, socket, statusName])

  const [globalFlash, setGlobalFlash] = useState<string | null>(null)

  useEvent(EVENTS.PLAYER.SUCCESS_RECONNECT, (data) => {
    if (data.players) {
      const currentUsername = player?.username || data.player.username
      setOtherPlayers(data.players.filter((p) => p.username !== currentUsername))
    }
  })

  useEvent(EVENTS.POWER_UP.EFFECT, (effect) => {
    // Les power-ups self-only (effet uniquement sur l'activateur) ne sont pas
    // affichés si ce n'est pas le joueur concerné ou le manager
    const meta = POWER_UP_CATALOG[effect.type]

    if (meta?.target === "SELF" && !manager && effect.activatedByUsername !== player?.username) {
      return
    }

    toast.custom(() => <PowerUpEffectToast effect={effect} />, { duration: 4000 })

    // Flash fullscreen pour les effets globaux légendaires
    if (effect.type === POWER_UP_TYPE.APOCALYPSE) {
      setGlobalFlash("apocalypse")
      setTimeout(() => setGlobalFlash(null), 1500)
    }

    // Si on est un joueur et qu'on fait partie des victimes, on met à jour nos points
    if (!manager && player) {
      const affectedSelf = effect.affectedPlayers.find((p) => p.username === player.username)

      if (affectedSelf) {
        const currentPoints = player.points ?? 0
        updatePoints(currentPoints + affectedSelf.pointsDelta)
      }
    }
  })

  useEvent(EVENTS.GAME.NEW_PLAYER, (newPlayer) => {
    if (player && newPlayer.username === player.username) {
      return
    }

    setOtherPlayers((prev) => [
      ...prev.filter((p) => p.id !== newPlayer.id),
      newPlayer,
    ])
  })

  useEvent(EVENTS.GAME.REMOVE_PLAYER, (playerId) => {
    setOtherPlayers((prev) => prev.filter((p) => p.id !== playerId))
  })

  useEffect(() => {
    setIsDisabled(false)

    if (statusName === STATUS.SHOW_START || statusName === STATUS.SHOW_ROOM) {
      setEveningData(null)
    }

    if (statusName === STATUS.SHOW_ROOM) {
      setQuestionStates(null)
    }
  }, [statusName, setQuestionStates])

  const handleNext = () => {
    if (isDisabled) {
      return
    }
    setIsDisabled(true)
    onNext?.()
  }

  useEffect(() => {
    if (!manager || !next) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA" ||
          document.activeElement?.getAttribute("contenteditable") === "true"
        ) {
          return
        }

        e.preventDefault()
        handleNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [manager, next, isDisabled, handleNext])

  const handleUsePowerUp = (powerUp: PowerUp) => {
    setDrawerPowerUp(powerUp)
  }

  const handleConfirmPowerUp = (targetIds?: string[]) => {
    if (!drawerPowerUp || !playerGameId) {
      return
    }

    socket?.emit(EVENTS.POWER_UP.USE, {
      gameId: playerGameId,
      powerUpId: drawerPowerUp.id,
      targetIds,
    })
    setPowerUps((prev) => prev.filter((p) => p.id !== drawerPowerUp.id))
    setDrawerPowerUp(null)
  }

  const isRoomScreen = !statusName || statusName === STATUS.SHOW_ROOM

  return (
    <GameConfigContext.Provider value={{ isHost: Boolean(manager) }}>
      <section
        className="relative flex h-dvh flex-col overflow-hidden bg-slate-950"
        style={
          !isRoomScreen
            ? {
                backgroundImage: "url(/bg-salon.png)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
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

              {/* Interstitiel soirée */}
              {eveningData && (
                <EveningInterstitiel
                  gameId={eveningData.gameId}
                  quizIndex={eveningData.quizIndex}
                  totalQuizzes={eveningData.totalQuizzes}
                  subject={eveningData.subject}
                  leaderboard={eveningData.leaderboard}
                  onContinue={() => setEveningData(null)}
                />
              )}

              {/* Toast power-up obtenu */}
              <AnimatePresence>
                {!manager && earnedPowerUp && (
                  <PowerUpEarnedToast
                    powerUp={earnedPowerUp}
                    onDismiss={() => setEarnedPowerUp(null)}
                  />
                )}
              </AnimatePresence>

              {/* Drawer de confirmation */}
              <PowerUpConfirmDrawer
                powerUp={drawerPowerUp}
                players={otherPlayers}
                onConfirm={handleConfirmPowerUp}
                onCancel={() => setDrawerPowerUp(null)}
              />

              {/* Flash fullscreen pour effets globaux légendaires (manager uniquement) */}
              <AnimatePresence>
                {manager && globalFlash === "apocalypse" && (
                  <motion.div
                    key="apocalypse-flash"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.7, 0.3, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, times: [0, 0.15, 0.4, 1] }}
                    className="pointer-events-none fixed inset-0 z-60"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(220,38,38,0.9) 0%, rgba(0,0,0,0.7) 70%)",
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Barre joueur en bas (overlay) — contient aussi les power-ups */}
              {!manager && (
                <div className="absolute right-0 bottom-0 left-0 z-20 flex items-center gap-3 bg-black/60 px-3 py-3 backdrop-blur-md">
                  {/* Avatar */}
                  {player?.avatar && (
                    <GameAvatar
                      seed={player.avatar}
                      animated
                      className="border-primary h-11 w-11 shrink-0 rounded-full border-2"
                    />
                  )}
                  {/* Pseudo */}
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                    {player?.username}
                  </p>
                  {/* Power-ups inline */}
                  {powerUps.length > 0 && (
                    <PowerUpBar powerUps={powerUps} onUse={handleUsePowerUp} compact />
                  )}
                  {/* Points */}
                  <div className="anim-pop-in bg-primary/20 text-primary ring-primary/40 shrink-0 rounded-lg px-3 py-1.5 text-sm font-black ring-1">
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
