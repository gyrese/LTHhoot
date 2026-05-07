import {
  type MouseEvent,
  type TouchEvent,
  type PointerEvent,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

// ── Helpers ───────────────────────────────────────────────────────────────────

const shuffleIndices = (length: number): number[] => {
  const arr = Array.from({ length }, (_, i) => i)

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }

  return arr
}

import { Reorder } from "motion/react"

// ── Puzzle ────────────────────────────────────────────────────────────────────

export const PuzzleAnswer = ({
  items,
  onOrderAnswer,
}: {
  items: string[]
  onOrderAnswer: (_order: number[]) => void
}) => {
  const [order, setOrder] = useState<number[]>(() =>
    shuffleIndices(items.length),
  )
  const [submitted, setSubmitted] = useState(false)
  const { t } = useTranslation()

  const handleSubmit = () => {
    if (!submitted) {
      setSubmitted(true)
      onOrderAnswer(order)
    }
  }

  return (
    <div className="mx-auto mb-4 w-full max-w-lg px-2">
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={!submitted ? setOrder : () => undefined}
        className="mb-4 flex flex-col gap-3"
      >
        {order.map((itemIdx, position) => (
          <Reorder.Item
            key={itemIdx}
            value={itemIdx}
            dragListener={!submitted}
            className={clsx(
              "relative flex touch-none items-center gap-4 rounded-2xl px-5 py-4 shadow-lg backdrop-blur-md transition-colors active:scale-[0.98]",
              submitted
                ? "bg-white/5 opacity-60"
                : "border border-white/10 bg-white/15 hover:bg-white/20",
            )}
            whileDrag={{
              scale: 1.05,
              backgroundColor: "rgba(255, 255, 255, 0.25)",
              boxShadow:
                "0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)",
              zIndex: 50,
            }}
          >
            <div className="bg-primary/20 text-primary border-primary/30 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black">
              {position + 1}
            </div>
            <span className="flex-1 text-lg font-bold tracking-tight text-white">
              {items[itemIdx]}
            </span>
            {!submitted && (
              <div className="flex flex-col items-center gap-1 opacity-40">
                <div className="h-1 w-6 rounded-full bg-white/50" />
                <div className="h-1 w-6 rounded-full bg-white/50" />
                <div className="h-1 w-6 rounded-full bg-white/50" />
              </div>
            )}
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <button
        type="button"
        disabled={submitted}
        onClick={handleSubmit}
        className="w-full rounded-2xl bg-yellow-500 py-4 text-xl font-black tracking-wider text-white uppercase shadow-[0_0_30px_rgba(255,153,0,0.3)] transition-all hover:scale-[1.02] hover:bg-yellow-600 active:scale-95 disabled:opacity-40"
      >
        {submitted ? t("game:answerSent") : t("common:submit")}
      </button>
    </div>
  )
}

// ── Drop Pin ──────────────────────────────────────────────────────────────────

export const DropPinAnswer = ({
  pinImage,
  onTextAnswer,
}: {
  pinImage: string
  onTextAnswer: (_text: string) => void
}) => {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const { t } = useTranslation()

  const handleImgClick = (e: MouseEvent | TouchEvent | PointerEvent) => {
    if (submitted) {
      return
    }

    e.preventDefault()

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()

    const clientX =
      "touches" in e
        ? (e as TouchEvent).touches[0].clientX
        : (e as MouseEvent).clientX
    const clientY =
      "touches" in e
        ? (e as TouchEvent).touches[0].clientY
        : (e as MouseEvent).clientY

    const xPct = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100),
    )
    const yPct = Math.max(
      0,
      Math.min(100, ((clientY - rect.top) / rect.height) * 100),
    )

    if (!isNaN(xPct) && !isNaN(yPct)) {
      setPin({ x: xPct, y: yPct })
    }
  }

  const handleSubmit = () => {
    if (pin !== null && !submitted) {
      setSubmitted(true)
      onTextAnswer(`${pin.x.toFixed(2)}:${pin.y.toFixed(2)}`)
    }
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 mx-auto mb-4 flex w-full max-w-3xl flex-col gap-4 px-2 duration-500"
      style={{ userSelect: "none" }}
    >
      {/* 🚀 PRO MAX UX: Tap anywhere on the image container */}
      <div className="relative flex w-full touch-none items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2 shadow-2xl">
        {!pin && !submitted && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="animate-pulse rounded-full border border-white/10 bg-black/60 px-6 py-3 text-sm font-bold text-white/90 shadow-xl backdrop-blur-md sm:text-base">
              Touchez l'image pour placer l'épingle
            </div>
          </div>
        )}

        <div className="relative inline-block max-w-full">
          <img
            src={pinImage}
            alt="Target"
            draggable={false}
            onPointerDown={handleImgClick}
            className="block h-auto max-h-[50vh] w-auto max-w-full cursor-crosshair rounded-xl object-contain transition-transform duration-300"
          />

          {pin !== null && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                // Align pin tip exactly on coordinate
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="animate-in zoom-in flex flex-col items-center drop-shadow-2xl duration-300">
                <div className="h-8 w-8 rounded-full border-4 border-white bg-red-500 shadow-lg" />
                <div className="h-4 w-1 bg-red-500 shadow-md" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          disabled={pin === null || submitted}
          onClick={handleSubmit}
          className="w-full max-w-sm transform rounded-2xl bg-yellow-500 px-6 py-4 text-xl font-bold text-white shadow-xl transition-all duration-300 hover:bg-yellow-600 active:scale-95 disabled:opacity-40"
        >
          {submitted ? t("game:answerSent") : t("common:submit")}
        </button>
      </div>
    </div>
  )
}
