import { createTimeline } from "animejs"
import { useLayoutEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

const boltShape =
  "polygon(54% 0, 93% 0, 65% 38%, 100% 38%, 24% 100%, 40% 54%, 5% 54%)"
const boltLayers = [-6, -4, -2, 0, 2, 4, 6]

export default function DoublePointsAnnouncement() {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)
  const bolt = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const multiplier = useRef<HTMLSpanElement>(null)
  const message = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (
      !panel.current ||
      !bolt.current ||
      !ring.current ||
      !multiplier.current ||
      !message.current ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined
    }

    const timeline = createTimeline({ defaults: { ease: "outCubic" } })
      .add(
        panel.current,
        { opacity: [0, 1], scale: [0.78, 1], duration: 360, ease: "outBack" },
        0,
      )
      .add(bolt.current, { rotateY: [-105, 348], duration: 880 }, 60)
      .add(
        ring.current,
        { opacity: [0.85, 0], scale: [0.5, 1.55], duration: 640 },
        140,
      )
      .add(
        multiplier.current,
        {
          opacity: [0, 1],
          scale: [0.45, 1],
          rotate: [-12, 0],
          duration: 440,
          ease: "outBack",
        },
        190,
      )
      .add(message.current, { opacity: [0, 1], y: [8, 0], duration: 280 }, 330)

    return () => {
      timeline.revert()
    }
  }, [])

  return (
    <div
      ref={panel}
      className="relative isolate flex w-fit max-w-full items-center gap-3 rounded-3xl border border-amber-300/45 bg-slate-950 px-4 py-3 text-amber-100 shadow-[0_0_38px_#f59e0b38,inset_0_0_24px_#f59e0b20] sm:gap-5 sm:px-6"
    >
      <div
        aria-hidden="true"
        className="relative h-14 w-12 shrink-0 [perspective:220px] sm:h-20 sm:w-16"
      >
        <div
          ref={ring}
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-300 opacity-0"
        />
        <div
          ref={bolt}
          className="absolute inset-0 [transform-style:preserve-3d]"
        >
          {boltLayers.map((depth) => (
            <div
              key={depth}
              className={
                Math.abs(depth) === 6
                  ? "absolute inset-0 bg-linear-to-br from-amber-50 via-yellow-300 to-orange-500"
                  : "absolute inset-0 bg-amber-700"
              }
              style={{
                clipPath: boltShape,
                transform: `translateZ(${depth}px)`,
              }}
            />
          ))}
        </div>
      </div>
      <span
        ref={multiplier}
        aria-hidden="true"
        className="shrink-0 text-5xl leading-none font-black tracking-tighter text-white drop-shadow-[0_0_10px_#f59e0b80] sm:text-7xl"
      >
        ×2
      </span>
      <div ref={message}>
        <div className="text-sm font-black tracking-[0.16em] uppercase sm:text-lg">
          {t("game:roundEvent.doublePoints")}
        </div>
        <div className="text-xs text-white/80 sm:text-sm">
          {t("game:roundEvent.doublePointsHint")}
        </div>
      </div>
    </div>
  )
}
