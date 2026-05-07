import type { SlideElement } from "@rahoot/common/types/game"
import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import SlideCanvas from "@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import Fire from "@rahoot/web/features/game/components/icons/Fire"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEffect, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"

const noopChange = (_els: SlideElement[]) => undefined
const noopSelect = (_id: string | undefined) => undefined

const DEFAULT_BG: CSSProperties = {
  background: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)",
}

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
  data: {
    oldLeaderboard,
    leaderboard,
    roundLeaderboard,
    totalPlayers,
    background,
    backgroundOpacity,
    elements,
  },
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

  let bgStyle: CSSProperties = DEFAULT_BG

  if (background?.type === "image") {
    bgStyle = {
      backgroundImage: `url(${background.value})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
  } else if (background?.type === "color") {
    bgStyle = { backgroundColor: background.value }
  }

  return (
    <section className="relative flex flex-1 flex-col justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0"
        style={{ ...bgStyle, opacity: backgroundOpacity ?? 0.5 }}
      />

      {elements && elements.length > 0 && (
        <div className="pointer-events-none absolute inset-0">
          <SlideCanvas
            elements={elements}
            onChange={noopChange}
            selectedId={undefined}
            onSelect={noopSelect}
            readOnly
            noBackground
          />
        </div>
      )}

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
              const animationStates =
                displayRank <= 3
                  ? WINNING_ANIMATION_STATES
                  : totalPlayers > 1 && displayRank === totalPlayers
                    ? FAILED_ANIMATION_STATES
                    : WAITING_ANIMATION_STATES

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
      </div>
    </section>
  )
}

export default Leaderboard
