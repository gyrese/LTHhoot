import AlertDialog from "@rahoot/web/components/AlertDialog"
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
  Users,
  X,
  Check,
} from "lucide-react"
import {
  ARCHIVE_FOLDER,
  GUEST_FOLDER,
  isArchived,
  isGuestFolder,
} from "@rahoot/web/features/manager/utils/folders"
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type DragEvent,
  type KeyboardEvent,
} from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

// Clé localStorage des dossiers custom (créés côté client, sans quiz dedans).
// SCOPÉE par session : sans ça, un dossier créé par l'admin (ex. "hauf") reste
// dans le localStorage du navigateur et fuite vers toute session invité ouverte
// sur le même appareil, alors que ce dossier n'existe dans aucune bibliothèque.
const foldersStorageKey = (role: string | undefined, guestName?: string) =>
  role === "guest"
    ? `rahoot:folders:guest:${guestName ?? "unknown"}`
    : "rahoot:folders"

type FolderNode = {
  path: string
  label: string
  children: FolderNode[]
}

type Props = {
  // Tiroir sous `lg` : ouvert depuis le bouton menu du header.
  isOpen: boolean
  onClose: () => void
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

// Boutons d'action d'un dossier : 44 px sur écran tactile (pas de survol).
const FOLDER_ACTION =
  "rounded p-0.5 text-white/50 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:flex [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-11 [@media(hover:none)]:items-center [@media(hover:none)]:justify-center"

// Petits boutons icône des champs de création / renommage.
const INPUT_ACTION =
  "flex min-h-8 min-w-8 items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-11"

const DashboardSidebar = ({
  isOpen,
  onClose,
  activeFolder,
  setActiveFolder,
  activeTag,
  setActiveTag,
  view,
  setView,
  onMoveToFolder,
}: Props) => {
  const { quizz, results, role, guestName } = useConfig()
  const { t } = useTranslation()
  const isGuestSession = role === "guest"
  const foldersKey = foldersStorageKey(role, guestName)

  const [dragOverFolder, setDragOverFolder] = useState<string | "root" | null>(
    null,
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  // Null = pas en création, "" = racine, "Maths" = sous-dossier de Maths
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState("")
  // Message de validation affiché sous le champ de création / renommage.
  const [folderError, setFolderError] = useState<string | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const asideRef = useRef<HTMLElement>(null)

  const [userFolders, setUserFolders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(foldersKey) ?? "[]")
    } catch {
      return []
    }
  })

  const foldersFromQuizz = useMemo(
    () => [...new Set(quizz.map((q) => q.folder).filter(Boolean) as string[])],
    [quizz],
  )

  // « Invités/<nom> » n'existe que comme sous-chemin (aucun quiz n'a le folder
  // "Invités" seul) : buildTree ne peut donc pas créer le nœud parent tout
  // seul et pousse chaque compte à la racine. On l'ajoute explicitement dès
  // qu'au moins un guest a un quiz non-archivé, pour un unique dossier
  // « Invités » regroupant tous les comptes en sous-dossiers.
  const hasGuestFolder = useMemo(
    () => foldersFromQuizz.some((f) => isGuestFolder(f)),
    [foldersFromQuizz],
  )

  const allFolders = useMemo(
    () => [
      ...new Set([
        ARCHIVE_FOLDER,
        ...(hasGuestFolder ? [GUEST_FOLDER] : []),
        ...foldersFromQuizz,
        ...userFolders,
      ]),
    ],
    [foldersFromQuizz, hasGuestFolder, userFolders],
  )

  const tree = useMemo(() => buildTree(allFolders), [allFolders])

  useEffect(() => {
    localStorage.setItem(foldersKey, JSON.stringify(userFolders))
  }, [foldersKey, userFolders])

  const tags = useMemo(
    () => [...new Set(quizz.flatMap((q) => q.tags ?? []))],
    [quizz],
  )

  // Tiroir ouvert (sous `lg`) : Échap le referme, et le focus y entre pour
  // que la navigation au clavier commence dans le tiroir.
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    closeButtonRef.current?.focus()

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const active = document.activeElement
      // Échap dans une confirmation (AlertDialog, hors du tiroir) ne ferme
      // que la confirmation.
      const isInside =
        active === document.body ||
        (active !== null && asideRef.current?.contains(active))

      if (e.key === "Escape" && isInside) {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  // Choisir une destination referme le tiroir (sans effet au-delà de `lg`).
  const navigateTo = (action: () => void) => {
    action()
    onClose()
  }

  // Nom de dossier valide au niveau `parentPath` ("" = racine). `currentPath`
  // est le dossier renommé, qui ne doit pas entrer en conflit avec lui-même.
  // Renvoie un message traduit, ou null si le nom est accepté.
  const validateFolderName = (
    name: string,
    parentPath: string,
    currentPath?: string,
  ) => {
    if (!name) {
      return t("manager:sidebar.errors.empty")
    }

    // Un « / » créerait une arborescence cachée dans le nom.
    if (name.includes("/")) {
      return t("manager:sidebar.errors.slash")
    }

    const fullPath = parentPath ? `${parentPath}/${name}` : name
    const lower = fullPath.toLowerCase()
    const isReserved =
      !parentPath &&
      [ARCHIVE_FOLDER, GUEST_FOLDER].some((f) => f.toLowerCase() === lower)
    const exists = allFolders.some(
      (f) => f !== currentPath && f.toLowerCase() === lower,
    )

    // Nom déjà pris au même niveau : sans ce refus, le renommage fusionnait
    // silencieusement deux dossiers.
    if (isReserved || exists) {
      return t("manager:sidebar.errors.exists", { name })
    }

    return null
  }

  const countInFolder = (path: string) =>
    quizz.filter((q) => q.folder === path || q.folder?.startsWith(`${path}/`))
      .length

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

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)

      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }

      return next
    })
  }

  const cancelCreate = () => {
    setCreatingIn(null)
    setNewFolderName("")
    setFolderError(null)
  }

  const startCreate = (parentPath: string | null) => {
    setCreatingIn(parentPath ?? "")
    setNewFolderName("")
    setEditingFolder(null)
    setFolderError(null)

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
    const parentPath = creatingIn ?? ""
    const error = validateFolderName(name, parentPath)

    if (error) {
      setFolderError(error)

      return
    }

    setUserFolders((prev) => [
      ...prev,
      parentPath ? `${parentPath}/${name}` : name,
    ])
    cancelCreate()
  }

  const handleCreateKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      confirmCreate()
    }

    if (e.key === "Escape") {
      // Échap annule la saisie sans refermer le tiroir.
      e.stopPropagation()
      cancelCreate()
    }
  }

  const startRename = (path: string) => {
    setEditingFolder(path)
    setEditName(path.split("/").pop() ?? path)
    setCreatingIn(null)
    setFolderError(null)
  }

  const cancelRename = () => {
    setEditingFolder(null)
    setFolderError(null)
  }

  // `fromBlur` : quitter le champ avec un nom invalide annule le renommage
  // (on ne retient pas le focus) ; avec Entrée, le champ reste ouvert et le
  // message explique le refus.
  const confirmRename = (oldPath: string, fromBlur = false) => {
    const newLabel = editName.trim()

    if (newLabel === oldPath.split("/").pop()) {
      cancelRename()

      return
    }

    const parts = oldPath.split("/")
    const parentPath = parts.slice(0, -1).join("/")
    const error = validateFolderName(newLabel, parentPath, oldPath)

    if (error) {
      if (fromBlur) {
        cancelRename()
      } else {
        setFolderError(error)
      }

      return
    }

    cancelRename()
    parts[parts.length - 1] = newLabel
    const newPath = parts.join("/")

    setUserFolders((prev) =>
      prev.map((f) => {
        if (f === oldPath) {
          return newPath
        }

        if (f.startsWith(`${oldPath}/`)) {
          return newPath + f.slice(oldPath.length)
        }

        return f
      }),
    )

    quizz.forEach((q) => {
      if (q.folder === oldPath) {
        onMoveToFolder(q.id, newPath)
      } else if (q.folder?.startsWith(`${oldPath}/`)) {
        onMoveToFolder(q.id, newPath + q.folder.slice(oldPath.length))
      }
    })

    if (activeFolder === oldPath) {
      setActiveFolder(newPath)
    } else if (activeFolder?.startsWith(`${oldPath}/`)) {
      setActiveFolder(newPath + activeFolder.slice(oldPath.length))
    }
  }

  const handleRenameKey = (e: KeyboardEvent, path: string) => {
    if (e.key === "Enter") {
      confirmRename(path)
    }

    if (e.key === "Escape") {
      e.stopPropagation()
      cancelRename()
    }
  }

  const handleDeleteFolder = (path: string) => {
    quizz
      .filter((q) => q.folder === path || q.folder?.startsWith(`${path}/`))
      .forEach((q) => {
        onMoveToFolder(q.id, null)
      })

    setUserFolders((prev) =>
      prev.filter((f) => f !== path && !f.startsWith(`${path}/`)),
    )

    if (activeFolder === path || activeFolder?.startsWith(`${path}/`)) {
      setActiveFolder(null)
    }
  }

  // Champ de saisie d'un nom de dossier (création ou renommage) + message de
  // validation. Partagé par la racine, les sous-dossiers et le renommage.
  const renderFolderError = () =>
    folderError && (
      <p role="alert" className="mt-1 px-1 text-xs text-red-300">
        {folderError}
      </p>
    )

  const renderCreateInput = (placeholder: string, paddingLeft = 0) => (
    <div className="mt-0.5 mb-1 pr-1" style={{ paddingLeft }}>
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="text"
          value={newFolderName}
          onChange={(e) => {
            setNewFolderName(e.target.value)
            setFolderError(null)
          }}
          onKeyDown={handleCreateKey}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={Boolean(folderError)}
          className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white placeholder-white/50 outline-none focus:bg-white/15 focus:ring-2 focus:ring-orange-400/60"
        />
        <button
          type="button"
          onClick={confirmCreate}
          className={clsx(INPUT_ACTION, "text-orange-400 hover:bg-white/10")}
          aria-label={t("manager:sidebar.createConfirm")}
          title={t("manager:sidebar.createConfirm")}
        >
          <Check className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={cancelCreate}
          className={clsx(INPUT_ACTION, "text-white/60 hover:bg-white/10")}
          aria-label={t("common:cancel")}
          title={t("common:cancel")}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {renderFolderError()}
    </div>
  )

  const renderFolder = (node: FolderNode, depth: number) => {
    const isActive = activeFolder === node.path
    const isDragOver = dragOverFolder === node.path
    const isCollapsed = collapsed.has(node.path)
    const isEditing = editingFolder === node.path
    const isCreatingSub = creatingIn === node.path
    const count = countInFolder(node.path)
    // 8px par niveau (et non 12) : au-delà de deux niveaux, l'indentation
    // mangeait la largeur du nom, qui se retrouvait tronqué dès ~10 caractères.
    const indent = depth * 8
    // Dossier virtuel « Invités » : classement automatique par compte, aucune
    // action possible (ni drop, ni renommage, ni suppression, ni sous-dossier).
    const isGuest = isGuestFolder(node.path)
    // Dossier système « Archive » : cible de dépôt, mais ni renommable ni
    // supprimable (le serveur et le filtre « Tous » s'appuient sur son nom).
    const isArchiveRoot = node.path === ARCHIVE_FOLDER
    const hasChildren = node.children.length > 0

    let folderIcon = <FolderOpen className="size-3.5 shrink-0" />

    if (isArchiveRoot) {
      folderIcon = <Archive className="size-3.5 shrink-0 text-amber-300/80" />
    } else if (isGuest) {
      folderIcon = <Users className="size-3.5 shrink-0 text-orange-300/80" />
    }

    // Une icône colorée resterait invisible sur le fond orange du dossier actif.
    if (isActive) {
      folderIcon = <FolderOpen className="size-3.5 shrink-0" />
    }

    return (
      <div key={node.path}>
        <div
          className="group relative flex items-center gap-0.5"
          style={{ paddingLeft: indent }}
        >
          {/* Chevron expand/collapse */}
          <button
            type="button"
            onClick={() => toggleCollapse(node.path)}
            tabIndex={hasChildren ? 0 : -1}
            aria-hidden={!hasChildren}
            aria-expanded={hasChildren ? !isCollapsed : undefined}
            aria-label={
              isCollapsed
                ? t("manager:sidebar.expand", { name: node.label })
                : t("manager:sidebar.collapse", { name: node.label })
            }
            className={clsx(
              "shrink-0 rounded p-0.5 text-white/50 transition-colors focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none",
              hasChildren
                ? "hover:text-white/80"
                : "pointer-events-none opacity-0",
            )}
          >
            <ChevronRight
              className={clsx(
                "size-3 transition-transform duration-150",
                !isCollapsed && hasChildren && "rotate-90",
              )}
            />
          </button>

          {/* Folder button ou input renommage */}
          {isEditing ? (
            <div className="min-w-0 flex-1">
              <input
                autoFocus
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value)
                  setFolderError(null)
                }}
                onKeyDown={(e) => handleRenameKey(e, node.path)}
                onBlur={() => confirmRename(node.path, true)}
                aria-label={t("manager:sidebar.rename")}
                aria-invalid={Boolean(folderError)}
                className="w-full rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:bg-white/15 focus:ring-2 focus:ring-orange-400/60"
              />
              {renderFolderError()}
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigateTo(() => setActiveFolder(isActive ? null : node.path))
              }
              onDragOver={
                isGuest ? undefined : (e) => handleDragOver(e, node.path)
              }
              onDragLeave={isGuest ? undefined : () => setDragOverFolder(null)}
              onDrop={isGuest ? undefined : (e) => handleDrop(e, node.path)}
              aria-current={isActive ? "true" : undefined}
              className={clsx(
                "flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl px-2 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:min-h-11",
                isDragOver && "bg-orange-500/30 ring-1 ring-orange-400",
                !isDragOver &&
                  isActive &&
                  "bg-orange-500 font-semibold text-white shadow-lg shadow-orange-500/20",
                !isDragOver &&
                  !isActive &&
                  "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {folderIcon}
                {/* `title` : un nom long reste tronqué à l'affichage, mais
                    redevient lisible en entier au survol. */}
                <span className="truncate" title={node.label}>
                  {node.label}
                </span>
              </span>
              <span
                className={clsx(
                  "shrink-0 rounded-full px-1.5 text-xs",
                  isActive ? "bg-white/25" : "bg-white/10",
                )}
              >
                {count}
              </span>
            </button>
          )}

          {/* Actions — en overlay (absolute) et non dans le flux : en flux, ces
              3 boutons réservaient ~60px en permanence, même invisibles, ce
              qui tronquait le nom du dossier en pure perte. Visibles au survol,
              au focus clavier, et en permanence sur écran tactile (sans
              survol) où elles repassent dans le flux avec des cibles de 44 px. */}
          {!isEditing && !isGuest && !isArchiveRoot && (
            <div className="absolute top-1/2 right-0 flex -translate-y-1/2 items-center rounded-l-lg bg-gradient-to-l from-black/80 from-60% to-transparent pl-5 opacity-0 backdrop-blur-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:bg-none [@media(hover:none)]:pl-0 [@media(hover:none)]:opacity-100 [@media(hover:none)]:backdrop-blur-none">
              <button
                type="button"
                onClick={() => startCreate(node.path)}
                className={clsx(FOLDER_ACTION, "hover:text-orange-400")}
                title={t("manager:sidebar.newSubfolder")}
                aria-label={t("manager:sidebar.newSubfolder")}
              >
                <Plus className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => startRename(node.path)}
                className={clsx(FOLDER_ACTION, "hover:text-blue-400")}
                title={t("manager:sidebar.rename")}
                aria-label={t("manager:sidebar.rename")}
              >
                <Pencil className="size-3" />
              </button>
              <AlertDialog
                trigger={
                  <button
                    type="button"
                    className={clsx(FOLDER_ACTION, "hover:text-red-400")}
                    title={t("manager:sidebar.deleteFolder")}
                    aria-label={t("manager:sidebar.deleteFolder")}
                  >
                    <Trash2 className="size-3" />
                  </button>
                }
                title={t("manager:sidebar.deleteFolder")}
                description={t("manager:sidebar.deleteFolderConfirm", {
                  name: node.label,
                  count,
                })}
                confirmLabel={t("common:delete")}
                onConfirm={() => handleDeleteFolder(node.path)}
              />
            </div>
          )}
        </div>

        {/* Input création sous-dossier */}
        {isCreatingSub &&
          renderCreateInput(
            t("manager:sidebar.newSubfolderPlaceholder"),
            indent + 20,
          )}

        {/* Enfants */}
        {!isCollapsed && hasChildren && (
          <div>
            {node.children.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const navButtonClass = (active: boolean) =>
    clsx(
      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:min-h-11",
      active
        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
        : "text-white/70 hover:bg-white/10 hover:text-white",
    )

  const isAllActive = activeFolder === null

  return (
    <>
      {/* Fond du tiroir (sous `lg`) : un clic à l'extérieur le referme. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        ref={asideRef}
        id="manager-sidebar"
        aria-label={t("manager:sidebar.label")}
        className={clsx(
          "flex flex-col gap-4 overflow-y-auto border border-white/10 p-3 backdrop-blur-md",
          // Tiroir sous `lg` : hors écran (et hors tabulation) quand fermé.
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] rounded-r-2xl bg-black/85 transition-[transform,visibility] duration-200",
          isOpen ? "visible translate-x-0" : "invisible -translate-x-full",
          // Barre latérale fixe au-delà.
          "lg:visible lg:static lg:z-auto lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:rounded-2xl lg:bg-black/30 lg:transition-none 2xl:w-72",
        )}
      >
        {/* Fermeture du tiroir */}
        <div className="flex items-center justify-between lg:hidden">
          <p className="px-1 text-xs font-semibold tracking-wider text-white/60 uppercase">
            {t("manager:sidebar.label")}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
            aria-label={t("manager:sidebar.close")}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => navigateTo(() => setView("quizz"))}
            className={navButtonClass(view === "quizz")}
            aria-current={view === "quizz" ? "page" : undefined}
          >
            <LayoutGrid className="size-4" />
            {t("manager:tabs.quizz")}
          </button>
          {!isGuestSession && (
            <button
              type="button"
              onClick={() => navigateTo(() => setView("results"))}
              className={navButtonClass(view === "results")}
              aria-current={view === "results" ? "page" : undefined}
            >
              <BarChart2 className="size-4" />
              {t("manager:tabs.results")}
              {results.length > 0 && (
                <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                  {results.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Dossiers */}
        {view === "quizz" && (
          <>
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">
                  {t("manager:sidebar.folders")}
                </p>
                <button
                  type="button"
                  onClick={() => startCreate(null)}
                  className={clsx(
                    FOLDER_ACTION,
                    "transition-colors hover:bg-white/10 hover:text-white",
                  )}
                  title={t("manager:sidebar.newFolder")}
                  aria-label={t("manager:sidebar.newFolder")}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              {/* Input création dossier racine */}
              {creatingIn === "" &&
                renderCreateInput(t("manager:sidebar.newFolderPlaceholder"))}

              <div className="flex flex-col gap-0.5">
                {/* Tous */}
                <button
                  type="button"
                  onClick={() => navigateTo(() => setActiveFolder(null))}
                  onDragOver={(e) => handleDragOver(e, "root")}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={(e) => handleDrop(e, null)}
                  aria-current={isAllActive ? "true" : undefined}
                  className={clsx(
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:min-h-11",
                    dragOverFolder === "root" &&
                      "bg-orange-500/30 ring-1 ring-orange-400",
                    dragOverFolder !== "root" &&
                      isAllActive &&
                      "bg-orange-500 font-semibold text-white shadow-lg shadow-orange-500/20",
                    dragOverFolder !== "root" &&
                      !isAllActive &&
                      "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="size-3.5" />
                    {t("manager:sidebar.all")}
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-1.5 text-xs",
                      isAllActive ? "bg-white/25" : "bg-white/10",
                    )}
                  >
                    {
                      quizz.filter(
                        (q) =>
                          !isArchived(q.folder) && !isGuestFolder(q.folder),
                      ).length
                    }
                  </span>
                </button>

                {/* Arbre de dossiers */}
                {tree.map((node) => renderFolder(node, 0))}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <p className="mb-2 px-1 text-xs font-semibold tracking-wider text-white/60 uppercase">
                  {t("manager:sidebar.tags")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() =>
                        navigateTo(() =>
                          setActiveTag(activeTag === tag ? null : tag),
                        )
                      }
                      aria-pressed={activeTag === tag}
                      className={clsx(
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:min-h-11 [@media(hover:none)]:px-3.5",
                        activeTag === tag
                          ? "bg-orange-500 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
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
    </>
  )
}

export default DashboardSidebar
