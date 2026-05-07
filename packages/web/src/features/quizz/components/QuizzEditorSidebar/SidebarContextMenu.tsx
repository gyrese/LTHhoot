import { Plus, Copy, Trash2, ArrowUp, ArrowDown, Palette } from "lucide-react"
import { useTranslation } from "react-i18next"
import { type CSSProperties, useEffect, useRef } from "react"

export type SidebarAction =
  | "add"
  | "duplicate"
  | "delete"
  | "moveUp"
  | "moveDown"
  | "changeBackground"

type SidebarContextMenuProps = {
  x: number
  y: number
  index: number
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onClose: () => void
  onAction: (_action: SidebarAction, _index: number) => void
}

const SidebarContextMenu = ({
  x,
  y,
  index,
  canDelete,
  canMoveUp,
  canMoveDown,
  onClose,
  onAction,
}: SidebarContextMenuProps) => {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (e.button === 2) {
        return
      }

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onClose])

  const handleAction = (action: SidebarAction) => {
    onAction(action, index)
    onClose()
  }

  const menuStyle: CSSProperties = {
    top: Math.min(y, window.innerHeight - 250),
    left: Math.min(x, window.innerWidth - 200),
  }

  return (
    <div
      ref={menuRef}
      className="pointer-events-auto fixed z-[100] w-56 rounded-xl border border-gray-200 bg-white py-1.5 text-sm text-gray-700 shadow-2xl"
      style={menuStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={() => handleAction("add")}
        className="flex w-full items-center gap-3 px-3 py-2 text-left font-medium transition-colors hover:bg-gray-100"
      >
        <Plus className="size-4 text-gray-500" />{" "}
        {t("quizz:addQuestion", "Nouvelle slide")}
      </button>
      <button
        onClick={() => handleAction("duplicate")}
        className="flex w-full items-center gap-3 px-3 py-2 text-left font-medium transition-colors hover:bg-gray-100"
      >
        <Copy className="size-4 text-gray-500" />{" "}
        {t("quizz:question.duplicateQuestion", "Dupliquer")}
      </button>

      <div className="mx-2 my-1.5 h-px bg-gray-100" />

      <button
        onClick={() => handleAction("moveUp")}
        disabled={!canMoveUp}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left font-medium transition-colors ${canMoveUp ? "hover:bg-gray-100" : "cursor-not-allowed opacity-30"}`}
      >
        <ArrowUp className="size-4 text-gray-500" />{" "}
        {t("common:moveUp", "Monter")}
      </button>
      <button
        onClick={() => handleAction("moveDown")}
        disabled={!canMoveDown}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left font-medium transition-colors ${canMoveDown ? "hover:bg-gray-100" : "cursor-not-allowed opacity-30"}`}
      >
        <ArrowDown className="size-4 text-gray-500" />{" "}
        {t("common:moveDown", "Descendre")}
      </button>

      <div className="mx-2 my-1.5 h-px bg-gray-100" />

      <button
        onClick={() => handleAction("changeBackground")}
        className="flex w-full items-center gap-3 px-3 py-2 text-left font-medium transition-colors hover:bg-gray-100"
      >
        <Palette className="size-4 text-gray-500" />{" "}
        {t("quizz:question.config.propertiesTitle", "Arrière-plan...")}
      </button>

      <div className="mx-2 my-1.5 h-px bg-gray-100" />

      <button
        onClick={() => handleAction("delete")}
        disabled={!canDelete}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left font-medium transition-colors ${canDelete ? "text-red-600 hover:bg-red-50" : "cursor-not-allowed opacity-30"}`}
      >
        <Trash2 className="size-4" /> {t("common:delete", "Supprimer")}
      </button>
    </div>
  )
}

export default SidebarContextMenu
