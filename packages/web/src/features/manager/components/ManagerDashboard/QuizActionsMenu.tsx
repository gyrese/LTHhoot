import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { MoreHorizontal } from "lucide-react"
import { animate, createScope } from "animejs"

export type QuizMenuAction = {
  label: string
  icon: ReactNode
  onSelect: () => void
  danger?: boolean
}

export default function QuizActionsMenu({
  label,
  actions,
}: {
  label: string
  actions: QuizMenuAction[]
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const menuId = useId()
  const keyboard = useRef(false)
  const lastItem = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = (restore = true) => {
    setOpen(false)
    if (restore) {
      trigger.current?.focus()
    }
  }
  useLayoutEffect(() => {
    if (!open) {
      return undefined
    }
    const anchor = trigger.current!.getBoundingClientRect()
    const height = Math.min(
      panel.current!.scrollHeight,
      window.innerHeight - 24,
    )
    const top = Math.max(
      12,
      Math.min(anchor.bottom + 8, window.innerHeight - height - 12),
    )
    setPosition({
      left: Math.max(12, Math.min(anchor.right - 236, window.innerWidth - 248)),
      top,
    })
    const items = panel.current?.querySelectorAll<HTMLButtonElement>("button")
    items?.[lastItem.current ? items.length - 1 : 0]?.focus()
    const scope = createScope({
      root: panel.current!,
      mediaQueries: { reducedMotion: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      if (!self?.matches.reducedMotion && !keyboard.current) {
        panel.current!.style.transformOrigin =
          top >= anchor.bottom ? "top right" : "bottom right"
        animate(panel.current!, {
          opacity: [0.4, 1],
          translateY: [top >= anchor.bottom ? -6 : 6, 0],
          scale: [0.97, 1],
          duration: 170,
          ease: "out(4)",
        })
        items?.forEach((item, index) => {
          animate(item, {
            translateX: [-4, 0],
            opacity: [0.5, 1],
            duration: 150,
            delay: Math.min(index * 16, 64),
            ease: "out(4)",
          })
        })
      }
    })
    return () => {
      scope.revert()
    }
  }, [open])
  useEffect(() => {
    if (!open) {
      return undefined
    }
    const outside = (event: Event) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      ) {
        close(false)
      }
    }
    const reposition = (event: Event) => {
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        panel.current?.contains(event.target)
      ) {
        return
      }
      close(false)
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("focusin", outside)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("focusin", outside)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open])
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          keyboard.current = event.detail === 0
          lastItem.current = false
          setOpen((value) => !value)
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            keyboard.current = true
            lastItem.current = event.key === "ArrowUp"
            setOpen(true)
          }
        }}
        className="dashboard-icon bg-black/45 text-white"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={menuId}
            role="menu"
            aria-label={label}
            style={position}
            className="dashboard-menu fixed z-50 max-h-[calc(100dvh-24px)] w-[236px] overflow-y-auto rounded-xl border border-white/15 bg-black/85 p-1.5 text-white backdrop-blur-xl"
            onKeyDown={(event) => {
              const items = [
                ...panel.current!.querySelectorAll<HTMLButtonElement>("button"),
              ]
              const current = items.indexOf(
                document.activeElement as HTMLButtonElement,
              )
              if (event.key === "Escape") {
                event.preventDefault()
                event.stopPropagation()
                close()
              }
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault()
                let next =
                  (current +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    items.length) %
                  items.length
                if (event.key === "Home") {
                  next = 0
                }
                if (event.key === "End") {
                  next = items.length - 1
                }
                items[next]?.focus()
              }
            }}
          >
            {actions.map((action) => (
              <button
                key={action.label}
                role="menuitem"
                type="button"
                className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none ${action.danger ? "text-red-300" : "text-white/90"}`}
                onClick={() => {
                  close()
                  action.onSelect()
                }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
