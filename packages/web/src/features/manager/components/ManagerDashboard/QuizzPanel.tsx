import { EVENTS } from "@rahoot/common/constants"
import type { Quizz } from "@rahoot/common/types/game"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import { useNavigate } from "@tanstack/react-router"
import {
  Check,
  Download,
  Loader2,
  Plus,
  Search,
  SquarePen,
  Trash2,
  Upload,
  X,
  Share2,
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
} from "@rahoot/web/features/manager/utils/folders"
import { translateServerError } from "@rahoot/web/features/manager/utils/errors"
import { isGuestQuizId } from "@rahoot/common/utils/guest"
import toast from "react-hot-toast"
import clsx from "clsx"

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
}

type ExportType = "json" | "pptx"

// Délai maximal d'attente de l'accusé d'import : au-delà (socket coupé…), le
// toast de chargement laisse place à une erreur au lieu de tourner à vide.
const IMPORT_ACK_TIMEOUT_MS = 15000

// Actions d'une carte : 28 px à la souris, 44 px sur écran tactile.
const CARD_ACTION =
  "flex items-center justify-center rounded-lg bg-black/60 p-1.5 backdrop-blur-sm hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-11"

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
}: Props) => {
  const { quizz } = useConfig()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Export en cours : le quiz complet est demandé au serveur (QUIZZ.GET), la
  // réponse QUIZZ.DATA déclenche le téléchargement au format choisi.
  const exportRequestRef = useRef<{
    id: string
    type: ExportType
    toastId: string
  } | null>(null)
  const [exportMenuFor, setExportMenuFor] = useState<string | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  // Suppression en attente : le serveur ne renvoie pas d'accusé, le succès se
  // constate quand le quiz disparaît de la config renvoyée.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  // Seul l'id est mémorisé : le quiz est relu dans la config à chaque rendu,
  // pour que la modale reflète un renommage public sans être rouverte.
  const [shareModalQuizzId, setShareModalQuizzId] = useState<string | null>(
    null,
  )
  const shareModalQuizz = quizz.find((q) => q.id === shareModalQuizzId)
  const { t } = useTranslation()

  useEffect(() => {
    if (pendingDelete && !quizz.some((q) => q.id === pendingDelete)) {
      toast.success(t("manager:quizz.deleted"))
      setPendingDelete(null)
    }
  }, [quizz])

  // Menu d'export : se referme au clic extérieur et sur Échap.
  useEffect(() => {
    if (!exportMenuFor) {
      return undefined
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) {
        setExportMenuFor(null)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExportMenuFor(null)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [exportMenuFor])

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    setPendingDelete(null)
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
    setExportMenuFor(null)

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

  const filtered = useMemo(
    () =>
      quizz.filter((q) => {
        if (search && !q.subject.toLowerCase().includes(search.toLowerCase())) {
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

        return true
      }),
    [quizz, search, activeFolder, activeTag],
  )

  const handleSelect = (id: string, isSelected: boolean) => {
    if (eveningMode) {
      onToggleEveningQuizz?.(id)
    } else {
      setSelectedQuizz(isSelected ? null : id)
    }
  }

  const goToCreate = () => navigate({ to: "/manager/quizz" })
  const openImport = () => fileInputRef.current?.click()

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md sm:p-4">
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
          onClick={goToCreate}
          aria-label={t("manager:quizz.create")}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:outline-none sm:px-4"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t("manager:quizz.create")}</span>
        </button>
        <button
          type="button"
          onClick={openImport}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
          title={t("manager:quizz.import")}
          aria-label={t("manager:quizz.import")}
        >
          <Upload className="size-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {/* Grille */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
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
            {!search && (
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] content-start gap-3">
            {filtered.map((q) => {
              const isSelected = eveningMode
                ? eveningQuizIds.includes(q.id)
                : selectedQuizz === q.id
              const eveningOrder = eveningMode
                ? eveningQuizIds.indexOf(q.id) + 1
                : 0
              // Quiz d'une bibliothèque invité (vue admin) : consultable,
              // exportable et lançable, mais ni éditable, ni supprimable,
              // ni déplaçable.
              const isReadonly = isGuestQuizId(q.id)
              const isDeleting = pendingDelete === q.id

              return (
                <div
                  key={q.id}
                  draggable={!isReadonly}
                  onDragStart={(e) => {
                    if (isReadonly) {
                      return
                    }

                    e.dataTransfer.setData("quizzId", q.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  className={clsx(
                    "group relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 transition-all duration-200",
                    isSelected
                      ? "scale-[0.97] shadow-xl ring-2 shadow-orange-500/40 ring-orange-400 ring-offset-2 ring-offset-black/0"
                      : "hover:scale-[1.03] hover:shadow-xl hover:shadow-black/40",
                    isDeleting && "opacity-50",
                  )}
                >
                  {q.listingImage && (
                    <img
                      src={q.listingImage}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    />
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <div className="pointer-events-none absolute right-0 bottom-0 left-0 p-3">
                    <p className="line-clamp-2 text-sm leading-tight font-bold text-white drop-shadow-md">
                      {q.subject}
                    </p>
                    {q.folder && (
                      <p
                        className={clsx(
                          "mt-0.5 truncate text-xs",
                          isReadonly
                            ? "font-semibold text-orange-300"
                            : "text-white/70",
                        )}
                      >
                        {q.folder}
                      </p>
                    )}
                  </div>

                  {/* Zone de sélection : un vrai bouton (clavier, lecteurs
                      d'écran) qui couvre la carte, sous les actions. */}
                  <button
                    type="button"
                    onClick={() => handleSelect(q.id, isSelected)}
                    aria-pressed={isSelected}
                    aria-label={
                      eveningMode && isSelected
                        ? t("manager:quizz.selectInEvening", {
                            name: q.subject,
                            order: eveningOrder,
                          })
                        : q.subject
                    }
                    className="absolute inset-0 cursor-pointer rounded-2xl focus-visible:ring-4 focus-visible:ring-orange-300 focus-visible:outline-none focus-visible:ring-inset"
                  />

                  {isSelected && !eveningMode && (
                    <div className="pointer-events-none absolute top-2 right-2 rounded-full bg-orange-500 p-0.5 shadow-md">
                      <Check className="size-3.5 stroke-[3] text-white" />
                    </div>
                  )}

                  {isSelected && eveningMode && (
                    <div className="pointer-events-none absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white shadow-md">
                      {eveningOrder}
                    </div>
                  )}

                  {isDeleting && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-white" />
                    </div>
                  )}

                  {/* Actions : au survol, au focus clavier (focus-within) et
                      en permanence sur écran tactile, où il n'y a pas de survol. */}
                  <div
                    ref={exportMenuFor === q.id ? exportMenuRef : undefined}
                    className={clsx(
                      "absolute top-2 right-10 left-2 flex flex-wrap gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
                      exportMenuFor === q.id ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {!isReadonly && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/manager/quizz/$quizzId",
                            params: { quizzId: q.id },
                          })
                        }
                        className={clsx(CARD_ACTION, "text-white")}
                        title={t("manager:actions.edit")}
                        aria-label={t("manager:actions.editNamed", {
                          name: q.subject,
                        })}
                      >
                        <SquarePen className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShareModalQuizzId(q.id)}
                      className={clsx(CARD_ACTION, "text-orange-400")}
                      title={t("manager:share.title")}
                      aria-label={t("manager:share.titleNamed", {
                        name: q.subject,
                      })}
                    >
                      <Share2 className="size-3.5" />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setExportMenuFor(exportMenuFor === q.id ? null : q.id)
                        }
                        aria-haspopup="menu"
                        aria-expanded={exportMenuFor === q.id}
                        className={clsx(CARD_ACTION, "text-sky-300")}
                        title={t("manager:quizz.export")}
                        aria-label={t("manager:quizz.exportNamed", {
                          name: q.subject,
                        })}
                      >
                        <Download className="size-3.5" />
                      </button>
                      {exportMenuFor === q.id && (
                        <div
                          role="menu"
                          className="absolute top-full left-0 z-20 mt-1 flex w-36 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/85 py-1 shadow-xl backdrop-blur-md"
                        >
                          {(["json", "pptx"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              role="menuitem"
                              onClick={() => handleExport(q.id, type)}
                              className="min-h-9 px-3 py-1.5 text-left text-xs font-semibold text-white/90 hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none [@media(hover:none)]:min-h-11"
                            >
                              {t(`manager:quizz.exportAs.${type}`)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {!isReadonly && (
                      <AlertDialog
                        trigger={
                          <button
                            type="button"
                            disabled={isDeleting}
                            className={clsx(CARD_ACTION, "text-red-400")}
                            title={t("common:delete")}
                            aria-label={t("manager:quizz.deleteNamed", {
                              name: q.subject,
                            })}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        }
                        title={t("manager:quizz.delete")}
                        description={t("manager:quizz.deleteConfirm", {
                          name: q.subject,
                        })}
                        confirmLabel={t("common:delete")}
                        onConfirm={handleDelete(q.id)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
