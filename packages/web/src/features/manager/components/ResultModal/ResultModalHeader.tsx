import {
  SOLO_DRAW_POOL_SIZE,
  isSoloResult,
  resultDisplaySubject,
} from "@rahoot/common/utils/result-kind"
import { useResultModal } from "@rahoot/web/features/manager/contexts/result-modal-context"
import { downloadGameResultCSV } from "@rahoot/web/features/manager/utils/csv"
import { Download, X, Dices, Users, CalendarDays } from "lucide-react"
import { useTranslation } from "react-i18next"

const formatDate = (iso: string) => {
  const d = new Date(iso)

  return `${d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

const ResultModalHeader = () => {
  const { result, totalPlayers, onClose } = useResultModal()
  const { t } = useTranslation()
  // Le tirage au sort ne concerne que les classements solo « Réseaux » : une
  // partie animée en direct a déjà son podium.
  const isSolo = isSoloResult(result)

  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-gray-200 px-5 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          {isSolo && (
            <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-orange-600 uppercase">
              Solo réseaux
            </span>
          )}
          <span className="truncate">
            {resultDisplaySubject(result.subject)}
          </span>
        </h2>
        <p className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {formatDate(result.date)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {t("manager:result.playerCount", { count: totalPlayers })}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => downloadGameResultCSV(result)}
          title={t("manager:result.exportCSV")}
          className="hover:text-primary cursor-pointer rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
        >
          <Download className="size-5" />
        </button>
        {isSolo && (
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("openSoloDraw"))
            }
            title={`Tirage au sort parmi les ${SOLO_DRAW_POOL_SIZE} premiers`}
            className="ml-1 flex cursor-pointer items-center gap-1 rounded bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-400"
          >
            <Dices className="size-4" />
            <span>Tirage Top {SOLO_DRAW_POOL_SIZE}</span>
          </button>
        )}
        <button
          onClick={onClose}
          className="ml-1 cursor-pointer rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}

export default ResultModalHeader
