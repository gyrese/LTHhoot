import { EVENTS } from "@rahoot/common/constants"
import type { AnswerReveal } from "@rahoot/common/types/game"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { Maximize2, Minimize2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export function AnswerVideoControl({
  gameId,
  questionNumber,
  reveal,
  expanded,
  disabled,
}: {
  gameId: string
  questionNumber: number
  reveal?: AnswerReveal
  expanded: boolean
  disabled: boolean
}) {
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!reveal?.enabled || !reveal.videoId) {
    return null
  }

  const toggle = () => {
    if (!socket || !isConnected || pending || disabled) {
      return
    }

    setPending(true)
    setFailed(false)
    socket
      .timeout(5000)
      .emit(
        EVENTS.MANAGER.SET_ANSWER_VIDEO_EXPANDED,
        { gameId, questionNumber, expanded: !expanded },
        (error, result) => {
          setPending(false)
          setFailed(Boolean(error) || !result?.ok)
        },
      )
  }
  const Icon = expanded ? Minimize2 : Maximize2

  return (
    <div className="px-4 pt-4">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending || !isConnected}
        aria-pressed={expanded}
        aria-busy={pending}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-orange-400/50 bg-orange-500/15 px-4 py-3 text-base font-semibold text-orange-100 transition-colors hover:bg-orange-500/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        {t(expanded ? "game:answerVideo.reduce" : "game:answerVideo.expand")}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-red-200">
          {t("game:answerVideo.failed")}
        </p>
      )}
    </div>
  )
}
