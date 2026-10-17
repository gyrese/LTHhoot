import { animate, createScope } from "animejs"
import { useLayoutEffect, useRef, type RefObject } from "react"

export default function useLaunchMotion(
  root: RefObject<HTMLDivElement | null>,
  active: boolean,
  evening: boolean,
  revision = "",
) {
  const previous = useRef({ active: false, evening, revision })
  useLayoutEffect(() => {
    const before = previous.current
    previous.current = { active, evening, revision }
    const node = root.current
    if (!active || !node || document.activeElement?.matches(":focus-visible")) {
      return undefined
    }
    const footer = node.querySelector("footer")
    if (!footer) {
      return undefined
    }
    const entering = !before.active || before.evening !== evening
    const scope = createScope({
      root: node,
      mediaQueries: { reducedMotion: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      if (self?.matches.reducedMotion) {
        return
      }
      if (entering) {
        animate(footer, {
          translateY: [24, 0],
          opacity: [0.35, 1],
          duration: 240,
          ease: "out(4)",
        })
      } else if (before.revision !== revision) {
        const content = footer.querySelector("[data-launch-content]")
        if (content) {
          animate(content, {
            translateY: [6, 0],
            opacity: [0.45, 1],
            duration: 180,
            ease: "out(4)",
          })
        }
      }
    })
    return () => scope.revert()
  }, [root, active, evening, revision])
}
