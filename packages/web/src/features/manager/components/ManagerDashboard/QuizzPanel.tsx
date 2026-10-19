import { EVENTS } from "@rahoot/common/constants"
import type { Quizz } from "@rahoot/common/types/game"
import EditorDialog from "@rahoot/web/features/quizz/components/EditorDialog"
import LibraryQuizCard from "./LibraryQuizCard"
import LibraryFolderCard from "./LibraryFolderCard"
import useCustomFolderPaths from "./useCustomFolderPaths"
import { buildFolderGrid } from "./folderGrid"
import LibraryScrollArea from "./LibraryScrollArea"
import MoveQuizzesDialog from "./MoveQuizzesDialog"
import useLibraryPreferences from "./useLibraryPreferences"
import useLibraryMotion from "./useLibraryMotion"
import {
  matchesSearch,
  sortLibrary,
  type LibraryFilter,
  type LibrarySort,
} from "./library"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import { useNavigate } from "@tanstack/react-router"
import {
  Download,
  Plus,
  Search,
  SquarePen,
  Trash2,
  Upload,
  X,
  Share2,
  Archive,
  FolderInput,
  FolderOpen,
  LayoutGrid,
  List,
  Star,
  SlidersHorizontal,
  ChevronLeft,
} from "lucide-react"
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ShareSocialModal } from "@rahoot/web/features/manager/components/ShareSocialModal"
import {
  downloadJson,
  exportQuizzWithMedia,
} from "@rahoot/web/features/quizz/utils/export"
import { parseQuestionsCsv } from "@rahoot/web/features/quizz/utils/import-csv"
import {
  isArchived,
  isGuestFolder,
  ARCHIVE_FOLDER,
} from "@rahoot/web/features/manager/utils/folders"
import { translateServerError } from "@rahoot/web/features/manager/utils/errors"
import { isGuestQuizId } from "@rahoot/common/utils/guest"
import toast from "react-hot-toast"

type Props = {
  search: string
  setSearch: (_s: string) => void
  activeFolder: string | null
  activeTag: string | null
  selectedQuizz: string | null
  setSelectedQuizz: (_id: string | null) => void
  eveningMode?: boolean
  eveningQuizIds?: string[]
  onToggleEveningQuizz?: (_id: string) => void
  onMoveToFolder: (_id: string, _folder: string | null) => void
  onOpenFolder: (_folder: string | null) => void
  onClearTag: () => void
}

type ExportType = "json" | "pptx"

// Délai maximal d'attente de l'accusé d'import : au-delà (socket coupé…), le
// toast de chargement laisse place à une erreur au lieu de tourner à vide.
const IMPORT_ACK_TIMEOUT_MS = 15000
const NO_ARCHIVE_ORIGIN = "__archive_no_origin__"

type ArchiveSort = "dateDesc" | "dateAsc" | "title" | "origin"

const ARCHIVE_SELECT =
  "min-h-11 rounded-xl bg-white/10 px-2 py-1 text-xs text-white outline-none focus:ring-2 focus:ring-orange-400/60 [&>option]:text-black"

