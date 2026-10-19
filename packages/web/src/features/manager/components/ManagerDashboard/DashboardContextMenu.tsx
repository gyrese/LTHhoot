import { useEffect, useLayoutEffect, useRef, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import { motion, useReducedMotion } from "motion/react"
import type { QuizMenuAction } from "./QuizActionsMenu"

export type DashboardMenuState = {
  x: number
  y: number
  keyboard: boolean
  returnFocusTo: HTMLElement | null
  actions: QuizMenuAction[]
  label: string
}

export function contextMenuAt(
  event: MouseEvent<HTMLElement>,
  actions: QuizMenuAction[],
  label: string,
): DashboardMenuState | null {
  const target = event.target as HTMLElement
  if (
    !actions.length ||
    target.closest(
      "input, textarea, select, [contenteditable=true], [role=menu]",
    )
  ) {
    return null
  }
  event.preventDefault()
  event.stopPropagation()
  const anchor = target.closest<HTMLElement>("button, [tabindex]")
  const keyboard = event.clientX === 0 && event.clientY === 0
  const rect = (anchor ?? event.currentTarget).getBoundingClientRect()
  return {
    x: keyboard ? rect.left + 12 : event.clientX,
    y: keyboard ? rect.top + 12 : event.clientY,
    keyboard,
    returnFocusTo: anchor ?? (document.activeElement as HTMLElement | null),
    actions,
    label,
  }
}

export default function DashboardContextMenu({
  state,
  onClose,
}: {
  state: DashboardMenuState
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const close = (restore: boolean) => {
    if (restore && state.returnFocusTo?.isConnected) {
      state.returnFocusTo.focus({ preventScroll: true })
    }
    onClose()
  }
  useLayoutEffect(() => {
    const node = panel.current
    if (!node) {
      return
    }
    const { width, height } = node.getBoundingClientRect()
    node.style.left = `${Math.max(8, Math.min(state.x, window.innerWidth - width - 8))}px`
    node.style.top = `${Math.max(8, Math.min(state.y, window.innerHeight - height - 8))}px`
    node
      .querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true })
  }, [state])
  useEffect(() => {
    const outside = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    const dismiss = () => onClose()
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("focusin", outside)
    window.addEventListener("resize", dismiss)
    window.addEventListener("scroll", scroll, true)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("focusin", outside)
      window.removeEventListener("resize", dismiss)
      window.removeEventListener("scroll", scroll, true)
    }
  }, [onClose])
  return createPortal(
    <motion.div
      ref={panel}
      role="menu"
      aria-label={state.label}
      style={{ left: state.x, top: state.y, transformOrigin: "top left" }}
      className="dashboard-menu fixed z-50 max-h-[calc(100dvh-16px)] w-[236px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-white/20 bg-black/85 p-1.5 text-white shadow-xl backdrop-blur-xl"
      initial={
        reduced || state.keyboard ? false : { opacity: 0.5, scale: 0.97 }
      }
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduced || state.keyboard ? 0 : 0.16 }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault()
          event.stopPropagation()
          close(true)
          return
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          return
        }
        event.preventDefault()
        const items = [
          ...panel.current!.querySelectorAll<HTMLButtonElement>("button"),
        ]
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        let next =
          (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
          items.length
        if (event.key === "Home") {
          next = 0
        }
        if (event.key === "End") {
          next = items.length - 1
        }
        items[next]?.focus()
      }}
    >
      {state.actions.map((action) => (
        <button
          type="button"
          role="menuitem"
          key={action.label}
          className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-white/10 focus-visible:bg-white/10 ${action.danger ? "text-red-300" : "text-white/90"}`}
          onClick={() => {
            close(true)
            action.onSelect()
          }}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </motion.div>,
    document.body,
  )
}
