import { EVENTS } from "@rahoot/common/constants"
import type { GameResult, GameResultMeta } from "@rahoot/common/types/game"
import {
  SOLO_DRAW_POOL_SIZE,
  isSoloResult,
  resultDisplaySubject,
} from "@rahoot/common/utils/result-kind"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import ResultModal from "@rahoot/web/features/manager/components/ResultModal"
import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import clsx from "clsx"
import { Search, Trash2, ChevronLeft, ChevronRight, Dices } from "lucide-react"
import React, { useCallback, useState, useMemo } from "react"
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

// Les deux natures de résultats n'ont ni le même cycle de vie ni les mêmes
// actions : une partie animée est un rapport figé, un classement solo reste
// ouvert aux soumissions et se conclut par un tirage au sort.
type Tab = "party" | "solo"

const ResultsPanel = () => {
  const { socket } = useSocket()
  const { results } = useConfig()
  const [selectedResult, setSelectedResult] = useState<GameResult | null>(null)
  const [openDraw, setOpenDraw] = useState(false)
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("party")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const itemsPerPage = 10

  const [partyResults, soloResults] = useMemo(() => {
    const solo: GameResultMeta[] = []
    const party: GameResultMeta[] = []

    results.forEach((r) => {
      if (isSoloResult(r)) {
        solo.push(r)
      } else {
        party.push(r)
      }
    })

    return [party, solo]
  }, [results])

  const filteredResults = useMemo(() => {
    const source = tab === "solo" ? soloResults : partyResults
    const needle = search.toLowerCase()

    return source.filter((r) =>
      resultDisplaySubject(r.subject).toLowerCase().includes(needle),
    )
  }, [partyResults, soloResults, tab, search])

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage)
  const paginatedResults = useMemo(() => {
    const start = (page - 1) * itemsPerPage

    return filteredResults.slice(start, start + itemsPerPage)
  }, [filteredResults, page])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleTabChange = (next: Tab) => () => {
    setTab(next)
    setPage(1)
  }

  useEvent(
    EVENTS.RESULTS.DATA,
    useCallback((data) => setSelectedResult(data), []),
  )

  const handleOpen = (id: string) => () => {
    setOpenDraw(false)
    socket?.emit(EVENTS.RESULTS.GET, id)
  }

  // Raccourci « Tirage » : on charge le résultat complet et la modale s'ouvre
  // directement sur le tirage (le détail des questions n'intéresse pas ici).
  const handleOpenDraw = (id: string) => () => {
    setOpenDraw(true)
    socket?.emit(EVENTS.RESULTS.GET, id)
  }

  const handleDelete = (id: string) => () => {
    socket?.emit(EVENTS.RESULTS.DELETE, id)
    toast.success(t("manager:result.deleted"))
  }

  const emptyLabel = search
    ? t("manager:quizz.notFound")
    : t(tab === "solo" ? "manager:result.noneSolo" : "manager:result.none")

  const tabs: { id: Tab; label: string; count: number }[] = [
    {
      id: "party",
      label: t("manager:result.tabParty"),
      count: partyResults.length,
    },
    {
      id: "solo",
      label: t("manager:result.tabSolo"),
      count: soloResults.length,
    },
  ]

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={handleTabChange(id)}
              className={clsx(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                tab === id
                  ? "bg-primary text-white"
                  : "text-white/60 hover:text-white",
              )}
            >
              <span>{label}</span>
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === id ? "bg-black/20" : "bg-white/10",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-48">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder={t("manager:quizz.search")}
            value={search}
            onChange={handleSearchChange}
            className="focus:ring-primary/50 w-full rounded-lg border border-white/5 bg-white/5 py-1.5 pr-3 pl-8 text-xs text-white transition-all placeholder:text-white/30 focus:bg-white/10 focus:ring-1 focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {paginatedResults.map((r) => (
          <div
            key={r.id}
            className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 transition-colors hover:bg-white/15"
          >
            <button
              className="min-w-0 flex-1 text-left"
              onClick={handleOpen(r.id)}
            >
              <p className="truncate text-sm font-semibold text-white">
                {resultDisplaySubject(r.subject)}
              </p>
              <p className="text-[10px] text-white/50">
                {formatDate(r.date)} ·{" "}
                {t("manager:result.playerCount", { count: r.playerCount })}
              </p>
            </button>
            {tab === "solo" && (
              <button
                onClick={handleOpenDraw(r.id)}
                title={`Tirage au sort parmi les ${SOLO_DRAW_POOL_SIZE} premiers`}
                className="ml-2 flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/30"
              >
                <Dices className="size-3.5" />
                <span>Tirage</span>
              </button>
            )}
            <AlertDialog
              trigger={
                <button className="ml-2 shrink-0 cursor-pointer rounded-lg p-2 transition-colors hover:bg-red-500/20">
                  <Trash2 className="size-4 text-red-400" />
                </button>
              }
              title={t("manager:result.delete")}
              description={t("manager:result.deleteConfirm", {
                name: resultDisplaySubject(r.subject),
              })}
              confirmLabel={t("common:delete")}
              onConfirm={handleDelete(r.id)}
            />
          </div>
        ))}
        {filteredResults.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="py-10 text-center text-sm text-white/40 italic">
              {emptyLabel}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t border-white/5 pt-3">
          <p className="text-[10px] text-white/40">
            {filteredResults.length} résultats
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg bg-white/5 p-1.5 text-white/60 transition-all hover:bg-white/10 disabled:opacity-20"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[3rem] text-center text-[11px] font-bold text-white/80">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg bg-white/5 p-1.5 text-white/60 transition-all hover:bg-white/10 disabled:opacity-20"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {selectedResult && (
        <ResultModal
          result={selectedResult}
          openDraw={openDraw}
          onClose={() => {
            setSelectedResult(null)
            setOpenDraw(false)
          }}
        />
      )}
    </div>
  )
}

export default ResultsPanel