const QuizzPanel = ({
  search,
  setSearch,
  activeFolder,
  activeTag,
  selectedQuizz,
  setSelectedQuizz,
  eveningMode = false,
  eveningQuizIds = [],
  onToggleEveningQuizz,
  onMoveToFolder,
  onOpenFolder,
  onClearTag,
}: Props) => {
  const { quizz, role, guestName } = useConfig()
  const customFolders = useCustomFolderPaths(role, guestName)
  const {
    preferences,
    update: updatePreferences,
    toggleFavorite,
  } = useLibraryPreferences(role, guestName)
  const [quickFilter, setQuickFilter] = useState<LibraryFilter>("all")
  const [organizing, setOrganizing] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [organizedIds, setOrganizedIds] = useState<string[]>([])
  const [moveIds, setMoveIds] = useState<string[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<{
    ids: string[]
    folder: string | null
  } | null>(null)
  const { socket } = useSocket()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLDivElement>(null)
  // Export en cours : le quiz complet est demandé au serveur (QUIZZ.GET), la
  // réponse QUIZZ.DATA déclenche le téléchargement au format choisi.
  const exportRequestRef = useRef<{
    id: string
    type: ExportType
    toastId: string
  } | null>(null)
  // Suppression en attente : le serveur ne renvoie pas d'accusé, le succès se
  // constate quand le quiz disparaît de la config renvoyée.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  // Seul l'id est mémorisé : le quiz est relu dans la config à chaque rendu,
  // pour que la modale reflète un renommage public sans être rouverte.
  const [shareModalQuizzId, setShareModalQuizzId] = useState<string | null>(
    null,
  )
  const shareModalQuizz = quizz.find((q) => q.id === shareModalQuizzId)
  const { t, i18n } = useTranslation()
  // Tri et filtres propres à l'Archive (année, mois, dossier d'origine).
  const [archiveSort, setArchiveSort] = useState<ArchiveSort>("dateDesc")
  const [archiveYear, setArchiveYear] = useState("")
  const [archiveMonth, setArchiveMonth] = useState("")
  const [archiveOrigin, setArchiveOrigin] = useState("")
  const inArchive = isArchived(activeFolder ?? undefined)
  const activeFilters =
    Number(quickFilter !== "all") +
    Number(Boolean(activeTag)) +
    (inArchive
      ? Number(Boolean(archiveYear)) +
        Number(Boolean(archiveMonth)) +
        Number(Boolean(archiveOrigin))
      : 0)

  useEffect(() => {
    if (activeFolder) {
      setQuickFilter("all")
    }
    setOrganizedIds([])
    if (libraryRef.current) {
      libraryRef.current.scrollTop = 0
    }
  }, [activeFolder])

  useEffect(() => {
    if (pendingDelete && !quizz.some((q) => q.id === pendingDelete)) {
      toast.success(t("manager:quizz.deleted"))
      setPendingDelete(null)
    }
  }, [quizz])

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    setPendingDelete(null)
    setPendingMove(null)
    const request = exportRequestRef.current

    if (request) {
      exportRequestRef.current = null
      toast.error(translateServerError(t, message), { id: request.toastId })

      return
    }

    toast.error(translateServerError(t, message))
  })

  useEvent(EVENTS.QUIZZ.DATA, async (data) => {
    const request = exportRequestRef.current

    if (!request || data.id !== request.id) {
      return
    }

    exportRequestRef.current = null

    try {
      if (request.type === "pptx") {
        // Import dynamique : pptxgenjs (~plusieurs centaines de ko) n'est
        // chargé que lorsqu'un export PowerPoint est réellement demandé.
        const { exportQuizzToPptx } =
          await import("@rahoot/web/features/quizz/utils/export-pptx")
        await exportQuizzToPptx(data)
      } else {
        const fullQuizz = await exportQuizzWithMedia(data)
        downloadJson(fullQuizz, data.subject)
      }

      toast.success(t("manager:quizz.exported"), { id: request.toastId })
    } catch (error) {
      console.error("Export failed:", error)
      toast.error(t("manager:quizz.exportFailed"), { id: request.toastId })
    }
  })

  const handleExport = (id: string, type: ExportType) => {
    // Un export à la fois : la réponse QUIZZ.DATA ne porte pas le format.
    if (exportRequestRef.current || !socket) {
      return
    }

    const toastId = toast.loading(t("manager:quizz.exporting"))
    exportRequestRef.current = { id, type, toastId }
    socket.emit(EVENTS.QUIZZ.GET, id)
  }

  // La sélection et la liste de la soirée sont purgées par le dashboard dès
  // que le quiz disparaît de la config (cf. ManagerDashboard).
  const handleDelete = (id: string) => () => {
    setPendingDelete(id)
    socket?.emit(EVENTS.QUIZZ.DELETE, id)
  }

  // Import dans le dossier ouvert (racine depuis « Tous ») ; un dossier
  // invité est en lecture seule côté serveur, on retombe alors sur la racine.
  const importFolder =
    activeFolder && !isGuestFolder(activeFolder) ? activeFolder : ""

  // Le succès n'est annoncé qu'à réception de l'accusé du serveur.
  const saveImported = (payload: Quizz, successMessage: string) => {
    if (!socket) {
      return
    }

    const toastId = toast.loading(t("manager:quizz.importing"))
    let settled = false
    const timer = setTimeout(() => {
      settled = true
      toast.error(t("manager:quizz.importTimeout"), { id: toastId })
    }, IMPORT_ACK_TIMEOUT_MS)

    socket.emit(EVENTS.QUIZZ.SAVE, payload, (result) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)

      if ("error" in result) {
        toast.error(translateServerError(t, result.error), { id: toastId })

        return
      }

      toast.success(successMessage, { id: toastId })
    })
  }

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    const isCsv = file.name.endsWith(".csv")
    const reader = new FileReader()

    reader.onload = (event) => {
      const text = event.target?.result as string

      if (isCsv) {
        try {
          const parsed = parseQuestionsCsv(text)

          if (parsed.questions.length === 0) {
            toast.error(parsed.errors[0] || t("quizz:importCsvEmpty"))

            return
          }

          const quizzSubject = file.name.replace(/\.[^/.]+$/u, "")
          const successMessage =
            parsed.errors.length > 0
              ? `${t("quizz:importCsvSuccess", { count: parsed.questions.length })}. ${t("quizz:importCsvIgnored", { count: parsed.errors.length })}`
              : t("quizz:importCsvSuccess", { count: parsed.questions.length })

          saveImported(
            {
              subject: quizzSubject,
              questions: parsed.questions,
              tags: [],
              folder: importFolder,
            },
            successMessage,
          )
        } catch (err) {
          console.error("CSV import parse error:", err)
          toast.error(t("quizz:importCsvFailed"))
        }
      } else {
        let data: Quizz | null = null

        try {
          data = JSON.parse(text) as Quizz
        } catch {
          toast.error(t("manager:quizz.invalidJson"))

          return
        }

        saveImported(
          { ...data, folder: importFolder },
          t("manager:quizz.imported"),
        )
      }
    }

    reader.readAsText(file)
    e.target.value = ""
  }

  const archivedQuizz = useMemo(
    () => (inArchive ? quizz.filter((q) => isArchived(q.folder)) : []),
    [quizz, inArchive],
  )
  const archiveYears = useMemo(
    () =>
      [
        ...new Set(
          archivedQuizz.flatMap((q) =>
            q.archivedAt ? [new Date(q.archivedAt).getFullYear()] : [],
          ),
        ),
      ].sort((a, b) => b - a),
    [archivedQuizz],
  )
  const archiveOrigins = useMemo(
    () =>
      [...new Set(archivedQuizz.map((q) => q.archivedFrom ?? ""))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [archivedQuizz],
  )

  const filtered = useMemo(() => {
    const matchesArchive = (q: (typeof quizz)[number]) => {
      const date = q.archivedAt ? new Date(q.archivedAt) : null

      if (archiveYear && date?.getFullYear() !== Number(archiveYear)) {
        return false
      }

      if (archiveMonth && date?.getMonth() !== Number(archiveMonth) - 1) {
        return false
      }

      return (
        !archiveOrigin ||
        (q.archivedFrom || NO_ARCHIVE_ORIGIN) === archiveOrigin
      )
    }

    const list = quizz.filter((q) => {
      if (search && !matchesSearch(q, search)) {
        return false
      }
      if (
        quickFilter === "favorites" &&
        !preferences.favorites.includes(q.id)
      ) {
        return false
      }
      if (quickFilter === "unfiled" && q.folder) {
        return false
      }

      if (activeFolder) {
        if (
          q.folder !== activeFolder &&
          !q.folder?.startsWith(`${activeFolder}/`)
        ) {
          return false
        }
      } else if (isArchived(q.folder) || isGuestFolder(q.folder)) {
        // Comme l'Archive, les bibliothèques invités ne polluent pas la vue
        // « Tous » : elles se consultent via le dossier Invités.
        return false
      }

      if (activeTag && !(q.tags ?? []).includes(activeTag)) {
        return false
      }

      return !inArchive || matchesArchive(q)
    })

    if (!inArchive) {
      return sortLibrary(list, preferences.sort)
    }

    const byDate = (a: (typeof list)[number], b: (typeof list)[number]) =>
      (b.archivedAt ?? 0) - (a.archivedAt ?? 0)
    const sorters: Record<ArchiveSort, typeof byDate> = {
      dateDesc: byDate,
      dateAsc: (a, b) => byDate(b, a),
      title: (a, b) => a.subject.localeCompare(b.subject),
      origin: (a, b) =>
        (a.archivedFrom ?? "").localeCompare(b.archivedFrom ?? "") ||
        byDate(a, b),
    }

    return [...list].sort(sorters[archiveSort])
  }, [
    quizz,
    search,
    activeFolder,
    activeTag,
    inArchive,
    archiveSort,
    archiveYear,
    archiveMonth,
    archiveOrigin,
    quickFilter,
    preferences.sort,
    preferences.favorites,
  ])

  const browsingFolders =
    !inArchive && !search.trim() && !activeTag && quickFilter === "all"
  const folderGrid = useMemo(
    () =>
      browsingFolders
        ? buildFolderGrid(filtered, customFolders, activeFolder)
        : { folders: [], quizzes: filtered },
    [browsingFolders, filtered, customFolders, activeFolder],
  )
  const visibleQuizzes = folderGrid.quizzes

  const handleSelect = (id: string, isSelected: boolean) => {
    if (organizing) {
      setOrganizedIds((prev) =>
        prev.includes(id)
          ? prev.filter((selected) => selected !== id)
          : [...prev, id],
      )
    } else if (eveningMode) {
      onToggleEveningQuizz?.(id)
    } else {
      setSelectedQuizz(isSelected ? null : id)
    }
  }

  useEffect(() => {
    if (
      !eveningMode &&
      selectedQuizz &&
      !visibleQuizzes.some((quiz) => quiz.id === selectedQuizz)
    ) {
      setSelectedQuizz(null)
    }
  }, [visibleQuizzes, selectedQuizz, eveningMode, setSelectedQuizz])

  useLibraryMotion(
    libraryRef,
    `${activeFolder}:${preferences.layout}:${folderGrid.folders.map((folder) => folder.path).join(",")}:${visibleQuizzes.map((quiz) => quiz.id).join(",")}`,
  )

  const goToCreate = () => navigate({ to: "/manager/quizz" })
  const openImport = () => fileInputRef.current?.click()

  useEffect(() => {
    const available = new Set(quizz.map((q) => q.id))
    setOrganizedIds((prev) =>
      prev.every((id) => available.has(id))
        ? prev
        : prev.filter((id) => available.has(id)),
    )
  }, [quizz])
  useEffect(() => {
    if (eveningMode) {
      setOrganizing(false)
      setOrganizedIds([])
    }
  }, [eveningMode])
  useEffect(() => {
    if (!pendingMove) {
      return
    }
    if (
      pendingMove.ids.every((id) => {
        const quiz = quizz.find((q) => q.id === id)
        return Boolean(quiz && (quiz.folder || null) === pendingMove.folder)
      })
    ) {
      toast.success(
        t("manager:library.moved", { count: pendingMove.ids.length }),
      )
      setPendingMove(null)
      setOrganizedIds([])
    }
  }, [quizz, pendingMove, t])
  useEffect(() => {
    if (!pendingMove) {
      return undefined
    }
    const timer = setTimeout(() => {
      setPendingMove(null)
      toast.error(t("manager:library.moveTimeout"))
    }, 15000)
    return () => clearTimeout(timer)
  }, [pendingMove, t])
  const moveQuizzes = (ids: string[], folder: string | null) => {
    if (pendingMove) {
      return
    }
    if (!socket?.connected) {
      toast.error(t("manager:connection.lost"))
      return
    }
    const movable = quizz.filter(
      (q) =>
        ids.includes(q.id) &&
        !isGuestQuizId(q.id) &&
        (q.folder || null) !== folder,
    )
    setMoveIds(null)
    if (!movable.length) {
      return
    }
    setPendingMove({ ids: movable.map((q) => q.id), folder })
    movable.forEach((q) => {
      onMoveToFolder(q.id, folder)
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-1 sm:p-0">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {activeFolder && (
              <button
                type="button"
                className="dashboard-icon shrink-0"
                onClick={() => onOpenFolder(null)}
                aria-label={t("manager:library.breadcrumbRoot")}
              >
                <FolderOpen className="size-4" />
              </button>
            )}
            {activeFolder?.includes("/") && (
              <button
                type="button"
                className="dashboard-icon shrink-0"
                onClick={() =>
                  onOpenFolder(
                    activeFolder.split("/").slice(0, -1).join("/") || null,
                  )
                }
                aria-label={t("manager:library.parentFolder")}
                title={t("manager:library.parentFolder")}
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            <h1
              className="truncate text-xl font-bold tracking-tight text-white"
              title={activeFolder || t("manager:library.title")}
            >
              {activeFolder?.split("/").at(-1) || t("manager:library.title")}
            </h1>
            <span
              className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70 tabular-nums"
              role="status"
              aria-label={t("manager:library.count", {
                count: filtered.length,
              })}
            >
              {filtered.length}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={goToCreate}
            aria-label={t("manager:quizz.create")}
            className="dashboard-primary min-h-11"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">
              {t("manager:quizz.create")}
            </span>
          </button>
          <button
            type="button"
            onClick={openImport}
            className="dashboard-icon min-h-11 min-w-11"
            title={t("manager:quizz.import")}
            aria-label={t("manager:quizz.import")}
          >
            <Upload className="size-4" />
          </button>
          {!eveningMode && (
            <button
              type="button"
              aria-pressed={organizing}
              className={
                organizing
                  ? "dashboard-secondary bg-orange-500/15 text-orange-200"
                  : "dashboard-icon min-h-11 min-w-11"
              }
              aria-label={t(
                organizing
                  ? "manager:library.done"
                  : "manager:library.organize",
              )}
              title={t(
                organizing
                  ? "manager:library.done"
                  : "manager:library.organize",
              )}
              onClick={() => {
                setOrganizing(!organizing)
                setOrganizedIds([])
                setSelectedQuizz(null)
              }}
            >
              <FolderInput className="size-4" />
              {organizing &&
                t(
                  organizing
                    ? "manager:library.done"
                    : "manager:library.organize",
                )}
            </button>
          )}
        </div>
      </div>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/60" />
          <input
            type="text"
            className="min-h-11 w-full rounded-xl bg-white/10 py-2 pr-11 pl-9 text-sm text-white placeholder-white/50 transition-colors outline-none focus:bg-white/15 focus:ring-2 focus:ring-orange-400/60"
            placeholder={t("manager:quizz.search")}
            aria-label={t("manager:quizz.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("manager:quizz.clearSearch")}
              title={t("manager:quizz.clearSearch")}
              className="absolute top-1/2 right-0 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-xl text-white/60 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`dashboard-secondary min-h-11 shrink-0 ${filtersOpen || activeFilters ? "bg-orange-500/15 text-orange-200" : ""}`}
          title={t("manager:library.filterOptions")}
          aria-label={t("manager:library.filterOptions")}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="size-4" />
          {activeFilters > 0 && (
            <span className="text-xs tabular-nums">{activeFilters}</span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {filtersOpen && (
        <div className="shrink-0 space-y-2 rounded-xl bg-white/5 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="flex flex-wrap items-center gap-1"
              aria-label={t("manager:library.filters")}
            >
              {(["all", "favorites", "unfiled"] as const).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  aria-pressed={quickFilter === filter}
                  onClick={() => {
                    setQuickFilter(filter)
                    if (filter === "unfiled") {
                      onOpenFolder(null)
                    }
                  }}
                  className={`dashboard-filter ${quickFilter === filter ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"}`}
                >
                  {filter === "favorites" && <Star className="size-3.5" />}
                  {t(`manager:library.filter.${filter}`)}
                </button>
              ))}
              {Boolean(activeTag || search || activeFilters) && (
                <button
                  type="button"
                  className="dashboard-icon"
                  aria-label={t("manager:library.resetFilters")}
                  title={t("manager:library.resetFilters")}
                  onClick={() => {
                    setSearch("")
                    setQuickFilter("all")
                    setArchiveYear("")
                    setArchiveMonth("")
                    setArchiveOrigin("")
                    onClearTag()
                  }}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {!inArchive && (
                <select
                  className="dashboard-select max-w-44"
                  aria-label={t("manager:library.sortLabel")}
                  value={preferences.sort}
                  onChange={(event) =>
                    updatePreferences({
                      sort: event.target.value as LibrarySort,
                    })
                  }
                >
                  {(["recent", "title", "duration", "questions"] as const).map(
                    (sort) => (
                      <option key={sort} value={sort}>
                        {t(`manager:library.sort.${sort}`)}
                      </option>
                    ),
                  )}
                </select>
              )}
              <div
                className="flex rounded-lg bg-white/5 p-0.5"
                aria-label={t("manager:library.layoutLabel")}
              >
                {(["grid", "list"] as const).map((layout) => (
                  <button
                    key={layout}
                    type="button"
                    className={`dashboard-icon ${preferences.layout === layout ? "bg-white/15 text-white" : "text-white/60"}`}
                    aria-label={t(`manager:library.layout.${layout}`)}
                    aria-pressed={preferences.layout === layout}
                    onClick={() => updatePreferences({ layout })}
                  >
                    {layout === "grid" ? (
                      <LayoutGrid className="size-4" />
                    ) : (
                      <List className="size-4" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {activeTag && (
            <button
              type="button"
              className="dashboard-filter text-orange-200"
              onClick={onClearTag}
            >
              #{activeTag} <X className="size-3" />
            </button>
          )}
          {inArchive && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <select
                className={ARCHIVE_SELECT}
                value={archiveSort}
                onChange={(e) => setArchiveSort(e.target.value as ArchiveSort)}
                aria-label={t("manager:archive.sort")}
              >
                {(["dateDesc", "dateAsc", "title", "origin"] as const).map(
                  (k) => (
                    <option key={k} value={k}>
                      {t(`manager:archive.sortBy.${k}`)}
                    </option>
                  ),
                )}
              </select>
              <select
                className={ARCHIVE_SELECT}
                value={archiveYear}
                onChange={(e) => setArchiveYear(e.target.value)}
                aria-label={t("manager:archive.year")}
              >
                <option value="">{t("manager:archive.allYears")}</option>
                {archiveYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                className={ARCHIVE_SELECT}
                value={archiveMonth}
                onChange={(e) => setArchiveMonth(e.target.value)}
                aria-label={t("manager:archive.month")}
              >
                <option value="">{t("manager:archive.allMonths")}</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleDateString(i18n.language, {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
              <select
                className={ARCHIVE_SELECT}
                value={archiveOrigin}
                onChange={(e) => setArchiveOrigin(e.target.value)}
                aria-label={t("manager:archive.origin")}
              >
                <option value="">{t("manager:archive.allOrigins")}</option>
                {archiveOrigins.map((o) => (
                  <option key={o} value={o || NO_ARCHIVE_ORIGIN}>
                    {o || t("manager:archive.noOrigin")}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      {organizing && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-sm text-orange-100">
          <span>
            {t("manager:library.selected", { count: organizedIds.length })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="dashboard-filter"
              onClick={() =>
                setOrganizedIds(
                  organizedIds.length
                    ? []
                    : visibleQuizzes
                        .filter((q) => !isGuestQuizId(q.id))
                        .map((q) => q.id),
                )
              }
            >
              {t(
                organizedIds.length
                  ? "manager:library.clearSelection"
                  : "manager:library.selectAll",
              )}
            </button>
            <button
              type="button"
              className="dashboard-secondary"
              disabled={!organizedIds.length || Boolean(pendingMove)}
              onClick={() => setMoveIds(organizedIds)}
            >
              <FolderInput className="size-4" />
              {t("manager:library.move")}
            </button>
          </div>
        </div>
      )}

      {/* Grille */}
      <LibraryScrollArea
        viewportRef={libraryRef}
        label={t("manager:library.title")}
      >
        {visibleQuizzes.length === 0 && folderGrid.folders.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
            <p className="text-sm text-white/60">
              {t(
                search || quizz.length > 0
                  ? "manager:quizz.notFound"
                  : "manager:quizz.none",
              )}
            </p>
            {/* État vide : les deux façons de remplir la bibliothèque (ou ce
                dossier — l'import y range le quiz). */}
            {search || activeFilters ? (
              <button
                type="button"
                className="dashboard-secondary"
                onClick={() => {
                  setSearch("")
                  setQuickFilter("all")
                  setArchiveYear("")
                  setArchiveMonth("")
                  setArchiveOrigin("")
                  onClearTag()
                }}
              >
                {t("manager:library.resetFilters")}
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={goToCreate}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:outline-none"
                >
                  <Plus className="size-4" />
                  {t("manager:quizz.create")}
                </button>
                <button
                  type="button"
                  onClick={openImport}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
                >
                  <Upload className="size-4" />
                  {t("manager:quizz.importShort")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            className={
              preferences.layout === "list"
                ? "flex flex-col gap-2"
                : "grid grid-cols-2 content-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(156px,1fr))]"
            }
          >
            {folderGrid.folders.map((folder) => (
              <LibraryFolderCard
                key={`folder:${folder.path}`}
                path={folder.path}
                quizzes={folder.quizzes}
                list={preferences.layout === "list"}
                onOpen={() => onOpenFolder(folder.path)}
                canDropQuiz={(id) => {
                  if (
                    pendingMove ||
                    !socket?.connected ||
                    isGuestFolder(folder.path) ||
                    isArchived(folder.path)
                  ) {
                    return false
                  }
                  return (
                    !id ||
                    quizz.some(
                      (quiz) =>
                        quiz.id === id &&
                        !isGuestQuizId(id) &&
                        quiz.folder !== folder.path,
                    )
                  )
                }}
                onDropQuiz={(id) => moveQuizzes([id], folder.path)}
              />
            ))}
            {visibleQuizzes.map((q) => {
              const isReadonly = isGuestQuizId(q.id)
              let selected = selectedQuizz === q.id
              if (eveningMode) {
                selected = eveningQuizIds.includes(q.id)
              }
              if (organizing) {
                selected = organizedIds.includes(q.id)
              }
              let archiveTarget: string | null = ARCHIVE_FOLDER
              if (inArchive) {
                archiveTarget =
                  q.archivedFrom && !isGuestFolder(q.archivedFrom)
                    ? q.archivedFrom
                    : null
              }
              const edit = () =>
                navigate({
                  to: "/manager/quizz/$quizzId",
                  params: { quizzId: q.id },
                })
              const actions = [
                ...(!isReadonly
                  ? [
                      {
                        label: t("manager:actions.edit"),
                        icon: <SquarePen className="size-4" />,
                        onSelect: edit,
                      },
                      {
                        label: t("manager:library.move"),
                        icon: <FolderInput className="size-4" />,
                        onSelect: () => setMoveIds([q.id]),
                      },
                    ]
                  : []),
                {
                  label: t("manager:share.title"),
                  icon: <Share2 className="size-4" />,
                  onSelect: () => setShareModalQuizzId(q.id),
                },
                ...(["json", "pptx"] as const).map((type) => ({
                  label: t(`manager:quizz.exportAs.${type}`),
                  icon: <Download className="size-4" />,
                  onSelect: () => handleExport(q.id, type),
                })),
                ...(!isReadonly
                  ? [
                      {
                        label: t(
                          inArchive
                            ? "manager:library.restore"
                            : "manager:library.archive",
                        ),
                        icon: <Archive className="size-4" />,
                        onSelect: () => moveQuizzes([q.id], archiveTarget),
                      },
                      {
                        label: t("common:delete"),
                        icon: <Trash2 className="size-4" />,
                        danger: true,
                        onSelect: () => setConfirmDelete(q.id),
                      },
                    ]
                  : []),
              ]
              return (
                <LibraryQuizCard
                  key={q.id}
                  quiz={q}
                  selected={selected}
                  order={
                    eveningMode && selected
                      ? eveningQuizIds.indexOf(q.id) + 1
                      : undefined
                  }
                  favorite={preferences.favorites.includes(q.id)}
                  readonly={isReadonly}
                  deleting={
                    pendingDelete === q.id ||
                    Boolean(pendingMove?.ids.includes(q.id))
                  }
                  list={preferences.layout === "list"}
                  selectingMany={organizing || eveningMode}
                  selectDisabled={organizing && isReadonly}
                  onSelect={() => {
                    if (organizing && isReadonly) {
                      return
                    }
                    handleSelect(q.id, selected)
                  }}
                  onEdit={edit}
                  onFavorite={() => toggleFavorite(q.id)}
                  actions={actions}
                />
              )
            })}
          </div>
        )}
      </LibraryScrollArea>

      {moveIds && (
        <MoveQuizzesDialog
          quizzes={quizz}
          ids={moveIds}
          role={role}
          guestName={guestName}
          onClose={() => setMoveIds(null)}
          onMove={(folder) => moveQuizzes(moveIds, folder)}
        />
      )}
      {confirmDelete && (
        <EditorDialog
          label={t("manager:quizz.delete")}
          onClose={() => setConfirmDelete(null)}
        >
          <div className="rounded-xl border border-white/15 bg-slate-950 p-5 text-white">
            <h2 className="text-base font-bold">{t("manager:quizz.delete")}</h2>
            <p className="mt-3 text-sm text-white/75">
              {t("manager:quizz.deleteConfirm", {
                name: quizz.find((q) => q.id === confirmDelete)?.subject,
              })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                className="dashboard-secondary"
                onClick={() => setConfirmDelete(null)}
              >
                {t("common:cancel")}
              </button>
              <button
                type="button"
                className="dashboard-secondary bg-red-500/20 text-red-200"
                onClick={() => {
                  handleDelete(confirmDelete)()
                  setConfirmDelete(null)
                }}
              >
                {t("common:delete")}
              </button>
            </div>
          </div>
        </EditorDialog>
      )}
      {shareModalQuizz && (
        <ShareSocialModal
          quizz={shareModalQuizz}
          onClose={() => setShareModalQuizzId(null)}
        />
      )}
    </div>
  )
}

export default QuizzPanel
