import clsx from "clsx"
import { type CSSProperties, useEffect, useState, useMemo, useRef } from "react"

type Props = {
  duration: number // En secondes
  gridCols: number
  gridRows: number
  seedString?: string
  startTimeOffset?: number
  configuredStyle?: string
  imageUrl?: string
}

// Découpe « cover » d'une image dans un canvas : la portion centrale à garder
// pour remplir le cadre sans déformer. Extrait de l'effet de dépixélisation,
// qui atteignait sinon quatre niveaux d'imbrication.
function computeCoverCrop(
  img: HTMLImageElement,
  canvasRatio: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const imgRatio = img.width / img.height

  if (imgRatio > canvasRatio) {
    const sw = img.height * canvasRatio

    return { sx: (img.width - sw) / 2, sy: 0, sw, sh: img.height }
  }

  const sh = img.width / canvasRatio

  return { sx: 0, sy: (img.height - sh) / 2, sw: img.width, sh }
}

// Générateur pseudo-aléatoire déterministe (FNV-1a puis congruence linéaire) :
// hôte et joueurs dérivent la même séquence de la même graine, donc la même
// animation. Les opérateurs binaires et l'incrément sont inhérents à ces deux
// algorithmes — les réécrire les rendrait faux ou illisibles.
/* eslint-disable no-bitwise, no-plusplus */
function createPRNG(seedString: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 16777619)
  }
  let state = h >>> 0

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0

    return state / 4294967296
  }
}
/* eslint-enable no-bitwise, no-plusplus */

// Styles continus : pour chaque mode, le style de la couche principale (et
// d'une éventuelle sous-couche) en fonction de la progression 0 → 1.
type LayerStyles = {
  main: (_progress: number) => CSSProperties
  sub?: (_progress: number) => CSSProperties
}

const radialMask = (mask: string): CSSProperties => ({
  maskImage: mask,
  WebkitMaskImage: mask,
})

const CONTINUOUS_LAYERS: Record<string, LayerStyles> = {
  blur: {
    main: (progress) => ({
      backdropFilter: `blur(${40 * (1 - progress)}px)`,
      WebkitBackdropFilter: `blur(${40 * (1 - progress)}px)`,
      backgroundColor: `rgba(9, 13, 22, ${1 - progress})`,
    }),
  },
  iris: {
    main: (progress) => {
      const radiusPercent = progress * 140

      return radialMask(
        `radial-gradient(circle at 50% 50%, transparent ${radiusPercent}%, black ${radiusPercent + 4}%)`,
      )
    },
  },
  spotlight: {
    main: (progress) => {
      const time = progress * 10
      let spotX = 50 + Math.sin(time * 3) * 35
      let spotY = 50 + Math.cos(time * 2) * 25
      let radius = 120

      if (progress > 0.6) {
        const expandProgress = (progress - 0.6) / 0.4
        spotX = spotX * (1 - expandProgress) + 50 * expandProgress
        spotY = spotY * (1 - expandProgress) + 50 * expandProgress
        radius = 120 + expandProgress * 1500
      }

      return radialMask(
        `radial-gradient(circle ${radius}px at ${spotX}% ${spotY}%, transparent 80%, black 100%)`,
      )
    },
  },
  thermal: {
    main: (progress) => {
      const factor = 1 - progress
      const filter = `hue-rotate(${factor * 200}deg) invert(${factor * 0.7}) contrast(${100 + factor * 100}%)`

      return {
        backgroundColor: `rgba(9, 13, 22, ${factor * 0.9})`,
        backdropFilter: filter,
        WebkitBackdropFilter: filter,
      }
    },
  },
  printer: {
    main: (progress) => {
      const topPct = progress * 100

      return {
        clipPath: `polygon(0 ${topPct}%, 100% ${topPct}%, 100% 100%, 0 100%)`,
      }
    },
    sub: (progress) => ({ top: `${progress * 100}%` }),
  },
  burn: {
    main: (progress) => {
      const r = progress * 140

      return radialMask(
        `radial-gradient(circle at 50% 50%, transparent ${r}%, black ${r + 6}%)`,
      )
    },
    sub: (progress) => ({
      clipPath: `circle(${progress * 140 + 1}% at 50% 50%)`,
    }),
  },
  ink: {
    main: (progress) => {
      const r = progress * 130

      return radialMask(
        `radial-gradient(circle at 50% 50%, transparent ${r}%, transparent ${r + 2}%, black ${r + 8}%), radial-gradient(circle at 20% 30%, transparent ${r * 0.8}%, black ${r * 0.8 + 6}%), radial-gradient(circle at 80% 70%, transparent ${r * 0.8}%, black ${r * 0.8 + 6}%)`,
      )
    },
  },
}

