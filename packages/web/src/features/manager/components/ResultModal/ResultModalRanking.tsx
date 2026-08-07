import { EVENTS } from "@rahoot/common/constants"
import {
  SOLO_DRAW_POOL_SIZE,
  isSoloResult,
} from "@rahoot/common/utils/result-kind"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useResultModal } from "@rahoot/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"

const MEDAL_CLASSES = [
  "bg-amber-400 text-white",
  "bg-slate-300 text-slate-800",
  "bg-amber-700 text-white",
]

const rankBadgeClass = (idx: number) =>
  MEDAL_CLASSES[idx] ?? "bg-gray-100 text-gray-500"

// Classement complet des participants. C'est la vue par défaut d'un résultat
// solo : le détail question par question n'a de sens qu'ensuite.
const ResultModalRanking = () => {
  const { socket } = useSocket()
  const { result, total, getPlayerCorrectCount } = useResultModal()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const isSolo = isSoloResult(result)

  const players = [...result.players].sort((a, b) => b.points - a.points)

  const handleDelete = (username: string) => {
    socket?.emit(EVENTS.RESULTS.DELETE_PLAYER, {
      resultId: result.id,
      username,
    })
    setPendingDelete(null)
    toast.success(`Participation de ${username} supprimée`)
  }

  if (players.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-gray-400 italic">
        Aucun participant enregistré pour ce quiz.
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 shadow-sm">
        <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
          <th className="w-14 px-5 py-2.5">#</th>
          <th className="px-4 py-2.5">Joueur</th>
          {isSolo && <th className="px-4 py-2.5">Contact</th>}
          <th className="px-4 py-2.5 text-right">Bonnes réponses</th>
          <th className="px-4 py-2.5 text-right">Points</th>
          <th className="w-12 px-4 py-2.5" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {players.map((player, idx) => {
          const isEligible = isSolo && idx < SOLO_DRAW_POOL_SIZE
          const isPendingDelete = pendingDelete === player.username
          const correct = getPlayerCorrectCount(player.username)

          return (
            <tr
              key={player.username}
              className={clsx(
                "hover:bg-gray-50",
                isEligible && "bg-amber-50/60",
                isPendingDelete && "bg-red-50",
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
              <td className="px-4 py-2.5 font-medium text-gray-900">
                {player.username}
                {isEligible && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 uppercase">
                    Tirage
                  </span>
                )}
              </td>
              {isSolo && (
                <td className="px-4 py-2.5 text-xs text-orange-600">
                  {player.socialContact || (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              )}
              <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                {correct === null ? (
                  <span className="text-gray-300">—</span>
                ) : (
                  `${correct} / ${total}`
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-800 tabular-nums">
                {player.points.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right">
                {isPendingDelete ? (
                  <span className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setPendingDelete(null)}
                      className="cursor-pointer rounded border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleDelete(player.username)}
                      className="cursor-pointer rounded bg-red-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-600"
                    >
                      Supprimer
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setPendingDelete(player.username)}
                    title="Supprimer définitivement cette participation"
                    className="cursor-pointer rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-4" />
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
