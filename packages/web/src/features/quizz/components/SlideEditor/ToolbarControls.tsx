import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { ChevronDown } from "lucide-react"
import clsx from "clsx"

export const toolbarInputClass =
  "focus-ring border-border bg-surface text-ink h-9 rounded-md border px-2 text-sm"

export function ToolButton({
  label,
  icon,
  active,
  iconOnly = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  icon?: ReactNode
  active?: boolean
  iconOnly?: boolean
}) {
  return (
    <button
      type="button"
      {...props}
      title={props.title ?? label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        "focus-ring flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-primary-soft text-primary-ink"
          : "text-ink-muted hover:bg-panel hover:text-ink",
        className,
      )}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  )
}

// Portal prevents clipping when toolbars wrap. This is a non-modal panel:
// Escape restores focus, clicking or tabbing elsewhere closes it.
export function ToolbarPopover({
  label,
  children,
  icon,
  iconOnly = false,
  open: controlledOpen,
  onOpenChange,
  resetKey,
  triggerClassName,
}: {
  label: string
  children: ReactNode | ((_close: () => void) => ReactNode)
  icon?: ReactNode
  iconOnly?: boolean
  open?: boolean
  onOpenChange?: (_open: boolean) => void
  resetKey?: string
  triggerClassName?: string
}) {
  const id = useId()
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const setOpen = (next: boolean) => {
    setLocalOpen(next)
    onOpenChange?.(next)
  }
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 300 })
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  useLayoutEffect(() => {
    if (wasOpen.current && !open && document.activeElement === document.body) {
      trigger.current?.focus()
    }
    wasOpen.current = open
  }, [open])
  useEffect(() => {
    setOpen(false)
  }, [resetKey])
  const close = () => setOpen(false)
  useLayoutEffect(() => {
    if (!open) {
      return () => undefined
    }
    const reposition = () => {
      const rect = trigger.current!.getBoundingClientRect()
      const height = window.visualViewport?.height ?? window.innerHeight
      const top = Math.min(rect.bottom + 6, Math.max(8, height - 240))
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)),
        top,
        maxHeight: Math.max(80, height - top - 8),
      })
    }
    reposition()
    const firstControl =
      panel.current?.querySelector<HTMLElement>("input, select, textarea") ??
      panel.current?.querySelector<HTMLElement>("button")
    firstControl?.focus()
    window.addEventListener("resize", reposition)
    window.visualViewport?.addEventListener("resize", reposition)
    return () => {
      window.removeEventListener("resize", reposition)
      window.visualViewport?.removeEventListener("resize", reposition)
    }
  }, [open])
  useEffect(() => {
    if (!open) {
      return () => undefined
    }
    const outside = (event: Event) => {
      const target = event.target as Node
      if (
        !panel.current?.contains(target) &&
        !trigger.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("focusin", outside)
    document.addEventListener("keydown", escape, true)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("focusin", outside)
      document.removeEventListener("keydown", escape, true)
    }
  }, [open])
  return (
    <>
      <button
        ref={trigger}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className={clsx(
          "focus-ring text-ink-muted hover:bg-panel flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium",
          triggerClassName,
        )}
      >
        {icon}
        {!iconOnly && label}
        {!iconOnly && <ChevronDown className="size-3.5" />}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            onKeyDown={(event) => event.stopPropagation()}
            style={position}
            className="border-border bg-surface text-ink fixed z-50 m-0 w-80 max-w-[calc(100vw-16px)] overflow-auto rounded-lg border p-4 shadow-md"
          >
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  )
}

export function NumberControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (_value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <label className="text-ink-muted flex items-center justify-between gap-3 text-sm">
      {label}
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={draft}
        className={`${toolbarInputClass} w-20`}
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          const next = Number(raw)
          if (
            raw.trim() &&
            Number.isFinite(next) &&
            next >= min &&
            next <= max
          ) {
            onChange(next)
          }
        }}
        onBlur={() => setDraft(String(value))}
      />
    </label>
  )
}

export function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (_value: string) => void
}) {
  return (
    <label className="text-ink-muted flex min-h-9 items-center justify-between gap-2 text-sm">
      {label}
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring border-border h-8 w-10 cursor-pointer rounded border bg-transparent p-1"
      />
    </label>
  )
}
