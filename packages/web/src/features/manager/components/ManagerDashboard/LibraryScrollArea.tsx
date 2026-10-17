import { motion, useMotionValue, useReducedMotion } from "motion/react"
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react"

type Props = {
  viewportRef: RefObject<HTMLDivElement | null>
  label: string
  children: ReactNode
}

/** The viewport keeps native scrolling; the rail only controls its position. */
export default function LibraryScrollArea({
  viewportRef,
  label,
  children,
}: Props) {
  const id = useId()
  const rail = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  const progressValue = useRef(0)
  const [metrics, setMetrics] = useState({ thumb: 0, travel: 0, max: 0 })
  const [active, setActive] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const y = useMotionValue(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const node = viewportRef.current
    const body = content.current
    if (!node || !body || typeof ResizeObserver === "undefined") {
      return undefined
    }
    const timer: { current: ReturnType<typeof setTimeout> | undefined } = {
      current: undefined,
    }
    let bounds = { thumb: 0, travel: 0, max: 0 }
    const sync = () => {
      const progress = bounds.max
        ? Math.min(1, Math.max(0, node.scrollTop / bounds.max))
        : 0
      y.set(progress * bounds.travel)
      progressValue.current = Math.round(progress * 100)
      rail.current?.setAttribute(
        "aria-valuenow",
        String(Math.round(progress * 100)),
      )
    }
    const measure = () => {
      // The rail has a 16px inset at each end, matching its CSS positioning.
      const height = Math.max(0, node.clientHeight - 32)
      const thumb = Math.min(
        height,
        Math.max(
          40,
          (height * node.clientHeight) / Math.max(1, node.scrollHeight),
        ),
      )
      bounds = {
        thumb,
        travel: height - thumb,
        max: Math.max(0, node.scrollHeight - node.clientHeight),
      }
      setMetrics((old) =>
        old.thumb === bounds.thumb &&
        old.travel === bounds.travel &&
        old.max === bounds.max
          ? old
          : bounds,
      )
      sync()
    }
    const onScroll = () => {
      sync()
      setActive(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setActive(false), 800)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    observer.observe(body)
    node.addEventListener("scroll", onScroll, { passive: true })
    measure()
    return () => {
      observer.disconnect()
      node.removeEventListener("scroll", onScroll)
      clearTimeout(timer.current)
    }
  }, [viewportRef, y])

  const scrollToPointer = (clientY: number, offset: number) => {
    const node = viewportRef.current
    const track = rail.current
    if (!node || !track || !metrics.travel) {
      return
    }
    const progress = Math.min(
      1,
      Math.max(
        0,
        (clientY - track.getBoundingClientRect().top - offset) / metrics.travel,
      ),
    )
    node.scrollTop = progress * metrics.max
    y.set(progress * metrics.travel)
    progressValue.current = Math.round(progress * 100)
    track.setAttribute("aria-valuenow", String(Math.round(progress * 100)))
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !metrics.travel) {
      return
    }
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    const thumb = event.currentTarget.querySelector("[data-scroll-thumb]")!
    drag.current = thumb.contains(event.target as Node)
      ? event.clientY - thumb.getBoundingClientRect().top
      : metrics.thumb / 2
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    scrollToPointer(event.clientY, drag.current)
  }
  const release = () => {
    drag.current = null
    setDragging(false)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const node = viewportRef.current
    if (!node) {
      return
    }
    const destinations: Record<string, number> = {
      ArrowDown: node.scrollTop + 48,
      ArrowUp: node.scrollTop - 48,
      PageDown: node.scrollTop + node.clientHeight * 0.9,
      PageUp: node.scrollTop - node.clientHeight * 0.9,
      Home: 0,
      End: metrics.max,
    }
    if (event.key in destinations) {
      event.preventDefault()
      const top = Math.min(metrics.max, Math.max(0, destinations[event.key]))
      node.scrollTop = top
      y.set(metrics.max ? (top / metrics.max) * metrics.travel : 0)
      progressValue.current = Math.round(
        metrics.max ? (top / metrics.max) * 100 : 0,
      )
      rail.current?.setAttribute(
        "aria-valuenow",
        String(Math.round(metrics.max ? (top / metrics.max) * 100 : 0)),
      )
    }
  }
  const illuminated = active || dragging || hovered || focused

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={viewportRef}
        id={id}
        data-custom-scroll={metrics.max > 0 || undefined}
        className="dashboard-scroll-viewport h-full overflow-y-auto rounded-[28px] border border-white/10 bg-black/[0.08] px-3 pt-4 pb-4 backdrop-blur-sm sm:px-4 sm:pr-6"
      >
        <div ref={content} className="flex min-h-full flex-col">
          {children}
        </div>
      </div>
      {metrics.max > 0 && (
        <motion.div
          ref={rail}
          role="scrollbar"
          tabIndex={0}
          aria-label={label}
          aria-controls={id}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressValue.current}
          className="dashboard-scroll-rail absolute inset-y-4 right-0.5 z-10 w-5 cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          animate={{ opacity: illuminated ? 1 : 0.55 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={(event) => {
            if (drag.current !== null) {
              scrollToPointer(event.clientY, drag.current)
            }
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId)
            release()
          }}
          onLostPointerCapture={release}
          onPointerCancel={release}
          onWheel={(event) => {
            const node = viewportRef.current
            if (node) {
              node.scrollTop +=
                event.deltaY *
                ([1, 16, node.clientHeight][event.deltaMode] ?? 1)
            }
          }}
        >
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10" />
          <motion.div
            data-scroll-thumb
            className="dashboard-scroll-thumb absolute top-0 left-1/2 -translate-x-1/2 rounded-full border border-orange-100/40 bg-linear-to-b from-orange-200 via-orange-400 to-orange-600"
            style={{ y, height: metrics.thumb }}
            animate={{
              width: illuminated ? 8 : 4,
              boxShadow: illuminated
                ? "0 0 14px rgb(249 115 22 / 0.4)"
                : "0 0 0px rgb(249 115 22 / 0)",
            }}
            transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </div>
  )
}
