import { EVENTS } from "@rahoot/common/constants"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import clsx from "clsx"
import { motion, AnimatePresence } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, Trophy } from "lucide-react"

type LeaderboardEntry = {
  id: string
  username: string
  avatar?: string
  points: number
  rank: number
}

type Props = {
  gameId: string
  quizIndex: number
  totalQuizzes: number
  subject: string
  leaderboard: LeaderboardEntry[]
  onContinue: () => void
}

const COUNTDOWN_SECONDS = 10

const rankMedal = (rank: number) => {
  if (rank === 1) {
    return "🥇"
  }

  if (rank === 2) {
    return "🥈"
  }

  if (rank === 3) {
    return "🥉"
  }

  return `#${rank}`
}

const EveningInterstitiel = ({ gameId, quizIndex, totalQuizzes, subject, leaderboard, onContinue }: Props) => {
  const { socket } = useSocket()
  const { isHost } = useGameConfig()
  const { player } = usePlayerStore()
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [visible, setVisible] = useState(false)

  const myEntry = leaderboard.find((e) => e.username === player?.username)

  useEffect(() => {
    setVisible(true)
  }, [])

  useEffect(() => {
    if (!isHost) {
      return undefined
    }

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          socket?.emit(EVENTS.EVENING.NEXT, { gameId })
          onContinue()

          return 0
        }

        return c - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isHost, gameId, onContinue, socket])

  const handleNext = () => {
    socket?.emit(EVENTS.EVENING.NEXT, { gameId })
    onContinue()
  }

  useEffect(() => {
    if (!isHost) {
      return undefined
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        handleNext()
      }
    }

    const handleGlobalClick = (e: MouseEvent) => {
      // Ignorer si ce n'est pas un clic gauche
      if (e.button !== 0) {
        return
      }

      const target = e.target as HTMLElement | null
      if (!target) {
        return
      }

      // Ignorer les clics sur les éléments interactifs
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("a") ||
        target.closest("[role='button']") ||
        target.closest(".cursor-pointer")
      ) {
        return
      }

      handleNext()
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("click", handleGlobalClick)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("click", handleGlobalClick)
    }
  }, [isHost, handleNext])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black/80 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex shrink-0 flex-col items-center gap-1 py-6 px-4">
            <div className="flex items-center gap-2 rounded-full bg-orange-500/20 px-4 py-1.5 text-sm font-bold text-orange-300 ring-1 ring-orange-500/40">
              <Trophy className="size-4" />
              {t("game:evening.quizComplete", "Quiz terminé !")}
            </div>
            <h2 className="mt-2 text-center text-2xl font-black text-white">
              {subject}
            </h2>
            <p className="text-sm text-white/50">
              {t("game:evening.progress", "Quiz {{current}} sur {{total}}", {
                current: quizIndex + 1,
                total: totalQuizzes,
              })}
            </p>
            {/* Barre de progression soirée */}
            <div className="mt-3 h-2 w-full max-w-xs rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-500"
                style={{ width: `${((quizIndex + 1) / totalQuizzes) * 100}%` }}
              />
            </div>
          </div>

          {/* Classement cumulatif */}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
            <h3 className="text-center text-sm font-bold text-white/60">
              {t("game:evening.cumulativeRanking", "Classement soirée")}
            </h3>
            <div className="mx-auto w-full max-w-md space-y-2">
              {leaderboard.slice(0, 8).map((entry, index) => {
                const isMe = entry.username === player?.username
                const isFirst = entry.rank === 1

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl px-4 py-3",
                      isFirst && "border border-yellow-500/30 bg-yellow-500/10",
                      !isFirst && isMe && "border border-orange-500/40 bg-orange-500/10",
                      !isFirst && !isMe && "bg-white/5",
                    )}
                  >
                    <span className="w-8 text-center text-lg">{rankMedal(entry.rank)}</span>
                    <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
                      <GameAvatar seed={entry.avatar || entry.username} className="h-full w-full" />
                    </div>
                    <p className={clsx("flex-1 truncate text-sm font-bold", isMe ? "text-orange-300" : "text-white")}>
                      {entry.username}
                      {isMe && (
                        <span className="ml-1 text-xs text-white/50">({t("game:you", "toi")})</span>
                      )}
                    </p>
                    <span className={clsx("text-sm font-black tabular-nums", isFirst ? "text-yellow-400" : "text-white")}>
                      {entry.points.toLocaleString()}
                    </span>
                  </motion.div>
                )
              })}
            </div>

            {/* Mon rang si hors top 8 */}
            {myEntry && myEntry.rank > 8 && (
              <div className="mx-auto w-full max-w-md">
                <p className="text-center text-xs text-white/40">···</p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center gap-3 rounded-2xl border border-orange-500/40 bg-orange-500/10 px-4 py-3"
                >
                  <span className="w-8 text-center text-sm font-bold text-white/60">#{myEntry.rank}</span>
                  <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
                    <GameAvatar seed={myEntry.avatar || myEntry.username} className="h-full w-full" />
                  </div>
                  <p className="flex-1 truncate text-sm font-bold text-orange-300">{myEntry.username}</p>
                  <span className="text-sm font-black tabular-nums text-white">{myEntry.points.toLocaleString()}</span>
                </motion.div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-center gap-4 border-t border-white/10 py-4 px-4">
            {isHost ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 rounded-2xl bg-orange-500 px-8 py-3 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-105 hover:bg-orange-400"
              >
                {t("game:evening.nextQuiz", "Quiz suivant")}
                <ChevronRight className="size-5" />
                <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-sm">{countdown}</span>
              </button>
            ) : (
              <p className="text-sm text-white/50">
                {t("game:evening.waitingHost", "En attente du prochain quiz…")}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default EveningInterstitiel
