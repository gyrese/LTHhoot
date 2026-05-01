import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import { BarChart2, FolderOpen, LayoutGrid, Plus, Tag, Trash2, X } from "lucide-react"
import { useMemo, useState, useEffect, type DragEvent } from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

const FOLDERS_KEY = "rahoot:folders"

type Props = {
  activeFolder: string | null
  setActiveFolder: (f: string | null) => void
  activeTag: string | null
  setActiveTag: (t: string | null) => void
  view: "quizz" | "results"
  setView: (v: "quizz" | "results") => void
  onMoveToFolder: (quizzId: string, folder: string | null) => void
}

const DashboardSidebar = ({
  activeFolder,
  setActiveFolder,
  activeTag,
  setActiveTag,
  view,
  setView,
  onMoveToFolder,
}: Props) => {
  const { quizz, results } = useConfig()
  const { t } = useTranslation()
  const [dragOverFolder, setDragOverFolder] = useState<string | "root" | null>(null)
  const [userFolders, setUserFolders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]")
    } catch {
      return []
    }
  })
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  const foldersFromQuizz = useMemo(
    () => [...new Set(quizz.map((q) => q.folder).filter(Boolean) as string[])],
    [quizz],
  )

  const allFolders = useMemo(
    () => [...new Set([...foldersFromQuizz, ...userFolders])],
    [foldersFromQuizz, userFolders],
  )

  useEffect(() => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(userFolders))
  }, [userFolders])

  const tags = useMemo(
    () => [...new Set(quizz.flatMap((q) => q.tags ?? []))],
    [quizz],
  )

  const handleDrop = (e: DragEvent, folder: string | null) => {
    e.preventDefault()
    const quizzId = e.dataTransfer.getData("quizzId")
    if (quizzId) {
      onMoveToFolder(quizzId, folder)
    }
    setDragOverFolder(null)
  }

  const handleDragOver = (e: DragEvent, key: string | "root") => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverFolder(key)
  }

  const handleCreateFolder = () => {
    const name = newFolderName.trim()
    if (name && !allFolders.includes(name)) {
      setUserFolders((prev) => [...prev, name])
    }
    setNewFolderName("")
    setCreatingFolder(false)
  }

  const handleDeleteFolder = (folder: string) => {
    quizz.filter((q) => q.folder === folder).forEach((q) => onMoveToFolder(q.id, null))
    setUserFolders((prev) => prev.filter((f) => f !== folder))
    if (activeFolder === folder) setActiveFolder(null)
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-black/30 p-3 backdrop-blur-md border border-white/10">
      {/* Navigation */}
      <div className="flex flex-col gap-1">
        <button
          onClick={() => setView("quizz")}
          className={clsx(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
            view === "quizz"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
              : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          <LayoutGrid className="size-4" />
          {t("manager:tabs.quizz")}
        </button>
        <button
          onClick={() => setView("results")}
          className={clsx(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
            view === "results"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
              : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          <BarChart2 className="size-4" />
          {t("manager:tabs.results")}
          {results.length > 0 && (
            <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {results.length}
            </span>
          )}
        </button>
      </div>

      {/* Dossiers */}
      {view === "quizz" && (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Dossiers
              </p>
              <button
                onClick={() => setCreatingFolder(true)}
                className="rounded p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                title="Nouveau dossier"
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            {creatingFolder && (
              <div className="mb-1 flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder()
                    if (e.key === "Escape") {
                      setCreatingFolder(false)
                      setNewFolderName("")
                    }
                  }}
                  placeholder="Nom du dossier"
                  className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:bg-white/15"
                />
                <button
                  onClick={handleCreateFolder}
                  className="rounded p-1 text-orange-400 hover:bg-white/10"
                >
                  <Plus className="size-3" />
                </button>
                <button
                  onClick={() => { setCreatingFolder(false); setNewFolderName("") }}
                  className="rounded p-1 text-white/40 hover:bg-white/10"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1">
              {/* Tous — drop target pour retirer d'un dossier */}
              <button
                onClick={() => setActiveFolder(null)}
                onDragOver={(e) => handleDragOver(e, "root")}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => handleDrop(e, null)}
                className={clsx(
                  "flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors",
                  dragOverFolder === "root"
                    ? "bg-orange-500/30 ring-1 ring-orange-400"
                    : activeFolder === null
                      ? "bg-white/20 font-semibold text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="size-3.5" />
                  Tous
                </span>
                <span className="rounded-full bg-white/10 px-1.5 text-xs">
                  {quizz.length}
                </span>
              </button>

              {allFolders.map((folder) => {
                const count = quizz.filter((q) => q.folder === folder).length
                return (
                  <div key={folder} className="group flex items-center gap-1">
                    <button
                      onClick={() => setActiveFolder(activeFolder === folder ? null : folder)}
                      onDragOver={(e) => handleDragOver(e, folder)}
                      onDragLeave={() => setDragOverFolder(null)}
                      onDrop={(e) => handleDrop(e, folder)}
                      className={clsx(
                        "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors",
                        dragOverFolder === folder
                          ? "bg-orange-500/30 ring-1 ring-orange-400"
                          : activeFolder === folder
                            ? "bg-white/20 font-semibold text-white"
                            : "text-white/60 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FolderOpen className="size-3.5 shrink-0" />
                        <span className="truncate">{folder}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-xs">
                        {count}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder)}
                      className="hidden shrink-0 rounded p-0.5 text-white/30 hover:text-red-400 group-hover:block"
                      title="Supprimer le dossier"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-white/40">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    className={clsx(
                      "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                      activeTag === tag
                        ? "bg-orange-500 text-white"
                        : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white",
                    )}
                  >
                    <Tag className="size-3" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  )
}

export default DashboardSidebar
