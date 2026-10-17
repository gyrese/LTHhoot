import { animate, createScope } from "animejs"
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

export default function useLibraryMotion(
  root: RefObject<HTMLDivElement | null>,
  revision: string,
) {
  const previous = useRef(new Map<string, { left: number; top: number }>())
  const keyboard = useRef(false)
  useEffect(() => {
    const onKey = () => {
      keyboard.current = true
    }
    const onPointer = () => {
      keyboard.current = false
    }
    const onResize = () => previous.current.clear()
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("pointerdown", onPointer, true)
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("pointerdown", onPointer, true)
      window.removeEventListener("resize", onResize)
    }
  }, [])
  useLayoutEffect(() => {
    if (!root.current) {
      return undefined
    }
    const nodes = [
      ...root.current.querySelectorAll<HTMLElement>("[data-library-id]"),
    ]
    const next = new Map<string, { left: number; top: number }>()
    const before = previous.current
    const origin = root.current.getBoundingClientRect()
    const { scrollTop } = root.current
    let entering = 0
    const scope = createScope({
      root: root.current,
      mediaQueries: { reducedMotion: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      nodes.forEach((node) => {
        const rect = node.getBoundingClientRect()
        const id = node.dataset.libraryId!
        const position = {
          left: rect.left - origin.left,
          top: rect.top - origin.top + scrollTop,
        }
        next.set(id, position)
        const old = before.get(id)
        if (
          !old &&
          !self?.matches.reducedMotion &&
          !keyboard.current &&
          rect.bottom > Math.max(0, origin.top) &&
          rect.top < Math.min(window.innerHeight, origin.bottom)
        ) {
          animate(node, {
            opacity: [0.35, 1],
            translateY: [20, 0],
            scale: [0.97, 1],
            duration: 260,
            delay: Math.min(entering * 24, 120),
            ease: "out(4)",
          })
          entering += 1
        }
        if (
          !self?.matches.reducedMotion &&
          !keyboard.current &&
          old &&
          rect.bottom > Math.max(0, origin.top) &&
          rect.top < Math.min(window.innerHeight, origin.bottom)
        ) {
          const x = old.left - position.left
          const y = old.top - position.top
          if (Math.abs(x) + Math.abs(y) > 1) {
            animate(node, {
              translateX: [x, 0],
              translateY: [y, 0],
              duration: 260,
              ease: "out(4)",
            })
          }
        }
      })
    })
    previous.current = next
    return () => {
      scope.revert()
    }
  }, [root, revision])
}
