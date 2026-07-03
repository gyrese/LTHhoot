import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import StreakBadge from "@rahoot/web/features/game/components/StreakBadge"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"

type Props = {
  data: ManagerStatusDataMap["SHOW_LEADERBOARD"]
}

const WINNING_ANIMATION_STATES = ["waving"] as const
const WAITING_ANIMATION_STATES = ["waiting"] as const
const FAILED_ANIMATION_STATES = ["failed"] as const

const AnimatedPoints = ({ from, to }: { from: number; to: number }) => {
  const spring = useSpring(from, { stiffness: 1000, damping: 30 })
  const display = useTransform(spring, (value) => Math.round(value))
  const [displayValue, setDisplayValue] = useState(from)

  useEffect(() => {
    spring.set(to)
    const unsubscribe = display.on("change", (latest) => {
      setDisplayValue(latest)
    })

    return unsubscribe
  }, [to, spring, display])

  return <span className="drop-shadow-md">{displayValue}</span>
}

const Leaderboard = ({
  data: {
    oldLeaderboard,
    leaderboard,
    roundLeaderboard,
    totalPlayers,
  },
}: Props) => {
  const [displayedPlayers, setDisplayedPlayers] = useState(roundLeaderboard)
  const [phase, setPhase] = useState<"round" | "adding" | "total">("round")
  const { t } = useTranslation()
  const { salonImage } = useManagerStore()

  useEffect(() => {
    setDisplayedPlayers(roundLeaderboard)
    setPhase("round")

    const timer1 = setTimeout(() => {
      setPhase("adding")
    }, 2000)

    const timer2 = setTimeout(() => {
      setPhase("total")
      setDisplayedPlayers(leaderboard as typeof roundLeaderboard)
    }, 4000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [roundLeaderboard, leaderboard])

  return (
    <section className="relative flex flex-1 flex-col justify-center overflow-hidden bg-slate-950">
      {/* Background with Ambient Glow matching Podium style */}
      <div className="pointer-events-none absolute inset-0">
        {salonImage ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 blur-sm"
              style={{ backgroundImage: `url(${salonImage})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-950 to-purple-950" />
        )}
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-2">
        <h2 className="mb-6 text-5xl font-bold text-white drop-shadow-md">
          {phase === "round" ? t("game:roundRanking") : t("game:leaderboard")}
        </h2>
        <div className="flex w-full flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {displayedPlayers.map((player, index) => {
              const { id, username, streak, roundPoints } = player
              const oldPlayer = oldLeaderboard.find((p) => p.id === id)
              const oldPoints = oldPlayer?.points ?? 0
              const finalPoints =
                leaderboard.find((p) => p.id === id)?.points ?? 0
              const displayRank = index + 1
              let animationStates:
                | typeof WINNING_ANIMATION_STATES
                | typeof WAITING_ANIMATION_STATES
                | typeof FAILED_ANIMATION_STATES = WAITING_ANIMATION_STATES

              if (displayRank <= 3) {
                animationStates = WINNING_ANIMATION_STATES
              } else if (totalPlayers > 1 && displayRank === totalPlayers) {
                animationStates = FAILED_ANIMATION_STATES
              }

              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{
                    layout: { type: "spring", stiffness: 350, damping: 25 },
                  }}
                  className="bg-primary/90 flex w-full items-center justify-between rounded-xl p-4 text-3xl font-bold text-white shadow-2xl backdrop-blur-sm"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 text-2xl opacity-50">
                      #{displayRank}
                    </span>
                    <GameAvatar
                      seed={player.avatar || username}
                      animated
                      animationStates={animationStates}
                      className="h-12 w-12 rounded-full border-2 border-white/50"
                    />
                    <span className="drop-shadow-md">
                      {username}
                      <StreakBadge streak={streak} />
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {phase === "round" && (
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-yellow-300"
                      >
                        +{roundPoints}
                      </motion.span>
                    )}
                    {phase === "adding" && (
                      <div className="flex flex-col items-end">
                        <AnimatedPoints from={oldPoints} to={finalPoints} />
                        <motion.span
                          initial={{ y: 0, opacity: 1 }}
                          animate={{ y: -20, opacity: 0 }}
                          className="text-sm text-yellow-300"
                        >
                          +{roundPoints}
                        </motion.span>
                      </div>
                    )}
                    {phase === "total" && (
                      <span className="drop-shadow-md">{finalPoints}</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

export default Leaderboard
