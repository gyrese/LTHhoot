import { useConfig } from "@rahoot/web/features/manager/contexts/config-context"
import {
  Archive,
  BarChart2,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import { ARCHIVE_FOLDER, isArchived } from "@rahoot/web/features/manager/utils/folders"
import { useMemo, useState, useEffect, type DragEvent, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

const FOLDERS_KEY = "rahoot:folders"

type FolderNode = {
  path: string
  label: string
  children: FolderNode[]
}

type Props = {
  activeFolder: string | null
  setActiveFolder: (_f: string | null) => void
  activeTag: string | null
  setActiveTag: (_t: string | null) => void
  view: "quizz" | "results"
  setView: (_v: "quizz" | "results") => void
  onMoveToFolder: (_quizzId: string, _folder: string | null) => void
}

const buildTree = (paths: string[]): FolderNode[] => {
  const nodes: Record<string, FolderNode> = {}
  const roots: FolderNode[] = []

  for (const path of [...paths].sort()) {
    const parts = path.split("/")
    const label = parts[parts.length - 1]
    const node: FolderNode = { path, label, children: [] }
    nodes[path] = node

    if (parts.length === 1) {
      roots.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join("/")

      if (nodes[parentPath]) {
        nodes[parentPath].children.push(node)
      } else {
        roots.push(node)
      }
    }
  }

  return roots
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  // Null = pas en création, "" = racine, "Maths" = sous-dossier de Maths
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState("")

  const [userFolders, setUserFolders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]")
    } catch {
      return []
    }
  })

  const foldersFromQuizz = useMemo(
    () => [...new Set(quizz.map((q) => q.folder).filter(Boolean) as string[])],
    [quizz],
  )

  const allFolders = useMemo(
    () => [...new Set([ARCHIVE_FOLDER, ...foldersFromQuizz, ...userFolders])],
    [foldersFromQuizz, userFolders],
  )

  const tree = useMemo(() => buildTree(allFolders), [allFolders])

  useEffect(() => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(userFolders))
  }, [userFolders])

  const tags = useMemo(
    () => [...new Set(quizz.flatMap((q) => q.tags ?? []))],
    [quizz],
  )

  const countInFolder = (path: string) =>
    quizz.filter((q) => q.folder === path || q.folder?.startsWith(`${path  }/`)).length

  const handleDrop = (e: DragEvent, folder: string | null) => {
    e.preventDefault()
    const quizzId = e.dataTransfer.getData("quizzId")

    if (quizzId) {onMoveToFolder(quizzId, folder)}

    setDragOverFolder(null)
  }

  const handleDragOver = (e: DragEvent, key: string | "root") => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverFolder(key)
  }

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)

      if (next.has(path)) {next.delete(path)}
      else {next.add(path)}
      
