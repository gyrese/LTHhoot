import { Plus, Copy, Trash2, ArrowUp, ArrowDown, Palette } from "lucide-react"
import { useTranslation } from "react-i18next"
import { motion, useReducedMotion } from "motion/react"
import { type CSSProperties, useEffect, useRef } from "react"

const itemClass =
  "focus-ring flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left font-medium transition-colors duration-150 hover:bg-panel"

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
  const reduceMotion = useReducedMotion()
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
    transformOrigin: "top left",
  }

  return (
    <motion.div
      ref={menuRef}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
      className="border-border bg-elevated text-ink pointer-events-auto fixed z-[100] w-56 rounded-xl border p-1.5 text-sm shadow-2xl shadow-black/20"
      style={menuStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button onClick={() => handleAction("add")} className={itemClass}>
        <Plus className="text-ink-subtle size-4" />{" "}
        {t("quizz:addQuestion", "Nouvelle slide")}
      </button>
      <button onClick={() => handleAction("duplicate")} className={itemClass}>
        <Copy className="text-ink-subtle size-4" />{" "}
        {t("quizz:question.duplicateQuestion", "Dupliquer")}
      </button>

      <div className="bg-border/70 mx-1.5 my-1.5 h-px" />

      <button
        onClick={() => handleAction("moveUp")}
        disabled={!canMoveUp}
        className={`${itemClass} ${!canMoveUp && "cursor-not-allowed opacity-30 hover:bg-transparent"}`}
      >
        <ArrowUp className="text-ink-subtle size-4" />{" "}
        {t("common:moveUp", "Monter")}
      </button>
      <button
        onClick={() => handleAction("moveDown")}
        disabled={!canMoveDown}
        className={`${itemClass} ${!canMoveDown && "cursor-not-allowed opacity-30 hover:bg-transparent"}`}
      >
        <ArrowDown className="text-ink-subtle size-4" />{" "}
        {t("common:moveDown", "Descendre")}
      </button>

      <div className="bg-border/70 mx-1.5 my-1.5 h-px" />

      <button
        onClick={() => handleAction("changeBackground")}
        className={itemClass}
      >
        <Palette className="text-ink-subtle size-4" />{" "}
        {t("quizz:question.config.propertiesTitle", "Arrière-plan...")}
      </button>

      <div className="bg-border/70 mx-1.5 my-1.5 h-px" />

      <button
        onClick={() => handleAction("delete")}
        disabled={!canDelete}
        className={`focus-ring flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left font-medium transition-colors duration-150 ${canDelete ? "text-danger hover:bg-danger-soft" : "cursor-not-allowed opacity-30"}`}
      >
        <Trash2 className="size-4" /> {t("common:delete", "Supprimer")}
      </button>
    </motion.div>
  )
}

export default SidebarContextMenu
