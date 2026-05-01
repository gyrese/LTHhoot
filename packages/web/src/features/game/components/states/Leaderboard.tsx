import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import Fire from "@rahoot/web/features/game/components/icons/Fire"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

type Props = {
  data: ManagerStatusDataMap["SHOW_LEADERBOARD"]
}

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

const StreakBadge = ({ streak }: { streak: number }) => (
  <AnimatePresence>
    {streak >= 2 && (
      <motion.div
        key="streak"
        initial={{ opacity: 0, scale: 0.5, x: -10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.5, x: -10 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="ml-2 flex items-center gap-1 rounded-full bg-amber-700 p-1"
      >
        <Fire className="size-7" />
      </motion.div>
    )}
  </AnimatePresence>
)

const Leaderboard = ({
  data: { oldLeaderboard, leaderboard, roundLeaderboard },
}: Props) => {
  const [displayedPlayers, setDisplayedPlayers] = useState(roundLeaderboard)
  const [phase, setPhase] = useState<"round" | "adding" | "total">("round")
  const { t } = useTranslation()

  useEffect(() => {
    setDisplayedPlayers(roundLeaderboard)
    setPhase("round")

    const timer1 = setTimeout(() => {
      setPhase("adding")
    }, 2000)

    const timer2 = setTimeout(() => {
      setPhase("total")
      setDisplayedPlayers(leaderboard)
    }, 4000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [roundLeaderboard, leaderboard])

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-2">
      <h2 className="mb-6 text-5xl font-bold text-white drop-shadow-md">
        {phase === "round" ? t("game:roundRanking") : t("game:leaderboard")}
      </h2>
      <div className="flex w-full flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {displayedPlayers.map((player, index) => {
            const { id, username, streak, roundPoints } = player
            const oldPlayer = oldLeaderboard.find((p) => p.id === id)
            const oldPoints = oldPlayer?.points ?? 0
            const finalPoints = leaderboard.find((p) => p.id === id)?.points ?? 0

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
                  <span className="w-8 text-2xl opacity-50">#{index + 1}</span>
                  <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-white/50 bg-white/10">
                    <img
                      alt={username}
                      className="h-full w-full object-cover"
                      src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${
                        player.avatar || username
                      }`}
                    />
                  </div>
                  <span className="drop-shadow-md">
                    {username}
                    <StreakBadge streak={streak} />
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {phase === "round" ? (
                    <motion.span
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-yellow-300"
                    >
                      +{roundPoints}
                    </motion.span>
                  ) : phase === "adding" ? (
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
                  ) : (
                    <span className="drop-shadow-md">{finalPoints}</span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </section>
  )
}

export default Leaderboard
