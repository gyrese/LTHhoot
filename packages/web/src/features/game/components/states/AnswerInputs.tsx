import {
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react"

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

const MIN_SCALE = 1
const MAX_SCALE = 6
// Mouvement max (px) en deçà duquel on considère un tap plutôt qu'un drag
const TAP_THRESHOLD = 8

const clampNum = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const pointerDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

type PinTransform = { scale: number; tx: number; ty: number }

export const DropPinAnswer = ({
  pinImage,
  onTextAnswer,
}: {
  pinImage: string
  onTextAnswer: (_text: string) => void
}) => {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [transform, setTransform] = useState<PinTransform>({
    scale: 1,
    tx: 0,
    ty: 0,
  })
  const { t } = useTranslation()

  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const gestureRef = useRef({
    isPinch: false,
    startDist: 0,
    startScale: 1,
    startTx: 0,
    startTy: 0,
    focalX: 0,
    focalY: 0,
    startMidX: 0,
    startMidY: 0,
    lastX: 0,
    lastY: 0,
    moved: 0,
  })

  // Borne le déplacement pour que l'image reste dans le cadre (origine = centre)
  const clampTransform = useCallback((next: PinTransform): PinTransform => {
    const vp = viewportRef.current
    const img = imgRef.current

    if (!vp || !img) {
      return next
    }

    const maxX = Math.max(0, (img.clientWidth * next.scale - vp.clientWidth) / 2)
    const maxY = Math.max(
      0,
      (img.clientHeight * next.scale - vp.clientHeight) / 2,
    )

    return {
      scale: next.scale,
      tx: clampNum(next.tx, -maxX, maxX),
      ty: clampNum(next.ty, -maxY, maxY),
    }
  }, [])

  // Zoom à la molette (listener natif non-passif pour pouvoir bloquer le scroll)
  useEffect(() => {
    const vp = viewportRef.current

    if (!vp) {
      return undefined
    }

    const onWheelNative = (e: globalThis.WheelEvent) => {
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      const focalX = e.clientX - (rect.left + rect.width / 2)
      const focalY = e.clientY - (rect.top + rect.height / 2)

      setTransform((tr) => {
        const newScale = clampNum(
          tr.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15),
          MIN_SCALE,
          MAX_SCALE,
        )
        const ratio = newScale / tr.scale

        return clampTransform({
          scale: newScale,
          tx: focalX - (focalX - tr.tx) * ratio,
          ty: focalY - (focalY - tr.ty) * ratio,
        })
      })
    }

    vp.addEventListener("wheel", onWheelNative, { passive: false })

    return () => vp.removeEventListener("wheel", onWheelNative)
  }, [clampTransform])

  // Pose l'épingle à partir de coordonnées écran → pourcentage de l'image native
  const placePin = (clientX: number, clientY: number) => {
    if (submitted) {
      return
    }

    const img = imgRef.current

    if (!img) {
      return
    }

    // La position écran (getBoundingClientRect) reflète déjà le scale/translate
    // appliqué, donc le pourcentage reste relatif à l'image d'origine.
    const rect = img.getBoundingClientRect()
    const xPct = clampNum(((clientX - rect.left) / rect.width) * 100, 0, 100)
    const yPct = clampNum(((clientY - rect.top) / rect.height) * 100, 0, 100)

    if (!isNaN(xPct) && !isNaN(yPct)) {
      setPin({ x: xPct, y: yPct })
    }
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    viewportRef.current?.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const g = gestureRef.current

    if (pointersRef.current.size === 1) {
      g.isPinch = false
      g.lastX = e.clientX
      g.lastY = e.clientY
      g.moved = 0
      g.startScale = transform.scale
      g.startTx = transform.tx
      g.startTy = transform.ty
    } else if (pointersRef.current.size === 2) {
      g.isPinch = true
      const [p1, p2] = [...pointersRef.current.values()]
      g.startDist = pointerDist(p1, p2)
      g.startMidX = (p1.x + p2.x) / 2
      g.startMidY = (p1.y + p2.y) / 2
      g.startScale = transform.scale
      g.startTx = transform.tx
      g.startTy = transform.ty

      const vp = viewportRef.current

      if (vp) {
        const rect = vp.getBoundingClientRect()
        g.focalX = g.startMidX - (rect.left + rect.width / 2)
        g.focalY = g.startMidY - (rect.top + rect.height / 2)
      }
    }
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current

    if (!pointers.has(e.pointerId)) {
      return
    }

    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gestureRef.current

    if (pointers.size >= 2 && g.isPinch) {
      const [p1, p2] = [...pointers.values()]
      const curDist = pointerDist(p1, p2)
      const curMidX = (p1.x + p2.x) / 2
      const curMidY = (p1.y + p2.y) / 2
      const factor = g.startDist > 0 ? curDist / g.startDist : 1
      const newScale = clampNum(g.startScale * factor, MIN_SCALE, MAX_SCALE)
      const ratio = newScale / g.startScale

      // On garde le point sous les doigts immobile, puis on suit le pan à 2 doigts
      const tx = g.focalX - (g.focalX - g.startTx) * ratio + (curMidX - g.startMidX)
      const ty = g.focalY - (g.focalY - g.startTy) * ratio + (curMidY - g.startMidY)

      setTransform(clampTransform({ scale: newScale, tx, ty }))
    } else if (pointers.size === 1 && !g.isPinch) {
      const dx = e.clientX - g.lastX
      const dy = e.clientY - g.lastY
      g.lastX = e.clientX
      g.lastY = e.clientY
      g.moved += Math.hypot(dx, dy)

      // Pan uniquement quand on est zoomé, sinon le tap reste prioritaire
      if (g.startScale > 1) {
        setTransform((tr) => clampTransform({ ...tr, tx: tr.tx + dx, ty: tr.ty + dy }))
      }
    }
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current
    const g = gestureRef.current
    viewportRef.current?.releasePointerCapture(e.pointerId)

    const wasTap =
      pointers.size === 1 && !g.isPinch && g.moved < TAP_THRESHOLD

    pointers.delete(e.pointerId)

    if (wasTap) {
      placePin(e.clientX, e.clientY)
    }

    if (pointers.size === 0) {
      g.isPinch = false
    } else if (pointers.size === 1) {
      // Fin du pinch mais un doigt reste : on rebase sans placer d'épingle
      const [p] = [...pointers.values()]
      g.lastX = p.x
      g.lastY = p.y
      g.moved = TAP_THRESHOLD + 1
      g.isPinch = true
      g.startScale = transform.scale
      g.startTx = transform.tx
      g.startTy = transform.ty
    }
  }

  const zoomByButton = (direction: 1 | -1) => {
    setTransform((tr) => {
      const newScale = clampNum(
        tr.scale * (direction > 0 ? 1.4 : 1 / 1.4),
        MIN_SCALE,
        MAX_SCALE,
      )
      const ratio = newScale / tr.scale

      // Zoom centré sur le cadre
      return clampTransform({
        scale: newScale,
        tx: tr.tx * ratio,
        ty: tr.ty * ratio,
      })
    })
  }

  const resetZoom = () => setTransform({ scale: 1, tx: 0, ty: 0 })

  const handleSubmit = () => {
    if (pin !== null && !submitted) {
      setSubmitted(true)
      onTextAnswer(`${pin.x.toFixed(2)}:${pin.y.toFixed(2)}`)
    }
  }

  const isZoomed = transform.scale > 1

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 mx-auto mb-4 flex w-full max-w-3xl flex-col gap-4 px-2 duration-500"
      style={{ userSelect: "none" }}
    >
      <div
        ref={viewportRef}
        className="relative flex w-full touch-none items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2 shadow-2xl"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {!pin && !submitted && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="animate-pulse rounded-full border border-white/10 bg-black/60 px-6 py-3 text-sm font-bold text-white/90 shadow-xl backdrop-blur-md sm:text-base">
              Touchez l'image pour placer l'épingle
            </div>
          </div>
        )}

        {/* Contrôles de zoom */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => zoomByButton(1)}
            disabled={transform.scale >= MAX_SCALE}
            aria-label="Zoomer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur-md transition-all hover:bg-black/80 active:scale-95 disabled:opacity-30"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => zoomByButton(-1)}
            disabled={transform.scale <= MIN_SCALE}
            aria-label="Dézoomer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur-md transition-all hover:bg-black/80 active:scale-95 disabled:opacity-30"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          {isZoomed && (
            <button
              type="button"
              onClick={resetZoom}
              aria-label="Réinitialiser le zoom"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur-md transition-all hover:bg-black/80 active:scale-95"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
          )}
        </div>

        <div
          className="relative inline-block max-w-full"
          style={{
            transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
            transformOrigin: "center center",
            cursor: isZoomed ? "grab" : "crosshair",
          }}
        >
          <img
            ref={imgRef}
            src={pinImage}
            alt="Target"
            draggable={false}
            className="block h-auto max-h-[50vh] w-auto max-w-full rounded-xl object-contain"
          />

          {pin !== null && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                // Align pin tip exactly on coordinate, contre-scale pour garder une taille constante
                transform: `translate(-50%, -100%) scale(${1 / transform.scale})`,
                transformOrigin: "bottom center",
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
