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
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Dices,
  Loader2,
} from "lucide-react"
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
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

// Filet de sécurité du chargement d'un résultat : sans réponse du serveur, la
// ligne cliquée cesse d'afficher son indicateur au bout de ce délai.
const LOAD_TIMEOUT_MS = 15000

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
  // Résultat demandé au serveur (indicateur de chargement sur sa ligne).
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Suppression en attente : succès constaté quand le résultat disparaît de
  // la config renvoyée par le serveur (pas d'accusé de réception).
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

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
  // Page recalée quand le nombre de pages diminue (suppression du dernier
  // résultat d'une page) : plus de page vide « 3 / 2 ».
  const currentPage = Math.min(page, Math.max(totalPages, 1))
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage

    return filteredResults.slice(start, start + itemsPerPage)
  }, [filteredResults, currentPage])

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage)
    }
  }, [page, currentPage])

  useEffect(() => {
    if (pendingDelete && !results.some((r) => r.id === pendingDelete)) {
      toast.success(t("manager:result.deleted"))
      setPendingDelete(null)
    }
  }, [results])

  const stopLoading = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }

    setLoadingId(null)
  }

  useEffect(
    () => () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
    },
    [],
  )

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
    useCallback((data) => {
      stopLoading()
      setSelectedResult(data)
    }, []),
  )

  // Erreur de lecture / suppression : le toast est affiché par le dashboard
  // (écouteur GAME.ERROR_MESSAGE), ici on libère seulement les indicateurs.
  useEvent(EVENTS.GAME.ERROR_MESSAGE, () => {
    stopLoading()
    setPendingDelete(null)
  })

  const requestResult = (id: string, draw: boolean) => {
    if (loadingId) {
      return
    }

    setOpenDraw(draw)
    setLoadingId(id)
    loadTimeoutRef.current = setTimeout(() => {
      loadTimeoutRef.current = null
      setLoadingId(null)
      toast.error(t("manager:result.loadTimeout"))
    }, LOAD_TIMEOUT_MS)
    socket?.emit(EVENTS.RESULTS.GET, id)
  }

  const handleOpen = (id: string) => () => requestResult(id, false)

  // Raccourci « Tirage » : on charge le résultat complet et la modale s'ouvre
  // directement sur le tirage (le détail des questions n'intéresse pas ici).
  const handleOpenDraw = (id: string) => () => requestResult(id, true)

  const handleDelete = (id: string) => () => {
    setPendingDelete(id)
    socket?.emit(EVENTS.RESULTS.DELETE, id)
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
    <div className="flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md sm:p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1"
        >
          {tabs.map(({ id, label, count }) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === id}
              key={id}
              onClick={handleTabChange(id)}
              className={clsx(
                "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:min-h-11",
                tab === id
                  ? "bg-orange-500 text-white"
                  : "text-white/70 hover:text-white",
              )}
            >
              <span>{label}</span>
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                  tab === id ? "bg-black/20" : "bg-white/10",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-48">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/60" />
          <input
            type="text"
            placeholder={t("manager:quizz.search")}
            aria-label={t("manager:result.search")}
            value={search}
            onChange={handleSearchChange}
            className="min-h-9 w-full rounded-lg border border-white/5 bg-white/5 py-1.5 pr-3 pl-8 text-xs text-white transition-all placeholder:text-white/50 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/60 focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {paginatedResults.map((r) => {
          const isLoading = loadingId === r.id
          const isDeleting = pendingDelete === r.id
          const name = resultDisplaySubject(r.subject)

          return (
            <div
              key={r.id}
              aria-busy={isLoading || isDeleting}
              className={clsx(
                "flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 transition-colors hover:bg-white/15",
                isDeleting && "opacity-50",
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none disabled:cursor-wait"
                onClick={handleOpen(r.id)}
                disabled={Boolean(loadingId) || isDeleting}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {name}
                  </span>
                  <span className="block text-xs text-white/60">
                    {formatDate(r.date)} ·{" "}
                    {t("manager:result.playerCount", { count: r.playerCount })}
                  </span>
                </span>
                {isLoading && (
                  <Loader2
                    className="size-4 shrink-0 animate-spin text-orange-300"
                    aria-label={t("common:loading")}
                  />
                )}
              </button>
              {tab === "solo" && (
                <button
                  type="button"
                  onClick={handleOpenDraw(r.id)}
                  disabled={Boolean(loadingId) || isDeleting}
                  title={t("manager:result.drawHint", {
                    count: SOLO_DRAW_POOL_SIZE,
                  })}
                  className="ml-2 flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 [@media(hover:none)]:min-h-11"
                >
                  <Dices className="size-3.5" />
                  <span>{t("manager:result.draw")}</span>
                </button>
              )}
              <AlertDialog
                trigger={
                  <button
                    type="button"
                    disabled={isDeleting}
                    aria-label={t("manager:result.deleteNamed", { name })}
                    title={t("manager:result.delete")}
                    className="ml-2 flex min-h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-red-500/20 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-11"
                  >
                    <Trash2 className="size-4 text-red-400" />
                  </button>
                }
                title={t("manager:result.delete")}
                description={t("manager:result.deleteConfirm", { name })}
                confirmLabel={t("common:delete")}
                onConfirm={handleDelete(r.id)}
              />
            </div>
          )
        })}
        {filteredResults.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="py-10 text-center text-sm text-white/60 italic">
              {emptyLabel}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t border-white/5 pt-3">
          <p className="text-xs text-white/60">
            {t("manager:result.count", { count: filteredResults.length })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              aria-label={t("manager:result.previousPage")}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-all hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none disabled:opacity-30 [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-11"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[3rem] text-center text-xs font-bold text-white/80">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              aria-label={t("manager:result.nextPage")}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-all hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none disabled:opacity-30 [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-11"
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
