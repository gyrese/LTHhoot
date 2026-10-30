import { Plus, Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { motion, useReducedMotion } from "motion/react"
import { type CSSProperties, useEffect, useRef } from "react"
import { createPortal } from "react-dom"

const itemClass =
  "focus-ring flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left font-medium transition-colors duration-150 hover:bg-panel"

export type SidebarAction =
  | "add"
  | "duplicate"
  | "delete"
  | "moveUp"
  | "moveDown"

type SidebarContextMenuProps = {
  x: number
  y: number
  index: number
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  returnFocusTo?: HTMLElement | null
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
  returnFocusTo,
  onClose,
  onAction,
}: SidebarContextMenuProps) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const menuRef = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(true)

  useEffect(() => {
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus()
    const handleClickOutside = (e: MouseEvent) => {
      if (e.button === 2) {
        return
      }

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        restoreFocus.current = false
        onClose()
      }
    }
    const handleFocusOutside = (event: FocusEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        restoreFocus.current = false
        onClose()
      }
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === "Home" || event.key === "End") {
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        )
        items[event.key === "Home" ? 0 : items.length - 1]?.focus()
        event.preventDefault()
        return
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return
      }
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? [],
      )
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      const delta = event.key === "ArrowDown" ? 1 : -1
      items[(current + delta + items.length) % items.length]?.focus()
      event.preventDefault()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("focusin", handleFocusOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("focusin", handleFocusOutside)
      document.removeEventListener("keydown", handleKeyDown)
      if (restoreFocus.current && returnFocusTo?.isConnected) {
        returnFocusTo.focus()
      }
    }
  }, [onClose, returnFocusTo])

  const handleAction = (action: SidebarAction) => {
    onAction(action, index)
    onClose()
  }

  const menuStyle: CSSProperties = {
    top: Math.max(8, Math.min(y, window.innerHeight - 230)),
    left: Math.max(8, Math.min(x, window.innerWidth - 230)),
    transformOrigin: "top left",
  }

  // Escape the sidebar's stacking context so canvas answers cannot cover the
  // menu. In the mobile modal, stay in its top layer and focus scope.
  const portalRoot = returnFocusTo?.closest("dialog[open]") ?? document.body

  return createPortal(
    <motion.div
      ref={menuRef}
      role="menu"
      aria-label={t("quizz:sidebar.actions", { number: index + 1 })}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
      className="border-border bg-elevated text-ink pointer-events-auto fixed z-[100] w-56 rounded-xl border p-1.5 text-sm shadow-2xl shadow-black/20"
      style={menuStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction("add")}
        className={itemClass}
      >
        <Plus className="text-ink-subtle size-4" />{" "}
        {t("quizz:addQuestion", "Nouvelle slide")}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction("duplicate")}
        className={itemClass}
      >
        <Copy className="text-ink-subtle size-4" />{" "}
        {t("quizz:question.duplicateQuestion", "Dupliquer")}
      </button>

      <div className="bg-border/70 mx-1.5 my-1.5 h-px" />

      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction("moveUp")}
        disabled={!canMoveUp}
        className={`${itemClass} ${!canMoveUp && "cursor-not-allowed opacity-30 hover:bg-transparent"}`}
      >
        <ArrowUp className="text-ink-subtle size-4" />{" "}
        {t("common:moveUp", "Monter")}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction("moveDown")}
        disabled={!canMoveDown}
        className={`${itemClass} ${!canMoveDown && "cursor-not-allowed opacity-30 hover:bg-transparent"}`}
      >
        <ArrowDown className="text-ink-subtle size-4" />{" "}
        {t("common:moveDown", "Descendre")}
      </button>

      <div className="bg-border/70 mx-1.5 my-1.5 h-px" />

      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction("delete")}
        disabled={!canDelete}
        className={`focus-ring flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left font-medium transition-colors duration-150 ${canDelete ? "text-danger hover:bg-danger-soft" : "cursor-not-allowed opacity-30"}`}
      >
        <Trash2 className="size-4" /> {t("common:delete", "Supprimer")}
      </button>
    </motion.div>,
    portalRoot,
  )
}

export default SidebarContextMenu
