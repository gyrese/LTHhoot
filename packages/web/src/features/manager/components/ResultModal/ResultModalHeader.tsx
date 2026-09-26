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
    <div className="flex shrink-0 items-start gap-3 border-b border-white/10 px-5 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          {isSolo && (
            <span className="shrink-0 rounded bg-orange-500/20 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-orange-300 uppercase">
              {t("manager:result.tabSolo")}
            </span>
          )}
          <span className="truncate">
            {resultDisplaySubject(result.subject)}
          </span>
        </h2>
        <p className="mt-0.5 flex items-center gap-3 text-xs text-white/60">
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
          type="button"
          onClick={() => downloadGameResultCSV(result)}
          title={t("manager:result.exportCSV")}
          aria-label={t("manager:result.exportCSV")}
          className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
        >
          <Download className="size-5" />
        </button>
        {isSolo && (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("openSoloDraw"))
            }
            title={t("manager:result.drawHint", { count: SOLO_DRAW_POOL_SIZE })}
            className="ml-1 flex min-h-11 cursor-pointer items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:outline-none"
          >
            <Dices className="size-4" />
            <span>
              {t("manager:result.drawTop", { count: SOLO_DRAW_POOL_SIZE })}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("manager:actions.close")}
          className="ml-1 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}

export default ResultModalHeader
