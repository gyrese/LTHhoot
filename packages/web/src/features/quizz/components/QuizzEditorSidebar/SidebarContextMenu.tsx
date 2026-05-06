import {
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Palette,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useEffect, useRef } from "react"

export type SidebarAction = "add" | "duplicate" | "delete" | "moveUp" | "moveDown" | "changeBackground"

type SidebarContextMenuProps = {
  x: number
  y: number
  index: number
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onClose: () => void
  onAction: (action: SidebarAction, index: number) => void
}

const SidebarContextMenu = ({ 
  x, 
  y, 
  index, 
  canDelete, 
  canMoveUp, 
  canMoveDown, 
  onClose, 
  onAction 
}: SidebarContextMenuProps) => {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (e.button === 2) return
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

  const menuStyle: React.CSSProperties = {
    top: Math.min(y, window.innerHeight - 250),
    left: Math.min(x, window.innerWidth - 200),
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-56 bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5 text-sm text-gray-700 pointer-events-auto"
      style={menuStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button onClick={() => handleAction("add")} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 transition-colors text-left font-medium">
        <Plus className="size-4 text-gray-500" /> {t("quizz:addQuestion", "Nouvelle slide")}
      </button>
      <button onClick={() => handleAction("duplicate")} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 transition-colors text-left font-medium">
        <Copy className="size-4 text-gray-500" /> {t("quizz:question.duplicateQuestion", "Dupliquer")}
      </button>
      
      <div className="h-px bg-gray-100 my-1.5 mx-2" />
      
      <button 
        onClick={() => handleAction("moveUp")} 
        disabled={!canMoveUp}
        className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left font-medium ${canMoveUp ? "hover:bg-gray-100" : "opacity-30 cursor-not-allowed"}`}
      >
        <ArrowUp className="size-4 text-gray-500" /> {t("common:moveUp", "Monter")}
      </button>
      <button 
        onClick={() => handleAction("moveDown")} 
        disabled={!canMoveDown}
        className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left font-medium ${canMoveDown ? "hover:bg-gray-100" : "opacity-30 cursor-not-allowed"}`}
      >
        <ArrowDown className="size-4 text-gray-500" /> {t("common:moveDown", "Descendre")}
      </button>

      <div className="h-px bg-gray-100 my-1.5 mx-2" />

      <button onClick={() => handleAction("changeBackground")} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 transition-colors text-left font-medium">
        <Palette className="size-4 text-gray-500" /> {t("quizz:question.config.propertiesTitle", "Arrière-plan...")}
      </button>

      <div className="h-px bg-gray-100 my-1.5 mx-2" />

      <button 
        onClick={() => handleAction("delete")} 
        disabled={!canDelete}
        className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left font-medium ${canDelete ? "hover:bg-red-50 text-red-600" : "opacity-30 cursor-not-allowed"}`}
      >
        <Trash2 className="size-4" /> {t("common:delete", "Supprimer")}
      </button>
    </div>
  )
}

export default SidebarContextMenu