// Modes dont la couche principale est le voile sombre lui-même.
const LAYER_BACKGROUND_STYLES = new Set(["iris", "spotlight", "burn", "ink"])

// Application impérative d'un style React (camelCase) sur un nœud du DOM,
// préfixes vendeurs compris (WebkitMaskImage → -webkit-mask-image).
const applyStyle = (el: HTMLElement | null, style?: CSSProperties) => {
  if (!el || !style) {
    return
  }

  for (const [key, value] of Object.entries(style)) {
    const property = key.replace(/[A-Z]/gu, (m) => `-${m.toLowerCase()}`)
    el.style.setProperty(property, String(value))
  }
}

// Une frame des modes canvas : dépixélisation de l'image ou neige TV.
const drawCanvasFrame = ({
  canvas,
  offscreen,
  style,
  progress,
  img,
}: {
  canvas: HTMLCanvasElement
  offscreen: HTMLCanvasElement
  style: string | undefined
  progress: number
  img: HTMLImageElement | null
}) => {
  const ctx = canvas.getContext("2d")
  const { width, height } = canvas

  if (!ctx || width === 0 || height === 0) {
    return
  }

  if (progress >= 1) {
    ctx.clearRect(0, 0, width, height)

    return
  }

  if (style === "pixelate") {
    const blockSize = Math.max(1, Math.round((1 - progress) ** 2.2 * 80))

    ctx.imageSmoothingEnabled = false

    if (!img || !img.complete) {
      ctx.fillStyle = "#090d16"
      ctx.fillRect(0, 0, width, height)

      return
    }

    const scaledW = Math.max(1, Math.floor(width / blockSize))
    const scaledH = Math.max(1, Math.floor(height / blockSize))

    offscreen.width = scaledW
    offscreen.height = scaledH
    const offCtx = offscreen.getContext("2d")

    if (!offCtx) {
      return
    }

    offCtx.imageSmoothingEnabled = false

    const { sx, sy, sw, sh } = computeCoverCrop(img, width / height)

    offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, scaledW, scaledH)

    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(offscreen, 0, 0, scaledW, scaledH, 0, 0, width, height)

    return
  }

  // Neige TV / Static Noise
  ctx.clearRect(0, 0, width, height)
  const opacity = 1 - progress
  const imageData = ctx.createImageData(width, height)
  const { data } = imageData

  for (let i = 0; i < data.length; i += 4) {
    const val = Math.floor(Math.random() * 255)
    data[i] = val // R
    data[i + 1] = val // G
    data[i + 2] = val // B
    data[i + 3] = Math.floor(opacity * 255 * (Math.random() * 0.8 + 0.2)) // A
  }
  ctx.putImageData(imageData, 0, 0)

  // Draw Scanlines
  ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.3})`
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1.5)
  }
}

export const BackgroundRevealer = ({
  duration,
  gridCols,
  gridRows,
  seedString,
  startTimeOffset = 0,
  configuredStyle,
  imageUrl,
}: Props) => {
  const totalCells = gridCols * gridRows
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const loadedImageRef = useRef<HTMLImageElement | null>(null)

  // Génère un ordre de révélation et sélectionne le style
  const { sequence, selectedStyle } = useMemo(() => {
    const cells = Array.from({ length: totalCells }, (_, i) => {
      const c = i % gridCols
      const r = Math.floor(i / gridCols)

      return { index: i, c, r }
    })

    const rand = seedString ? createPRNG(seedString) : Math.random

    const styles = [
      "random-grid",
      "center-out",
      "diagonal-wave",
      "left-to-right",
      "top-to-bottom",
      "spiral",
      "venetian",
      "curtain-horizontal",
      "pixelate",
      "glitch",
      "printer",
      "blur",
      "iris",
      "spotlight",
      "thermal",
      "honeycomb",
      "puzzle",
      "burn",
      "ink",
    ]

    let selectedStyle = configuredStyle

    if (!selectedStyle || selectedStyle === "random") {
      const styleIndex = Math.floor(rand() * styles.length)
      selectedStyle = styles[styleIndex]
    }

    const cx = (gridCols - 1) / 2
    const cy = (gridRows - 1) / 2

    const cellsWithScore = cells.map((cell) => {
      let score = 0
      const randVal = rand()

      switch (selectedStyle) {
        case "center-out": {
          const dist = Math.sqrt((cell.c - cx) ** 2 + (cell.r - cy) ** 2)
          score = dist + randVal * 0.3

          break
        }

        case "diagonal-wave": {
          score = cell.c + cell.r + randVal * 0.4

          break
        }

        case "left-to-right": {
          score = cell.c + randVal * 0.2

          break
        }

        case "top-to-bottom": {
          score = cell.r + randVal * 0.2

          break
        }

        case "curtain-horizontal": {
          const distFromCenterCol = Math.abs(cell.c - cx)
          score = distFromCenterCol + randVal * 0.2

          break
        }

        case "venetian": {
          score = cell.c * 2 + randVal * 0.8

          break
        }

        case "spiral": {
          const dist = Math.sqrt((cell.c - cx) ** 2 + (cell.r - cy) ** 2)
          const angle = Math.atan2(cell.r - cy, cell.c - cx)
          score = dist * 3 + angle + randVal * 0.2

          break
        }

        case "puzzle":
        case "honeycomb":
        case "random-grid":
        default: {
          score = randVal

          break
        }
      }

      return { index: cell.index, score }
    })

    cellsWithScore.sort((a, b) => a.score - b.score)
    const seq = cellsWithScore.map((c) => c.index)

    return { sequence: seq, selectedStyle }
  }, [totalCells, gridCols, gridRows, seedString, configuredStyle])

  const isCanvasStyle =
    selectedStyle === "pixelate" || selectedStyle === "glitch"
  const layerStyles = selectedStyle ? CONTINUOUS_LAYERS[selectedStyle] : null
  const isGridStyle = !isCanvasStyle && !layerStyles

  // Progression initiale (reprise après reconnexion via startTimeOffset).
  const initialProgress =
    duration > 0 ? Math.min(1, startTimeOffset / duration) : 1

  // Seuls deux états React subsistent, mis à jour rarement : la fin de
  // l'animation et, pour les grilles, le nombre de cases révélées (≤ une
  // mise à jour par case). Tout le reste est peint à chaque frame via
  // requestAnimationFrame directement sur le DOM / le canvas — l'ancien
  // `setProgress` toutes les 16 ms re-rendait ce composant à 60 Hz sur
  // l'hôte ET sur chaque téléphone.
  const [done, setDone] = useState(initialProgress >= 1)
  const [revealedCount, setRevealedCount] = useState(() =>
    Math.floor(initialProgress * totalCells),
  )
  const mainLayerRef = useRef<HTMLDivElement | null>(null)
  const subLayerRef = useRef<HTMLDivElement | null>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (initialProgress >= 1) {
      setDone(true)

      return undefined
    }

    setDone(false)

    const startTime = performance.now() - initialProgress * duration * 1000
    let frame = 0
    let lastCount = -1

    const paint = (now: number) => {
      const progress = Math.min(1, (now - startTime) / (duration * 1000))

      if (layerStyles) {
        applyStyle(mainLayerRef.current, layerStyles.main(progress))
        applyStyle(subLayerRef.current, layerStyles.sub?.(progress))
      } else if (isCanvasStyle && canvasRef.current) {
        offscreenRef.current ||= document.createElement("canvas")
        drawCanvasFrame({
          canvas: canvasRef.current,
          offscreen: offscreenRef.current,
          style: selectedStyle,
          progress,
          img: loadedImageRef.current,
        })
      } else if (isGridStyle) {
        const count = Math.floor(progress * totalCells)

        if (count !== lastCount) {
          lastCount = count
          setRevealedCount(count)
        }
      }

      if (progress >= 1) {
        setDone(true)

        return
      }

      frame = requestAnimationFrame(paint)
    }

    frame = requestAnimationFrame(paint)

    return () => cancelAnimationFrame(frame)
  }, [
    duration,
    initialProgress,
    selectedStyle,
    layerStyles,
    isCanvasStyle,
    isGridStyle,
    totalCells,
  ])

  // Préchargement de l'image pour le mode dépixélisation canvas
  useEffect(() => {
    if (selectedStyle !== "pixelate" || !imageUrl) {
      return undefined
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageUrl
    img.onload = () => {
      loadedImageRef.current = img
    }

    return () => {
      // L'image peut arriver après le démontage : sans ça, `onload` réécrirait
      // la ref d'un composant disparu.
      img.onload = null
    }
  }, [selectedStyle, imageUrl])

  // Redimensionnement du Canvas
  useEffect(() => {
    if (!isCanvasStyle) {
      return undefined
    }

    const canvas = canvasRef.current

    if (!canvas) {
      return undefined
    }

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect()

      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width
        canvas.height = rect.height
      }
    }

    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(canvas)

    return () => ro.disconnect()
  }, [isCanvasStyle])

  if (done) {
    return null
  }

  // ─── 1. MODE CANVASES (Pixelate & Glitch) ──────────────────────────────────
  if (isCanvasStyle) {
    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[5] h-full w-full select-none"
      />
    )
  }

  // ─── 2 & 3. MODES CONTINUS (Blur, Iris, Spotlight, Thermal, Printer, Burn,
  // Ink) : style initial rendu ici, puis mis à jour par la boucle rAF.
  if (layerStyles) {
    const mainStyle = layerStyles.main(initialProgress)

    if (selectedStyle === "printer") {
      return (
        <div className="pointer-events-none absolute inset-0 z-[5] select-none">
          <div
            ref={mainLayerRef}
            className="absolute inset-0 bg-[#090d16]"
            style={mainStyle}
          />
          <div
            ref={subLayerRef}
            className="absolute right-0 left-0 h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee]"
            style={layerStyles.sub?.(initialProgress)}
          />
        </div>
      )
    }

    return (
      <div
        ref={mainLayerRef}
        className={clsx(
          "pointer-events-none absolute inset-0 z-[5] select-none",
          LAYER_BACKGROUND_STYLES.has(selectedStyle ?? "") && "bg-[#090d16]",
        )}
        style={mainStyle}
      >
        {selectedStyle === "burn" && (
          <div
            ref={subLayerRef}
            className="absolute inset-0 rounded-full border-[8px] border-amber-500/80 shadow-[0_0_30px_#f59e0b]"
            style={layerStyles.sub?.(initialProgress)}
          />
        )}
      </div>
    )
  }

  // ─── 4. MODE GRILLES & GÉOMÉTRIE (HoneyComb, Puzzle, Cases Standard) ────────
  const revealedSet = new Set(sequence.slice(0, revealedCount))

  const getTileStyle = (isRevealed: boolean) => {
    if (!isRevealed) {
      return {
        opacity: 1,
        transform: "scale(1) rotate(0deg) translate(0px, 0px)",
        backgroundColor: "#090d16",
        boxShadow: "0 0 1px 0.5px #090d16",
        clipPath:
          selectedStyle === "honeycomb"
            ? "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)"
            : undefined,
        transitionDuration: "500ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: 2,
      }
    }

    switch (selectedStyle) {
      case "honeycomb":
        return {
          opacity: 0,
          transform: "scale(0) rotate(90deg)",
          backgroundColor: "#090d16",
          clipPath:
            "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
          transitionDuration: "600ms",
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          zIndex: 1,
        }

      case "puzzle":
        return {
          opacity: 0,
          transform: "scale(0.8) rotate(-10deg)",
          backgroundColor: "#090d16",
          transitionDuration: "500ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }

      case "center-out":
        return {
          opacity: 0,
          transform: "scale(1.12) rotate(4deg)",
          backgroundColor: "#090d16",
          boxShadow: "none",
          transitionDuration: "550ms",
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          zIndex: 1,
        }

      case "diagonal-wave":
        return {
          opacity: 0,
          transform: "translate(12px, 12px) scale(0.95)",
          backgroundColor: "#090d16",
          boxShadow: "none",
          transitionDuration: "500ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }

      case "spiral":
        return {
          opacity: 0,
          transform: "rotate(-25deg) scale(0.7)",
          backgroundColor: "#090d16",
          boxShadow: "none",
          transitionDuration: "600ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }

      case "venetian":
        return {
          opacity: 0,
          transform: "perspective(400px) rotateY(90deg)",
          backgroundColor: "#090d16",
          boxShadow: "none",
          transitionDuration: "500ms",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 1,
        }

      case "curtain-horizontal":
        return {
          opacity: 0,
          transform: "scaleX(0)",
          backgroundColor: "#090d16",
          boxShadow: "none",
          transitionDuration: "450ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }

      case "top-to-bottom":
        return {
          opacity: 0,
          transform: "translateY(16px) scale(0.92)",
          backgroundColor: "#090d16",
          boxShadow: "none",
          transitionDuration: "450ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }

      case "left-to-right":
        return {
          opacity: 0,
          transform: "translateX(16px) scale(0.92)",
          backgroundColor: "#090d16",
          boxShadow: "none",
          transitionDuration: "450ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }

      case "random-grid":
      default:
        return {
          opacity: 0,
          transform: "scale(1.08)",
          backgroundColor: "#090d16",
          boxShadow: "none",
          transitionDuration: "500ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }
    }
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] grid gap-0 overflow-hidden p-0 select-none"
      style={{
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
      }}
    >
      {Array.from({ length: totalCells }).map((_, index) => {
        const isRevealed = revealedSet.has(index)

        return (
          <div
            key={index}
            className="relative transition-all select-none"
            style={getTileStyle(isRevealed)}
          />
        )
      })}
    </div>
  )
}

export default BackgroundRevealer
