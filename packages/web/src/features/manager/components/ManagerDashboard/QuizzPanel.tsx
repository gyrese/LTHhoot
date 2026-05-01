import { EVENTS } from "@rahoot/common/constants"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import { useNavigate } from "@tanstack/react-router"
import { Check, Plus, Search, SquarePen, Trash2, Upload, X } from "lucide-react"
import { type ChangeEvent, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"
import clsx from "clsx"

type Props = {
  search: string
  setSearch: (s: string) => void
  activeFolder: string | null
  activeTag: string | null
  selectedQuizz: string | null
  setSelectedQuizz: (id: string | null) => void
}

const QuizzPanel = ({
  search,
  setSearch,
  activeFolder,
  activeTag,
  selectedQuizz,
  setSelectedQuizz,
}: Props) => {
  const { quizz } = useConfig()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    toast.error(t(message))
  })

  const handleDelete = (id: string) => () => {
    socket?.emit(EVENTS.QUIZZ.DELETE, id)
    if (selectedQuizz === id) setSelectedQuizz(null)
    toast.success(t("manager:quizz.deleted"))
  }

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        socket?.emit(EVENTS.QUIZZ.SAVE, data)
      } catch {
        toast.error("Invalid JSON file")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const filtered = useMemo(
    () =>
      quizz.filter((q) => {
        if (search && !q.subject.toLowerCase().includes(search.toLowerCase()))
          return false
        if (activeFolder && q.folder !== activeFolder) return false
        if (activeTag && !(q.tags ?? []).includes(activeTag)) return false
        return true
      }),
    [quizz, search, activeFolder, activeTag],
  )

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl bg-black/30 p-4 backdrop-blur-md border border-white/10">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            className="w-full rounded-xl bg-white/10 py-2 pl-9 pr-8 text-sm text-white placeholder-white/40 outline-none transition-colors focus:bg-white/15"
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
          accept=".json"
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-3 content-start">
            {filtered.map((q) => {
              const isSelected = selectedQuizz === q.id
              return (
                <div
                  key={q.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("quizzId", q.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onClick={() => setSelectedQuizz(isSelected ? null : q.id)}
                  className={clsx(
                    "group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 transition-all duration-200",
                    isSelected
                      ? "scale-[0.97] shadow-xl shadow-orange-500/40 ring-2 ring-orange-400 ring-offset-2 ring-offset-black/0"
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

                  {isSelected && (
                    <div className="absolute top-2 right-2 rounded-full bg-orange-500 p-0.5 shadow-md">
                      <Check className="size-3.5 stroke-[3] text-white" />
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate({
                          to: "/manager/quizz/$quizzId",
                          params: { quizzId: q.id },
                        })
                      }}
                      className="rounded-lg bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
                    >
                      <SquarePen className="size-3.5" />
                    </button>
                    <AlertDialog
                      trigger={
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg bg-black/50 p-1.5 text-red-400 backdrop-blur-sm hover:bg-black/70"
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
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="line-clamp-2 text-sm font-bold leading-tight text-white drop-shadow-md">
                      {q.subject}
                    </p>
                    {q.folder && (
                      <p className="mt-0.5 truncate text-xs text-white/60">
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
    </div>
  )
}

export default QuizzPanel
