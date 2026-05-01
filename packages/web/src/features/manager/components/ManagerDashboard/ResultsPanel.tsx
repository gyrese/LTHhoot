import { EVENTS } from "@rahoot/common/constants"
import type { GameResult } from "@rahoot/common/types/game"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import ResultModal from "@rahoot/web/features/manager/components/ResultModal"
import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import { Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

const ResultsPanel = () => {
  const { socket } = useSocket()
  const { results } = useConfig()
  const [selectedResult, setSelectedResult] = useState<GameResult | null>(null)
  const { t } = useTranslation()

  useEvent(
    EVENTS.RESULTS.DATA,
    useCallback((data) => setSelectedResult(data), []),
  )

  const handleOpen = (id: string) => () => socket?.emit(EVENTS.RESULTS.GET, id)

  const handleDelete = (id: string) => () => {
    socket?.emit(EVENTS.RESULTS.DELETE, id)
    toast.success(t("manager:result.deleted"))
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl bg-black/30 p-4 backdrop-blur-md border border-white/10">
      <p className="shrink-0 text-sm font-semibold text-white/80">
        {t("manager:tabs.results")}
      </p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {results.map((r) => (
          <div
            key={r.id}
            className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 transition-colors hover:bg-white/15"
          >
            <button className="min-w-0 flex-1 text-left" onClick={handleOpen(r.id)}>
              <p className="truncate font-semibold text-white">{r.subject}</p>
              <p className="text-xs text-white/50">
                {formatDate(r.date)} ·{" "}
                {t("manager:result.playerCount", { count: r.playerCount })}
              </p>
            </button>
            <AlertDialog
              trigger={
                <button className="ml-2 shrink-0 rounded-lg p-2 transition-colors hover:bg-red-500/20">
                  <Trash2 className="size-4 text-red-400" />
                </button>
              }
              title={t("manager:result.delete")}
              description={t("manager:result.deleteConfirm", { name: r.subject })}
              confirmLabel={t("common:delete")}
              onConfirm={handleDelete(r.id)}
            />
          </div>
        ))}
        {results.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-white/40">
              {t("manager:result.none")}
            </p>
          </div>
        )}
      </div>

      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  )
}

export default ResultsPanel
