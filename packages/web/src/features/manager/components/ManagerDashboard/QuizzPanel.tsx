import { EVENTS } from "@rahoot/common/constants"
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
  FileDown,
  Plus,
  Search,
  SquarePen,
  Trash2,
  Upload,
  X,
  Share2,
} from "lucide-react"
import React, { type ChangeEvent, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ShareSocialModal } from "@rahoot/web/features/manager/components/ShareSocialModal"
import {
  downloadJson,
  exportQuizzWithMedia,
} from "@rahoot/web/features/quizz/utils/export"
import { exportQuizzToPptx } from "@rahoot/web/features/quizz/utils/export-pptx"
import { parseQuestionsCsv } from "@rahoot/web/features/quizz/utils/import-csv"
import {
  isArchived,
  isGuestFolder,
} from "@rahoot/web/features/manager/utils/folders"
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
  const exportTypeRef = useRef<"json" | "pptx">("json")
  const [shareModalQuizz, setShareModalQuizz] = useState<{
    id: string
    subject: string
    publicName?: string
  } | null>(null)
  const { t } = useTranslation()

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    toast.error(t(message))
  })

  useEvent(EVENTS.QUIZZ.DATA, async (data) => {
    const isPptx = exportTypeRef.current === "pptx"
    const loadingToast = toast.loading(
      t("manager:quizz.exporting", "Exportation en cours..."),
    )

    try {
      if (isPptx) {
        await exportQuizzToPptx(data)
      } else {
        const fullQuizz = await exportQuizzWithMedia(data)
        downloadJson(fullQuizz, data.subject)
      }

      toast.success(t("manager:quizz.exported"), { id: loadingToast })
    } catch (error) {
      console.error("Export failed:", error)
      toast.error(t("errors:quizz.exportFailed", "L'exportation a échoué"), {
        id: loadingToast,
      })
    }
  })

  const handleDelete = (id: string) => () => {
    socket?.emit(EVENTS.QUIZZ.DELETE, id)

    if (selectedQuizz === id) {
      setSelectedQuizz(null)
    }

    toast.success(t("manager:quizz.deleted"))
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
          const quizzPayload = {
            subject: quizzSubject,
            questions: parsed.questions,
            tags: [],
            folder: "",
          }

          socket?.emit(EVENTS.QUIZZ.SAVE, quizzPayload)

          if (parsed.errors.length > 0) {
            toast.success(
              `${t("quizz:importCsvSuccess", { count: parsed.questions.length })}. ${t("quizz:importCsvIgnored", { count: parsed.errors.length })}`,
            )
          } else {
            toast.success(
              t("quizz:importCsvSuccess", { count: parsed.questions.length }),
            )
          }
        } catch (err) {
          console.error("CSV import parse error:", err)
          toast.error(t("quizz:importCsvFailed"))
        }
      } else {
        try {
          const data = JSON.parse(text)
          socket?.emit(EVENTS.QUIZZ.SAVE, data)
          toast.success(t("manager:quizz.imported"))
        } catch {
          toast.error("Invalid JSON file")
        }
      }
    }

    reader.readAsText(file)
    e.target.value = ""
  }

  const handleExport = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    exportTypeRef.current = "json"
    socket?.emit(EVENTS.QUIZZ.GET, id)
  }

  const handleExportPptx = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    exportTypeRef.current = "pptx"
    socket?.emit(EVENTS.QUIZZ.GET, id)
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

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            className="w-full rounded-xl bg-white/10 py-2 pr-8 pl-9 text-sm text-white placeholder-white/40 transition-colors outline-none focus:bg-white/15"
            placeholder={t("manager:quizz.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => navigate({ to: "/manager/quizz" })}
          className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-400"
        >
          <Plus className="size-4" />
          {t("manager:quizz.create")}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl bg-white/10 p-2 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
          title={t("manager:quizz.import")}
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
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-white/40">
              {t("manager:quizz.notFound")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] content-start gap-3">
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
                  onClick={() => {
                    if (eveningMode) {
                      onToggleEveningQuizz?.(q.id)
                    } else {
                      setSelectedQuizz(isSelected ? null : q.id)
                    }
                  }}
                  className={clsx(
                    "group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 transition-all duration-200",
                    isSelected
                      ? "scale-[0.97] shadow-xl ring-2 shadow-orange-500/40 ring-orange-400 ring-offset-2 ring-offset-black/0"
                      : "hover:scale-[1.03] hover:shadow-xl hover:shadow-black/40",
                  )}
                >
                  {q.listingImage && (
                    <img
                      src={q.listingImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {isSelected && !eveningMode && (
                    <div className="absolute top-2 right-2 rounded-full bg-orange-500 p-0.5 shadow-md">
                      <Check className="size-3.5 stroke-[3] text-white" />
                    </div>
                  )}

                  {isSelected && eveningMode && (
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white shadow-md">
                      {eveningOrder}
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!isReadonly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate({
                            to: "/manager/quizz/$quizzId",
                            params: { quizzId: q.id },
                          })
                        }}
                        className="rounded-lg bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
                        title={t("common:edit")}
                      >
                        <SquarePen className="size-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShareModalQuizz({
                          id: q.id,
                          subject: q.subject,
                          publicName: q.publicName,
                        })
                      }}
                      className="rounded-lg bg-black/50 p-1.5 text-orange-400 backdrop-blur-sm hover:bg-black/70"
                      title="Diffuser sur les réseaux sociaux"
                    >
                      <Share2 className="size-3.5" />
                    </button>
                    {!isReadonly && (
                      <AlertDialog
                        trigger={
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg bg-black/50 p-1.5 text-red-400 backdrop-blur-sm hover:bg-black/70"
                            title={t("common:delete")}
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

                  <div className="absolute right-0 bottom-0 left-0 p-3">
                    <p className="line-clamp-2 text-sm leading-tight font-bold text-white drop-shadow-md">
                      {q.subject}
                    </p>
                    {q.folder && (
                      <p
                        className={clsx(
                          "mt-0.5 truncate text-xs",
                          isReadonly
                            ? "font-semibold text-orange-300"
                            : "text-white/60",
                        )}
                      >
                        {q.folder}
                      </p>
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
          onClose={() => setShareModalQuizz(null)}
        />
      )}
    </div>
  )
}

export default QuizzPanel
