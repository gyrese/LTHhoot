import { useState } from "react"
import { useTranslation } from "react-i18next"

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

// ── Puzzle ────────────────────────────────────────────────────────────────────

export const PuzzleAnswer = ({
  items,
  onOrderAnswer,
}: {
  items: string[]
  onOrderAnswer: (_order: number[]) => void
}) => {
  const [order, setOrder] = useState<number[]>(() => shuffleIndices(items.length))
  const [submitted, setSubmitted] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const { t } = useTranslation()

  const swap = (a: number, b: number) => {
    setOrder((prev) => {
      const next = [...prev]
      const tmp = next[a]
      next[a] = next[b]
      next[b] = tmp
      return next
    })
  }

  const handleDrop = (targetIdx: number) => {
    if (dragIdx !== null && dragIdx !== targetIdx) {
      setOrder((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIdx, 1)
        next.splice(targetIdx, 0, moved)
        return next
      })
    }
    setDragIdx(null)
    setOverIdx(null)
  }

  const handleSubmit = () => {
    if (!submitted) {
      setSubmitted(true)
      onOrderAnswer(order)
    }
  }

  return (
    <div className="mx-auto mb-4 w-full max-w-lg px-2">
      <div className="mb-4 flex flex-col gap-2">
        {order.map((itemIdx, position) => {
          const isDragging = dragIdx === position
          const isOver = overIdx === position && dragIdx !== position

          return (
            <div
              key={itemIdx}
              draggable={!submitted}
              onDragStart={() => { setDragIdx(position); setOverIdx(null) }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(position) }}
              onDragLeave={() => setOverIdx(null)}
              onDrop={() => handleDrop(position)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
              style={{
                opacity: isDragging ? 0.4 : 1,
                transition: "opacity 0.15s, background-color 0.2s",
                animationDelay: `${position * 0.07}s`,
              }}
              className={`anim-rise flex cursor-grab items-center gap-3 rounded-xl px-4 py-3 backdrop-blur-sm active:cursor-grabbing ${
                isOver
                  ? "bg-yellow-400/30 ring-2 ring-yellow-400 scale-[1.02]"
                  : "bg-white/15 hover:bg-white/20"
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                {position + 1}
              </span>
              <span className="flex-1 font-semibold text-white">{items[itemIdx]}</span>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => swap(position, position - 1)}
                  disabled={position === 0 || submitted}
                  className="flex h-5 w-5 items-center justify-center text-white/70 hover:text-white disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => swap(position, position + 1)}
                  disabled={position === order.length - 1 || submitted}
                  className="flex h-5 w-5 items-center justify-center text-white/70 hover:text-white disabled:opacity-20"
                >
                  ▼
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        disabled={submitted}
        onClick={handleSubmit}
        className="w-full rounded-xl bg-yellow-500 px-8 py-3 font-bold text-white transition-transform hover:bg-yellow-600 hover:scale-[1.02] active:scale-95 disabled:opacity-40 enabled:anim-glow"
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
  const [placing, setPlacing] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [zoom, setZoom] = useState(1)
  const { t } = useTranslation()

  const handleImgClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!placing || submitted) { return }
    const rect = e.currentTarget.getBoundingClientRect()
    setPin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
    setPlacing(false)
  }

  const handleSubmit = () => {
    if (pin !== null && !submitted) {
      setSubmitted(true)
      onTextAnswer(`${pin.x.toFixed(2)}:${pin.y.toFixed(2)}`)
    }
  }

  const pinBtnLabel = placing
    ? t("game:dropPinCancel")
    : pin !== null
      ? t("game:dropPinReplace")
      : t("game:dropPinPlace")

  return (
    <div className="mx-auto mb-4 w-full max-w-2xl px-2" style={{ userSelect: "none" }}>
      {/* Conteneur clip avec zoom */}
      <div className="mb-2 overflow-hidden rounded-xl" style={{ maxHeight: "52vh" }}>
        <div
          style={{
            transformOrigin: "top center",
            transform: `scale(${zoom})`,
            transition: "transform 0.2s",
          }}
        >
          <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
            <img
              src={pinImage}
              alt=""
              draggable={false}
              onClick={handleImgClick}
              className="block w-full"
              style={{ cursor: placing && !submitted ? "crosshair" : "default" }}
            />
            <div className="pointer-events-none absolute inset-0">
              {pin !== null && (
                <div
                  style={{
                    position: "absolute",
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    transform: `translate(-50%, -100%) scale(${1 / zoom})`,
                    transformOrigin: "bottom center",
                  }}
                >
                  <div
                    key={`${pin.x}-${pin.y}`}
                    className="anim-pop-in flex flex-col items-center drop-shadow-lg"
                  >
                    <div className="h-7 w-7 rounded-full border-2 border-white bg-red-500" />
                    <div className="h-3 w-0.5 bg-red-500" />
                  </div>
                </div>
              )}
              {placing && (
                <div className="absolute inset-0 flex items-center justify-center ring-2 ring-yellow-400">
                  <span
                    className="rounded-lg bg-black/60 px-4 py-2 text-sm font-semibold text-yellow-300 backdrop-blur-sm"
                    style={{ transform: `scale(${1 / zoom})` }}
                  >
                    {t("game:dropPinHint")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Boutons zoom */}
      <div className="mb-2 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          disabled={zoom <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-lg font-bold text-white hover:bg-white/30 disabled:opacity-30"
        >
          −
        </button>
        <span className="flex h-8 items-center px-2 text-sm font-semibold text-white/70">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
          disabled={zoom >= 4}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-lg font-bold text-white hover:bg-white/30 disabled:opacity-30"
        >
          +
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitted}
          onClick={() => setPlacing((p) => !p)}
          className={`flex-1 rounded-xl px-4 py-3 font-bold transition-colors ${placing ? "bg-yellow-400 text-gray-900" : "bg-white/20 text-white hover:bg-white/30"}`}
        >
          📍 {pinBtnLabel}
        </button>
        <button
          type="button"
          disabled={pin === null || submitted}
          onClick={handleSubmit}
          className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 font-bold text-white hover:bg-yellow-600 disabled:opacity-40"
        >
          {submitted ? t("game:answerSent") : t("common:submit")}
        </button>
      </div>
    </div>
  )
}
