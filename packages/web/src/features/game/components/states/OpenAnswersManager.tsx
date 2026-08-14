import { EVENTS } from "@rahoot/common/constants"
import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import { normalizeAnswer } from "@rahoot/common/utils/normalize-answer"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import clsx from "clsx"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

type Props = {
  data: ManagerStatusDataMap["SHOW_OPEN_ANSWERS"]
}

const OpenAnswersManager = ({
  data: { question, answers, totalPlayers, correctAnswers },
}: Props) => {
  const { socket } = useSocket()
  const { gameId } = useManagerStore()
  const { t } = useTranslation()
  const [validating, setValidating] = useState<string | null>(null)

  useEffect(() => {
    console.log("[MOUNT] OpenAnswersManager")

    return () => console.log("[UNMOUNT] OpenAnswersManager")
  }, [])
  const answered = answers.length
  const noAnswer = totalPlayers - answered

  useEvent(EVENTS.GAME.STATUS, () => {
    setValidating(null)
  })

  const handleValidate = (text: string) => {
    if (!gameId || !socket) {
      return
    }

    setValidating(text)
    socket?.emit(EVENTS.MANAGER.VALIDATE_OPEN_ANSWER, {
      gameId,
      data: { text },
    })
  }

  const unique = Array.from(
    new Map(answers.map((a) => [normalizeAnswer(a.text), a])).values(),
  )

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-5 pb-20">
      <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
        {question}
      </h2>

      {correctAnswers && correctAnswers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {correctAnswers.map((ca) => (
            <span
              key={ca}
              className="rounded-full bg-green-500/30 px-4 py-1 text-sm font-bold text-green-300 ring-1 ring-green-400/40"
            >
              ✓ {ca}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs font-bold tracking-widest text-white/40 uppercase">
        {t("game:openAnswers.clickToValidate")} — {answered} / {totalPlayers}{" "}
        {t("game:openAnswers.players")}
      </p>

      <div className="flex w-full max-w-5xl flex-wrap justify-center gap-3">
        {unique.map((answer) => {
          const key = normalizeAnswer(answer.text)
          const sameAnswers = answers.filter(
            (a) => normalizeAnswer(a.text) === key,
          )
          const count = sameAnswers.length
          const players = sameAnswers.map((a) => a.playerName)

          return (
            <button
              key={answer.text}
              disabled={answer.isCorrect || validating === answer.text}
              onClick={() => handleValidate(answer.text)}
              className={clsx(
                "flex flex-col items-center gap-1 rounded-2xl px-6 py-4 text-center shadow-xl transition-all",
                answer.isCorrect
                  ? "anim-pop-in cursor-default bg-green-500 ring-4 ring-green-300/60 drop-shadow-[0_0_16px_rgba(34,197,94,0.7)]"
                  : "cursor-pointer bg-white/10 ring-1 ring-white/20 backdrop-blur-md hover:scale-105 hover:bg-white/20 active:scale-95",
                validating === answer.text && "opacity-60",
              )}
            >
              <span className="text-xl font-black text-white">
                {answer.isCorrect && "✓ "}
                {answer.text}
                {count > 1 && (
                  <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-sm">
                    ×{count}
                  </span>
                )}
              </span>
              <span className="text-xs text-white/60">
                {players.join(", ")}
              </span>
            </button>
          )
        })}
      </div>

      {noAnswer > 0 && (
        <p className="text-sm text-white/30">
          {noAnswer} {t("game:openAnswers.noAnswer")}
        </p>
      )}
    </div>
  )
}

export default OpenAnswersManager
