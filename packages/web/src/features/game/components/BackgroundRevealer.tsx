import { useEffect, useState, useMemo, useRef } from "react"

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

  // Timer à haute fréquence unifié pour animer de manière ultra-fluide (60 FPS)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (duration <= 0) {
      setProgress(1)

      return undefined
    }

    const initialProgress = Math.min(1, startTimeOffset / duration)
    setProgress(initialProgress)

    if (initialProgress >= 1) {
      return undefined
    }

    const startTime = Date.now() - initialProgress * duration * 1000

    const timer = setInterval(() => {
      const elapsedMs = Date.now() - startTime
      const currentProgress = Math.min(1, elapsedMs / (duration * 1000))

      setProgress(currentProgress)

      if (currentProgress >= 1) {
        clearInterval(timer)
      }
    }, 16)

    return () => clearInterval(timer)
  }, [duration, startTimeOffset])

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

  // Rendu Canvas pour Dépixélisation & Neige TV (Glitch)
  useEffect(() => {
    if (selectedStyle !== "pixelate" && selectedStyle !== "glitch") {
      return undefined
    }

    const canvas = canvasRef.current

    if (!canvas) {
      return undefined
    }

    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return undefined
    }

    const { width } = canvas
    const { height } = canvas

    if (width === 0 || height === 0) {
      return undefined
    }

    if (progress >= 1) {
      ctx.clearRect(0, 0, width, height)

      return undefined
    }

    if (selectedStyle === "pixelate") {
      const img = loadedImageRef.current
      const blockSize = Math.max(1, Math.round((1 - progress) ** 2.2 * 80))

      ctx.imageSmoothingEnabled = false

      if (img && img.complete) {
        const scaledW = Math.max(1, Math.floor(width / blockSize))
        const scaledH = Math.max(1, Math.floor(height / blockSize))

        const offscreen = document.createElement("canvas")
        offscreen.width = scaledW
        offscreen.height = scaledH
        const offCtx = offscreen.getContext("2d")

        if (offCtx) {
          offCtx.imageSmoothingEnabled = false

          const { sx, sy, sw, sh } = computeCoverCrop(img, width / height)

          offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, scaledW, scaledH)

          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(offscreen, 0, 0, scaledW, scaledH, 0, 0, width, height)
        }
      } else {
        ctx.fillStyle = "#090d16"
        ctx.fillRect(0, 0, width, height)
      }
    } else if (selectedStyle === "glitch") {
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

    // Rendu ponctuel : rien à nettoyer, mais toutes les branches doivent
    // rendre la même chose (l'effet sort tôt dans plusieurs cas).
    return undefined
  }, [progress, selectedStyle])

  // Redimensionnement du Canvas
  useEffect(() => {
    if (selectedStyle !== "pixelate" && selectedStyle !== "glitch") {
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
  }, [selectedStyle])

  // ─── 1. MODE CANVASES (Pixelate & Glitch) ──────────────────────────────────
  if (selectedStyle === "pixelate" || selectedStyle === "glitch") {
    if (progress >= 1) {
      return null
    }

    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[5] h-full w-full select-none"
      />
    )
  }

  // ─── 2. MODE OPTIQUE & SPÉCIAUX (Blur, Iris, Spotlight, Thermal) ────────────
  if (selectedStyle === "blur") {
    if (progress >= 1) {
      return null
    }

    const currentBlur = 40 * (1 - progress)
    const overlayOpacity = 1 - progress

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] select-none"
        style={{
          backdropFilter: `blur(${currentBlur}px)`,
          WebkitBackdropFilter: `blur(${currentBlur}px)`,
          backgroundColor: `rgba(9, 13, 22, ${overlayOpacity})`,
          transition:
            "backdrop-filter 50ms linear, background-color 50ms linear",
        }}
      />
    )
  }

  if (selectedStyle === "iris") {
    if (progress >= 1) {
      return null
    }

    const radiusPercent = progress * 140

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-[#090d16] transition-all duration-75 select-none"
        style={{
          maskImage: `radial-gradient(circle at 50% 50%, transparent ${radiusPercent}%, black ${radiusPercent + 4}%)`,
          WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${radiusPercent}%, black ${radiusPercent + 4}%)`,
        }}
      />
    )
  }

  if (selectedStyle === "spotlight") {
    if (progress >= 1) {
      return null
    }

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

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-[#090d16] transition-all duration-75 select-none"
        style={{
          maskImage: `radial-gradient(circle ${radius}px at ${spotX}% ${spotY}%, transparent 80%, black 100%)`,
          WebkitMaskImage: `radial-gradient(circle ${radius}px at ${spotX}% ${spotY}%, transparent 80%, black 100%)`,
        }}
      />
    )
  }

  if (selectedStyle === "thermal") {
    if (progress >= 1) {
      return null
    }

    const factor = 1 - progress

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] transition-all duration-100 select-none"
        style={{
          backgroundColor: `rgba(9, 13, 22, ${factor * 0.9})`,
          backdropFilter: `hue-rotate(${factor * 200}deg) invert(${factor * 0.7}) contrast(${100 + factor * 100}%)`,
          WebkitBackdropFilter: `hue-rotate(${factor * 200}deg) invert(${factor * 0.7}) contrast(${100 + factor * 100}%)`,
        }}
      />
    )
  }

  // ─── 3. MODE ÉLÉMENTS & MATIÈRES (Burn, Ink, Printer) ──────────────────────
  if (selectedStyle === "printer") {
    if (progress >= 1) {
      return null
    }

    const topPct = progress * 100

    return (
      <div className="pointer-events-none absolute inset-0 z-[5] select-none">
        <div
          className="absolute inset-0 bg-[#090d16]"
          style={{
            clipPath: `polygon(0 ${topPct}%, 100% ${topPct}%, 100% 100%, 0 100%)`,
          }}
        />
        <div
          className="absolute right-0 left-0 h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee]"
          style={{ top: `${topPct}%` }}
        />
      </div>
    )
  }

  if (selectedStyle === "burn") {
    if (progress >= 1) {
      return null
    }

    const r = progress * 140

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-[#090d16] transition-all duration-75 select-none"
        style={{
          maskImage: `radial-gradient(circle at 50% 50%, transparent ${r}%, black ${r + 6}%)`,
          WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${r}%, black ${r + 6}%)`,
        }}
      >
        <div
          className="absolute inset-0 rounded-full border-[8px] border-amber-500/80 shadow-[0_0_30px_#f59e0b]"
          style={{
            clipPath: `circle(${r + 1}% at 50% 50%)`,
          }}
        />
      </div>
    )
  }

  if (selectedStyle === "ink") {
    if (progress >= 1) {
      return null
    }

    const r = progress * 130

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-[#090d16] transition-all duration-75 select-none"
        style={{
          maskImage: `radial-gradient(circle at 50% 50%, transparent ${r}%, transparent ${r + 2}%, black ${r + 8}%), radial-gradient(circle at 20% 30%, transparent ${r * 0.8}%, black ${r * 0.8 + 6}%), radial-gradient(circle at 80% 70%, transparent ${r * 0.8}%, black ${r * 0.8 + 6}%)`,
          WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${r}%, transparent ${r + 2}%, black ${r + 8}%), radial-gradient(circle at 20% 30%, transparent ${r * 0.8}%, black ${r * 0.8 + 6}%), radial-gradient(circle at 80% 70%, transparent ${r * 0.8}%, black ${r * 0.8 + 6}%)`,
        }}
      />
    )
  }

  // ─── 4. MODE GRILLES & GÉOMÉTRIE (HoneyComb, Puzzle, Cases Standard) ────────
  if (progress >= 1) {
    return null
  }

  const revealedCount = Math.floor(progress * totalCells)
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