return next
    })
  }

  const startCreate = (parentPath: string | null) => {
    setCreatingIn(parentPath ?? "")
    setNewFolderName("")

    if (parentPath) {
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.delete(parentPath)

        
return next
      })
    }
  }

  const confirmCreate = () => {
    const name = newFolderName.trim()

    if (name) {
      const fullPath = creatingIn ? `${creatingIn}/${name}` : name

      if (!allFolders.includes(fullPath)) {
        setUserFolders((prev) => [...prev, fullPath])
      }
    }

    setNewFolderName("")
    setCreatingIn(null)
  }

  const handleCreateKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {confirmCreate()}

    if (e.key === "Escape") { setCreatingIn(null); setNewFolderName("") }
  }

  const startRename = (path: string) => {
    setEditingFolder(path)
    setEditName(path.split("/").pop() ?? path)
  }

  const confirmRename = (oldPath: string) => {
    const newLabel = editName.trim()
    setEditingFolder(null)

    if (!newLabel || newLabel === oldPath.split("/").pop()) {return}

    const parts = oldPath.split("/")
    parts[parts.length - 1] = newLabel
    const newPath = parts.join("/")

    setUserFolders((prev) =>
      prev.map((f) => {
        if (f === oldPath) {return newPath}

        if (f.startsWith(`${oldPath  }/`)) {return newPath + f.slice(oldPath.length)}
        
return f
      }),
    )

    quizz.forEach((q) => {
      if (q.folder === oldPath) {
        onMoveToFolder(q.id, newPath)
      } else if (q.folder?.startsWith(`${oldPath  }/`)) {
        onMoveToFolder(q.id, newPath + q.folder.slice(oldPath.length))
      }
    })

    if (activeFolder === oldPath) {setActiveFolder(newPath)}
    else if (activeFolder?.startsWith(`${oldPath  }/`)) {
      setActiveFolder(newPath + activeFolder.slice(oldPath.length))
    }
  }

  const handleRenameKey = (e: KeyboardEvent, path: string) => {
    if (e.key === "Enter") {confirmRename(path)}

    if (e.key === "Escape") {setEditingFolder(null)}
  }

  const handleDeleteFolder = (path: string) => {
    quizz
      .filter((q) => q.folder === path || q.folder?.startsWith(`${path  }/`))
      .forEach((q) => {
        onMoveToFolder(q.id, null)
      })

    setUserFolders((prev) =>
      prev.filter((f) => f !== path && !f.startsWith(`${path  }/`)),
    )

    if (activeFolder === path || activeFolder?.startsWith(`${path  }/`)) {
      setActiveFolder(null)
    }
  }

  const renderFolder = (node: FolderNode, depth: number) => {
    const isActive = activeFolder === node.path
    const isDragOver = dragOverFolder === node.path
    const isCollapsed = collapsed.has(node.path)
    const isEditing = editingFolder === node.path
    const isCreatingSub = creatingIn === node.path
    const count = countInFolder(node.path)
    const indent = depth * 12

    return (
      <div key={node.path}>
        <div
          className="group flex items-center gap-0.5"
          style={{ paddingLeft: indent }}
        >
          {/* Chevron expand/collapse */}
          <button
            onClick={() => toggleCollapse(node.path)}
            className={clsx(
              "shrink-0 rounded p-0.5 text-white/30 transition-colors",
              node.children.length > 0 ? "hover:text-white/70" : "pointer-events-none opacity-0",
            )}
          >
            <ChevronRight
              className={clsx(
                "size-3 transition-transform duration-150",
                !isCollapsed && node.children.length > 0 && "rotate-90",
              )}
            />
          </button>

          {/* Folder button ou input renommage */}
          {isEditing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => handleRenameKey(e, node.path)}
              onBlur={() => confirmRename(node.path)}
              className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white outline-none focus:bg-white/15"
            />
          ) : (
            <button
              onClick={() => setActiveFolder(isActive ? null : node.path)}
              onDragOver={(e) => handleDragOver(e, node.path)}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => handleDrop(e, node.path)}
              className={clsx(
                "flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl px-2 py-1.5 text-sm transition-colors",
                isDragOver && "bg-orange-500/30 ring-1 ring-orange-400",
                !isDragOver && isActive && "bg-white/20 font-semibold text-white",
                !isDragOver && !isActive && "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {node.path === ARCHIVE_FOLDER ? (
                  <Archive className="size-3.5 shrink-0 text-amber-300/80" />
                ) : (
                  <FolderOpen className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{node.label}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-xs">{count}</span>
            </button>
          )}

          {/* Actions au hover */}
          {!isEditing && (
            <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => startCreate(node.path)}
                className="rounded p-0.5 text-white/30 hover:text-orange-400"
                title="Nouveau sous-dossier"
              >
                <Plus className="size-3" />
              </button>
              <button
                onClick={() => startRename(node.path)}
                className="rounded p-0.5 text-white/30 hover:text-blue-400"
                title="Renommer"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={() => handleDeleteFolder(node.path)}
                className="rounded p-0.5 text-white/30 hover:text-red-400"
                title={t("manager:sidebar.deleteFolder")}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          )}
        </div>

        {/* Input création sous-dossier */}
        {isCreatingSub && (
          <div
            className="mt-0.5 flex items-center gap-1 pr-1"
            style={{ paddingLeft: indent + 20 }}
          >
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={handleCreateKey}
              placeholder="Nom du sous-dossier"
              className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:bg-white/15"
            />
            <button onClick={confirmCreate} className="rounded p-1 text-orange-400 hover:bg-white/10">
              <Plus className="size-3" />
            </button>
            <button
              onClick={() => { setCreatingIn(null); setNewFolderName("") }}
              className="rounded p-1 text-white/40 hover:bg-white/10"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* Enfants */}
        {!isCollapsed && node.children.length > 0 && (
          <div>{node.children.map((child) => renderFolder(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
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
              <p className="text-xs font-semibold tracking-wider text-white/40 uppercase">
                {t("manager:sidebar.folders")}
              </p>
              <button
                onClick={() => startCreate(null)}
                className="rounded p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                title={t("manager:sidebar.newFolder")}
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            {/* Input création dossier racine */}
            {creatingIn === "" && (
              <div className="mb-1 flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleCreateKey}
                  placeholder={t("manager:sidebar.newFolderPlaceholder")}
                  className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:bg-white/15"
                />
                <button onClick={confirmCreate} className="rounded p-1 text-orange-400 hover:bg-white/10">
                  <Plus className="size-3" />
                </button>
                <button
                  onClick={() => { setCreatingIn(null); setNewFolderName("") }}
                  className="rounded p-1 text-white/40 hover:bg-white/10"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              {/* Tous */}
              <button
                onClick={() => setActiveFolder(null)}
                onDragOver={(e) => handleDragOver(e, "root")}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => handleDrop(e, null)}
                className={clsx(
                  "flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors",
                  dragOverFolder === "root" && "bg-orange-500/30 ring-1 ring-orange-400",
                  dragOverFolder !== "root" && activeFolder === null && "bg-white/20 font-semibold text-white",
                  dragOverFolder !== "root" && activeFolder !== null && "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="size-3.5" />
                  {t("manager:sidebar.all")}
                </span>
                <span className="rounded-full bg-white/10 px-1.5 text-xs">
                  {quizz.filter((q) => !isArchived(q.folder)).length}
                </span>
              </button>

              {/* Arbre de dossiers */}
              {tree.map((node) => renderFolder(node, 0))}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-xs font-semibold tracking-wider text-white/40 uppercase">
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
