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
  const [submitted, setSubmitted] = useState(false)
  const { t } = useTranslation()

  const handleImgClick = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    if (submitted) return
    e.preventDefault()

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY

    const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))

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
    <div className="mx-auto mb-4 w-full max-w-3xl px-2 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ userSelect: "none" }}>
      
      {/* 🚀 PRO MAX UX: Tap anywhere on the image container */}
      <div className="relative w-full rounded-2xl bg-black/40 border border-white/10 shadow-2xl p-2 flex items-center justify-center overflow-hidden touch-none">
        
        {!pin && !submitted && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="px-6 py-3 bg-black/60 backdrop-blur-md rounded-full text-white/90 font-bold text-sm sm:text-base border border-white/10 shadow-xl animate-pulse">
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
            className="block max-h-[50vh] max-w-full w-auto h-auto object-contain rounded-xl cursor-crosshair transition-transform duration-300"
          />

          {pin !== null && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: 'translate(-50%, -100%)', // Align pin tip exactly on coordinate
              }}
            >
              <div className="flex flex-col items-center drop-shadow-2xl animate-in zoom-in duration-300">
                <div className="w-8 h-8 rounded-full border-4 border-white bg-red-500 shadow-lg" />
                <div className="w-1 h-4 bg-red-500 shadow-md" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center mt-2">
        <button
          type="button"
          disabled={pin === null || submitted}
          onClick={handleSubmit}
          className="w-full max-w-sm rounded-2xl bg-yellow-500 px-6 py-4 text-xl font-bold text-white shadow-xl hover:bg-yellow-600 disabled:opacity-40 transition-all duration-300 transform active:scale-95"
        >
          {submitted ? t("game:answerSent") : t("common:submit")}
        </button>
      </div>
    </div>
  )
}
