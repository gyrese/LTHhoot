import { EVENTS } from "@rahoot/common/constants"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import Button from "@rahoot/web/components/Button"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import { useNavigate } from "@tanstack/react-router"
import {
  FolderOpen,
  LayoutGrid,
  List,
  Search,
  SquarePen,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { type ChangeEvent, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const ConfigManageQuizz = () => {
  const { quizz } = useConfig()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [gridView, setGridView] = useState(true)

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    toast.error(t(message))
  })

  const handleDelete = (id: string) => () => {
    socket?.emit(EVENTS.QUIZZ.DELETE, id)
    toast.success(t("manager:quizz.deleted"))
  }

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {return}

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

  const allFolders = useMemo(
    () => [...new Set(quizz.map((q) => q.folder).filter(Boolean) as string[])],
    [quizz],
  )

  const allTags = useMemo(
    () => [...new Set(quizz.flatMap((q) => q.tags ?? []))],
    [quizz],
  )

  const filtered = useMemo(
    () =>
      quizz.filter((q) => {
        if (search && !q.subject.toLowerCase().includes(search.toLowerCase())) {
          return false
        }

        if (activeFolder && q.folder !== activeFolder) {
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Toolbar */}
      <div className="flex shrink-0 gap-2">
        <Button className="flex-1" onClick={() => navigate({ to: "/manager/quizz" })}>
          {t("manager:quizz.create")}
        </Button>
        <Button
          className="bg-gray-100 px-3 text-gray-600"
          onClick={() => fileInputRef.current?.click()}
          title={t("manager:quizz.import")}
        >
          <Upload className="size-4" />
        </Button>
        <button
          type="button"
          onClick={() => setGridView((v) => !v)}
          className="rounded bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
          title={gridView ? "List view" : "Grid view"}
        >
          {gridView ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-yellow-400"
          placeholder={t("manager:quizz.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Folder filters */}
      {allFolders.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {allFolders.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setActiveFolder(activeFolder === folder ? null : folder)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                activeFolder === folder
                  ? "bg-yellow-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <FolderOpen className="size-3" />
              {folder}
            </button>
          ))}
        </div>
      )}

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                activeTag === tag
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Tag className="size-3" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Quiz list / grid */}
      <div className={`min-h-0 flex-1 overflow-auto p-0.5 ${gridView ? "grid grid-cols-2 gap-2 content-start" : "space-y-2"}`}>
        {filtered.map((q) => (
          gridView ? (
            <div
              key={q.id}
              className="flex flex-col justify-between rounded-md border border-gray-200 bg-white p-3 shadow-sm"
            >
              {q.listingImage && (
                <div className="mb-2 h-32 w-full shrink-0 overflow-hidden rounded-md bg-gray-100">
                  <img src={q.listingImage} className="h-full w-full object-cover" alt="" />
                </div>
              )}
              <p className="mb-1 truncate font-semibold text-gray-800">{q.subject}</p>

              {q.folder && (
                <p className="mb-1 flex items-center gap-1 text-xs text-gray-400">
                  <FolderOpen className="size-3" />
                  {q.folder}
                </p>
              )}

              {q.tags && q.tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {q.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-0.5">
                <button
                  className="rounded-sm p-1.5 text-gray-500 hover:bg-gray-100"
                  onClick={() => navigate({ to: "/manager/quizz/$quizzId", params: { quizzId: q.id } })}
                >
                  <SquarePen className="size-4" />
                </button>
                <AlertDialog
                  trigger={
                    <button className="rounded-sm p-1.5 hover:bg-red-50">
                      <Trash2 className="size-4 stroke-red-500" />
                    </button>
                  }
                  title={t("manager:quizz.delete")}
                  description={t("manager:quizz.deleteConfirm", { name: q.subject })}
                  confirmLabel={t("common:delete")}
                  onConfirm={handleDelete(q.id)}
                />
              </div>
            </div>
          ) : (
            <div
              key={q.id}
              className="flex h-12 w-full items-center justify-between rounded-md pr-1.5 pl-3 outline outline-gray-300"
            >
              <div className="flex min-w-0 flex-col">
                <p className="truncate text-sm font-semibold">{q.subject}</p>
                {q.folder && (
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <FolderOpen className="size-3" />
                    {q.folder}
                  </p>
                )}
              </div>
              <div className="flex gap-0.5">
                <button
                  className="rounded-sm p-2 text-gray-600 hover:bg-gray-600/10"
                  onClick={() => navigate({ to: "/manager/quizz/$quizzId", params: { quizzId: q.id } })}
                >
                  <SquarePen className="size-4" />
                </button>
                <AlertDialog
                  trigger={
                    <button className="rounded-sm p-2 hover:bg-red-600/10">
                      <Trash2 className="size-4 stroke-red-500" />
                    </button>
                  }
                  title={t("manager:quizz.delete")}
                  description={t("manager:quizz.deleteConfirm", { name: q.subject })}
                  confirmLabel={t("common:delete")}
                  onConfirm={handleDelete(q.id)}
                />
              </div>
            </div>
          )
        ))}

        {filtered.length === 0 && (
          <p className="col-span-2 my-8 text-center text-gray-500">
            {search || activeFolder || activeTag
              ? t("manager:quizz.notFound")
              : t("manager:quizz.none")}
          </p>
        )}
      </div>
    </div>
  )
}

export default ConfigManageQuizz
