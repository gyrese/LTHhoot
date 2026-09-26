import { EVENTS } from "@rahoot/common/constants"
import {
  SOLO_DRAW_POOL_SIZE,
  isSoloResult,
} from "@rahoot/common/utils/result-kind"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useResultModal } from "@rahoot/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { Loader2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const MEDAL_CLASSES = [
  "bg-amber-400 text-white",
  "bg-slate-300 text-slate-800",
  "bg-amber-700 text-white",
]

const rankBadgeClass = (idx: number) =>
  MEDAL_CLASSES[idx] ?? "bg-white/10 text-white/70"

// Classement complet des participants. C'est la vue par défaut d'un résultat
// solo : le détail question par question n'a de sens qu'ensuite.
const ResultModalRanking = () => {
  const { socket } = useSocket()
  const { result, total, getPlayerCorrectCount } = useResultModal()
  const { t } = useTranslation()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  // Suppression envoyée, en attente du résultat réécrit par le serveur
  // (RESULTS.DATA) : le toast de succès n'est affiché qu'à ce moment-là.
  const [deleting, setDeleting] = useState<string | null>(null)
  const isSolo = isSoloResult(result)

  const players = [...result.players].sort((a, b) => b.points - a.points)

  useEffect(() => {
    if (deleting && !result.players.some((p) => p.username === deleting)) {
      toast.success(
        t("manager:result.participationDeleted", { name: deleting }),
      )
      setDeleting(null)
    }
  }, [result])

  const handleDelete = (username: string) => {
    socket?.emit(EVENTS.RESULTS.DELETE_PLAYER, {
      resultId: result.id,
      username,
    })
    setPendingDelete(null)
    setDeleting(username)
  }

  if (players.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/60 italic">
        {t("manager:result.ranking.none")}
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 shadow-sm">
        <tr className="border-b border-white/10 bg-slate-900 text-left text-xs font-semibold tracking-wide text-white/60 uppercase">
          <th className="w-14 px-5 py-2.5">#</th>
          <th className="px-4 py-2.5">{t("manager:result.table.player")}</th>
          {isSolo && (
            <th className="px-4 py-2.5">
              {t("manager:result.ranking.contact")}
            </th>
          )}
          <th className="px-4 py-2.5 text-right">
            {t("manager:result.stats.correctAnswers")}
          </th>
          <th className="px-4 py-2.5 text-right">
            {t("manager:result.table.points")}
          </th>
          <th className="w-12 px-4 py-2.5" />
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {players.map((player, idx) => {
          const isEligible = isSolo && idx < SOLO_DRAW_POOL_SIZE
          const isPendingDelete = pendingDelete === player.username
          const correct = getPlayerCorrectCount(player.username)

          return (
            <tr
              key={player.username}
              className={clsx(
                "hover:bg-white/5",
                isEligible && "bg-amber-500/10",
                isPendingDelete && "bg-red-500/10",
              )}
            >
              <td className="px-5 py-2.5">
                <span
                  className={clsx(
                    "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    rankBadgeClass(idx),
                  )}
                >
                  {idx + 1}
                </span>
              </td>
              <td className="px-4 py-2.5 font-medium text-white">
                {player.username}
                {isEligible && (
                  <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 uppercase">
                    {t("manager:result.draw")}
                  </span>
                )}
              </td>
              {isSolo && (
                <td className="px-4 py-2.5 text-xs text-orange-300">
                  {player.socialContact || (
                    <span className="text-white/40">—</span>
                  )}
                </td>
              )}
              <td className="px-4 py-2.5 text-right text-white/70 tabular-nums">
                {correct === null ? (
                  <span className="text-white/40">—</span>
                ) : (
                  `${correct} / ${total}`
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-white tabular-nums">
                {player.points.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right">
                {isPendingDelete ? (
                  <span className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="min-h-8 cursor-pointer rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-white/70 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
                    >
                      {t("common:cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(player.username)}
                      className="min-h-8 cursor-pointer rounded-lg bg-red-500 px-2 py-1 text-xs font-bold text-white hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
                    >
                      {t("common:delete")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(player.username)}
                    disabled={deleting === player.username}
                    title={t("manager:result.deleteParticipation")}
                    aria-label={t("manager:result.deleteParticipationNamed", {
                      name: player.username,
                    })}
                    className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none disabled:cursor-wait"
                  >
                    {deleting === player.username ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default ResultModalRanking
