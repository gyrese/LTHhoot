import { EVENTS } from "@rahoot/common/constants"
import type { GameResult } from "@rahoot/common/types/game"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import ResultModal from "@rahoot/web/features/manager/components/ResultModal"
import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import { Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useState, useMemo } from "react"
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
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const itemsPerPage = 10

  const filteredResults = useMemo(() => {
    return results.filter((r) => 
      r.subject.toLowerCase().includes(search.toLowerCase())
    )
  }, [results, search])

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage)
  const paginatedResults = useMemo(() => {
    const start = (page - 1) * itemsPerPage
    return filteredResults.slice(start, start + itemsPerPage)
  }, [filteredResults, page])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

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
    <div className="flex h-full flex-col gap-3 rounded-2xl bg-black/30 p-4 backdrop-blur-md border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm font-semibold text-white/80">
          {t("manager:tabs.results")}
        </p>
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/40" />
          <input
            type="text"
            placeholder={t("manager:quizz.search")}
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-lg bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/30 border border-white/5 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>
      
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {paginatedResults.map((r) => (
          <div
            key={r.id}
            className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 transition-colors hover:bg-white/15"
          >
            <button className="min-w-0 flex-1 text-left" onClick={handleOpen(r.id)}>
              <p className="truncate font-semibold text-white text-sm">{r.subject}</p>
              <p className="text-[10px] text-white/50">
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
        {filteredResults.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-white/40 italic py-10">
              {search ? t("manager:quizz.notFound") : t("manager:result.none")}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/5 pt-3 shrink-0">
          <p className="text-[10px] text-white/40">
            {filteredResults.length} résultats
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-[11px] font-bold text-white/80 min-w-[3rem] text-center">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-20 transition-all"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

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
