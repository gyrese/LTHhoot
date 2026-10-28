import { useEffect, useRef, useState } from "react"
import { Loader2, PartyPopper, Trophy, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"
import { EVENTS } from "@rahoot/common/constants"
import type { EveningSummary } from "@rahoot/common/types/evening"
import Modal from "@rahoot/web/components/Modal"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"

type Props = { initialEvening?: EveningSummary | null }

export default function EveningTrackingControl({ initialEvening }: Props) {
  const { t } = useTranslation()
  const { socket, isConnected } = useSocket()
  const [evening, setEvening] = useState(initialEvening ?? null)
  const [isOpen, setIsOpen] = useState(false)
  const [pending, setPending] = useState<"open" | "close" | null>(null)
  const request = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = Boolean(evening && !evening.endedAt)
  const connected = Boolean(socket?.connected && isConnected)
  const text = (key: string, options?: Record<string, unknown>) =>
    t(`manager:eveningTracking.${key}`, options)

  useEffect(() => {
    setEvening(initialEvening ?? null)
  }, [initialEvening])
  useEffect(
    () => () => {
      request.current += 1
      if (timer.current) {
        clearTimeout(timer.current)
      }
    },
    [],
  )
  useEvent(EVENTS.MANAGER.CONFIG, (config) => {
    if (!config.role || config.role === "admin") {
      setEvening(config.evening ?? null)
    }
  })
  useEvent(EVENTS.EVENING.STATE, setEvening)

  const command = (action: "open" | "close") => {
    if (!socket || !connected || pending) {
      return
    }
    request.current += 1
    const token = request.current
    setPending(action)
    timer.current = setTimeout(() => {
      if (token !== request.current) {
        return
      }
      request.current += 1
      timer.current = null
      setPending(null)
      toast.error(text("timeout"))
    }, 10000)
    const acknowledge = (
      result: { evening: EveningSummary } | { error: string },
    ) => {
      if (token !== request.current) {
        return
      }
      request.current += 1
      if (timer.current) {
        clearTimeout(timer.current)
      }
      timer.current = null
      setPending(null)
      if ("error" in result) {
        toast.error(t(result.error))
        return
      }
      setEvening(result.evening)
      if (action === "close") {
        setIsOpen(true)
      } else {
        toast.success(text("started"), { duration: 6000 })
      }
    }
    if (action === "open") {
      socket.emit(EVENTS.EVENING.OPEN, acknowledge)
    } else {
      socket.emit(EVENTS.EVENING.CLOSE, acknowledge)
    }
  }
  const close = () => {
    if (pending !== "close") {
      setIsOpen(false)
    }
  }
  const winners =
    evening?.leaderboard.filter((player) => player.rank === 1) ?? []
  const finished = Boolean(evening?.endedAt)

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!connected || pending !== null}
          aria-busy={pending !== null}
          aria-label={text(active ? "finish" : "start")}
          onClick={() => (active ? setIsOpen(true) : command("open"))}
          className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-orange-400/40 bg-orange-400/10 px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <Loader2
              className="size-4 shrink-0 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <PartyPopper className="size-4 shrink-0" aria-hidden="true" />
          )}
          <span className="sm:hidden">
            {text(active ? "finishShort" : "startShort")}
          </span>
          <span className="hidden sm:inline">
            {text(active ? "finish" : "start")}
          </span>
          {active && (
            <span className="hidden shrink-0 rounded bg-orange-300/10 px-1.5 py-0.5 text-xs tabular-nums sm:inline">
              {text("quizCount", { count: evening?.quizCount ?? 0 })}
            </span>
          )}
        </button>
        {finished && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label={text("review")}
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 px-2 text-sm text-slate-300 hover:text-white"
          >
            <Trophy className="size-4" aria-hidden="true" />
            <span className="hidden lg:inline">{text("review")}</span>
          </button>
        )}
      </div>
      {isOpen && evening && (
        <Modal
          label={text(finished ? "finalTitle" : "provisionalTitle")}
          onClose={close}
          closeOnOverlay={pending !== "close"}
          className="flex max-h-[85dvh] w-full max-w-xl min-w-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 text-white shadow-2xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-5">
            <div className="min-w-0">
              <h2 className="text-xl font-bold">
                {text(finished ? "finalTitle" : "provisionalTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {text("explanation")}
              </p>
            </div>
            <button
              type="button"
              disabled={pending === "close"}
              onClick={close}
              aria-label={t("common:close")}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-40"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 min-w-0 overflow-y-auto p-5">
            <p className="mb-5 text-sm text-slate-300 tabular-nums">
              {text("quizCount", { count: evening.quizCount })} ·{" "}
              {text("participants", { count: evening.leaderboard.length })}
            </p>
            {finished && winners.length > 0 && (
              <div className="mb-5 rounded-xl border border-orange-300/25 bg-orange-300/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-orange-200">
                  <Trophy className="size-5 shrink-0" />
                  {text(winners.length > 1 ? "winners" : "winner")}
                </p>
                <p className="mt-2 text-xl font-bold break-words">
                  {winners.map((player) => player.username).join(" · ")}
                </p>
              </div>
            )}
            {evening.leaderboard.length === 0 ? (
              <p className="rounded-xl border border-white/10 p-5 text-sm leading-relaxed text-slate-300">
                {text(finished ? "emptyFinished" : "empty")}
              </p>
            ) : (
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <caption className="sr-only">
                    {text(finished ? "finalTitle" : "provisionalTitle")}
                  </caption>
                  <thead className="text-xs text-slate-400">
                    <tr>
                      <th scope="col" className="pr-3 pb-3">
                        {text("rank")}
                      </th>
                      <th scope="col" className="pr-3 pb-3">
                        {text("player")}
                      </th>
                      <th scope="col" className="pr-3 pb-3 text-right">
                        {text("points")}
                      </th>
                      <th scope="col" className="pb-3 text-right">
                        {text("quizzes")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {evening.leaderboard.map((player) => (
                      <tr key={player.id} className="border-t border-white/10">
                        <td className="py-3 pr-3 text-slate-400">
                          {player.rank}
                        </td>
                        <th
                          scope="row"
                          className="max-w-48 py-3 pr-3 font-medium break-words"
                        >
                          {player.username}
                        </th>
                        <td className="py-3 pr-3 text-right font-semibold text-orange-200">
                          {player.points.toLocaleString()}
                        </td>
                        <td className="py-3 text-right text-slate-300">
                          {player.quizCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/10 p-5">
            <button
              type="button"
              disabled={pending === "close"}
              onClick={close}
              className="min-h-11 rounded-lg border border-white/20 px-4 text-sm hover:bg-white/10 disabled:opacity-40"
            >
              {t("common:close")}
            </button>
            {!finished && (
              <button
                type="button"
                disabled={!connected || pending !== null}
                onClick={() => command("close")}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending === "close" && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                {text("confirmFinish")}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
