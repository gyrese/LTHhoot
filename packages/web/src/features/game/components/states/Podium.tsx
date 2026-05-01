import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import useScreenSize from "@rahoot/web/hooks/useScreenSize"
import clsx from "clsx"
import { motion, AnimatePresence } from "motion/react"
import { useEffect, useState } from "react"
import ReactConfetti from "react-confetti"
import useSound from "use-sound"

type Props = {
  data: ManagerStatusDataMap["FINISHED"]
}

const usePodiumAnimation = (topLength: number) => {
  const [apparition, setApparition] = useState(0)

  const [sfxtThree] = useSound(SFX.PODIUM.THREE, { volume: 0.2 })
  const [sfxSecond] = useSound(SFX.PODIUM.SECOND, { volume: 0.2 })
  const [sfxRool, { stop: sfxRoolStop }] = useSound(SFX.PODIUM.SNEAR_ROOL, {
    volume: 0.2,
  })
  const [sfxFirst] = useSound(SFX.PODIUM.FIRST, { volume: 0.2 })

  useEffect(() => {
    const actions: Partial<Record<number, () => void>> = {
      4: () => {
        sfxRoolStop()
        sfxFirst()
      },
      3: sfxRool,
      2: sfxSecond,
      1: sfxtThree,
    }

    actions[apparition]?.()
  }, [apparition, sfxFirst, sfxSecond, sfxtThree, sfxRool, sfxRoolStop])

  useEffect(() => {
    if (topLength < 3) {
      setApparition(4)
      return
    }

    if (apparition >= 4) return

    const interval = setInterval(() => {
      setApparition((value) => value + 1)
    }, 2500)

    return () => clearInterval(interval)
  }, [apparition, topLength])

  return apparition
}

const medalStyles = [
  {
    bg: "bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700",
    border: "border-yellow-200",
    glow: "shadow-[0_0_30px_rgba(234,179,8,0.5)]",
  },
  {
    bg: "bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600",
    border: "border-slate-100",
    glow: "shadow-[0_0_20px_rgba(148,163,184,0.4)]",
  },
  {
    bg: "bg-gradient-to-br from-amber-500 via-amber-700 to-amber-900",
    border: "border-amber-400",
    glow: "shadow-[0_0_15px_rgba(180,83,9,0.3)]",
  },
]

const Medal = ({ rank }: { rank: number }) => {
  const style = medalStyles[rank - 1]

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      className={clsx(
        "relative flex aspect-square size-16 items-center justify-center rounded-full border-4 text-3xl font-black text-white md:size-20 md:text-4xl",
        style.bg,
        style.border,
        style.glow,
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full opacity-30">
        <div className="absolute -left-full top-0 h-full w-full skew-x-[-45deg] bg-gradient-to-r from-transparent via-white to-transparent animate-[shine_2s_infinite]" />
      </div>
      <span style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>{rank}</span>
    </motion.div>
  )
}

const PodiumPlace = ({
  player,
  rank,
  height,
  show,
  apparition,
}: {
  player: any
  rank: number
  height: string
  show: boolean
  apparition: number
}) => {
  const isFirst = rank === 1
  const delay = isFirst ? 0.5 : 0

  return (
    <div className="flex w-full flex-col items-center px-2">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <motion.div
                animate={isFirst ? { y: [0, -10, 0] } : {}}
                transition={isFirst ? { repeat: Infinity, duration: 4, ease: "easeInOut" } : {}}
                className={clsx(
                  "relative h-24 w-24 overflow-hidden rounded-full border-4 bg-white shadow-2xl md:h-32 md:w-32",
                  isFirst ? "border-yellow-400" : rank === 2 ? "border-slate-300" : "border-amber-600",
                )}
              >
                <img
                  alt={player.username}
                  className="h-full w-full object-cover"
                  src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.avatar || player.username}`}
                />
              </motion.div>
              {isFirst && apparition >= 4 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-6 -right-6 text-5xl"
                >
                  👑
                </motion.div>
              )}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: apparition >= 4 ? 1 : 0.6 }}
              className={clsx(
                "text-center text-xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] md:text-3xl",
                apparition >= 4 && isFirst && "animate-bounce",
              )}
            >
              {player.username}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ height: "0%" }}
        animate={{ height: show ? height : "0%" }}
        transition={{ type: "spring", stiffness: 50, damping: 15, delay }}
        className={clsx(
          "relative mt-4 flex w-full flex-col items-center gap-4 rounded-t-2xl pt-8 shadow-2xl backdrop-blur-xl",
          isFirst ? "z-30 bg-white/20 border-t border-x border-white/30" : "z-10 bg-white/10 border-t border-x border-white/20",
        )}
      >
        <Medal rank={rank} />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: show ? 1 : 0 }}
          className="text-2xl font-black text-white md:text-4xl"
        >
          {player.points}
        </motion.p>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-2xl" />
      </motion.div>
    </div>
  )
}

const Podium = ({ data: { subject, top } }: Props) => {
  const apparition = usePodiumAnimation(top.length)
  const { salonImage } = useManagerStore()
  const { width, height } = useScreenSize()

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-slate-950 p-4 md:p-8">
      {/* Background with Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none">
        {salonImage ? (
          <>
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 blur-sm" style={{ backgroundImage: `url(${salonImage})` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-950 to-purple-950" />
        )}
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      {apparition >= 4 && (
        <ReactConfetti
          width={width}
          height={height}
          className="h-full w-full z-50"
          colors={['#FFD700', '#C0C0C0', '#CD7F32', '#FFFFFF']}
        />
      )}

      <motion.h2
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 text-center text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] md:text-6xl"
      >
        {subject}
      </motion.h2>

      <div className="relative z-20 flex w-full max-w-5xl flex-1 items-end justify-center pb-8">
        <div className="grid w-full grid-cols-3 items-end gap-0 md:gap-4">
          {/* 2nd Place */}
          {top[1] && (
            <PodiumPlace
              player={top[1]}
              rank={2}
              height="50%"
              show={apparition >= 2}
              apparition={apparition}
            />
          )}

          {/* 1st Place */}
          <PodiumPlace
            player={top[0]}
            rank={1}
            height="65%"
            show={apparition >= 3}
            apparition={apparition}
          />

          {/* 3rd Place */}
          {top[2] && (
            <PodiumPlace
              player={top[2]}
              rank={3}
              height="35%"
              show={apparition >= 1}
              apparition={apparition}
            />
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}} />
    </div>
  )
}

export default Podium
