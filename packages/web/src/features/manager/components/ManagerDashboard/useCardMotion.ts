import { animate, createScope } from "animejs"
import { useEffect, useRef, type RefObject } from "react"

/** Keep card interaction transforms separate from the library's layout motion. */
export default function useCardMotion(
  root: RefObject<HTMLElement | null>,
  selected: boolean,
) {
  const keyboard = useRef(false)

  useEffect(() => {
    const node = root.current
    if (!node) {
      return undefined
    }
    const onKey = () => {
      keyboard.current = true
    }
    const onPointer = () => {
      keyboard.current = false
    }
    const onClick = (event: MouseEvent) => {
      keyboard.current = event.detail === 0
    }
    node.addEventListener("keydown", onKey, true)
    node.addEventListener("pointerdown", onPointer, true)
    node.addEventListener("click", onClick, true)
    const scope = createScope({
      root: node,
      mediaQueries: {
        reducedMotion: "(prefers-reduced-motion: reduce)",
      },
    }).add((self) => {
      if (
        !self ||
        self.matches.reducedMotion ||
        node.dataset.cardLayout === "grid"
      ) {
        return undefined
      }
      const cover = node.querySelector("[data-cover]")
      const action = node.querySelector("[data-card-action]")
      self.add("hover", (active: boolean, instant = false) => {
        const list = node.dataset.cardLayout === "list"
        const duration = instant ? 0 : 180 + Number(active) * 80
        const hoverScale = list ? 1.04 : 1.08
        if (cover) {
          animate(cover, {
            scale: active ? hoverScale : 1,
            translateY: active && !list ? -4 : 0,
            duration,
            ease: "out(4)",
          })
        }
        if (action) {
          animate(action, {
            translateX: active ? 4 : 0,
            duration,
            ease: "out(4)",
          })
        }
      })
      let hovering = false
      let ignoreMouseUntil = 0
      // Embedded browsers may dispatch mouse events without a known pointer type.
      const enter = (event: MouseEvent | PointerEvent) => {
        if ("pointerType" in event && event.pointerType === "touch") {
          ignoreMouseUntil = performance.now() + 800
          return
        }
        if (hovering || performance.now() < ignoreMouseUntil) {
          return
        }
        hovering = true
        scope.methods.hover(true)
      }
      const leave = () => {
        if (!hovering) {
          return
        }
        hovering = false
        scope.methods.hover(false)
      }
      const reset = () => {
        if (!hovering) {
          return
        }
        hovering = false
        scope.methods.hover(false, true)
      }
      node.addEventListener("pointerenter", enter)
      node.addEventListener("pointerleave", leave)
      node.addEventListener("mouseenter", enter)
      node.addEventListener("mouseleave", leave)
      node.addEventListener("dragstart", reset)
      node.addEventListener("keydown", reset)
      return () => {
        node.removeEventListener("pointerenter", enter)
        node.removeEventListener("pointerleave", leave)
        node.removeEventListener("mouseenter", enter)
        node.removeEventListener("mouseleave", leave)
        node.removeEventListener("dragstart", reset)
        node.removeEventListener("keydown", reset)
      }
    })
    return () => {
      node.removeEventListener("keydown", onKey, true)
      node.removeEventListener("pointerdown", onPointer, true)
      node.removeEventListener("click", onClick, true)
      scope.revert()
    }
  }, [root])

  useEffect(() => {
    const node = root.current
    if (!node || !selected || keyboard.current) {
      return undefined
    }
    const scope = createScope({
      root: node,
      mediaQueries: { reducedMotion: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      const mark = node.querySelector("[data-selection]")
      if (!self?.matches.reducedMotion && mark) {
        animate(mark, {
          scale: [0.72, 1],
          translateY: [3, 0],
          opacity: [0.55, 1],
          duration: 200,
          ease: "out(4)",
        })
      }
    })
    return () => scope.revert()
  }, [root, selected])
}
