import { useEffect, useState, useMemo } from "react"

type Props = {
  duration: number // en secondes
  gridCols: number
  gridRows: number
  seedString?: string
  startTimeOffset?: number
  configuredStyle?: string
}

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

export const BackgroundRevealer = ({
  duration,
  gridCols,
  gridRows,
  seedString,
  startTimeOffset = 0,
  configuredStyle,
}: Props) => {
  const totalCells = gridCols * gridRows

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
      "iris",
      "blur",
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
      return
    }

    const initialProgress = Math.min(1, startTimeOffset / duration)
    setProgress(initialProgress)

    if (initialProgress >= 1) {
      return
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

  // 1. Style Défloutage (blur) - Masque 100% opaque au départ qui se défloute et s'efface
  if (selectedStyle === "blur") {
    const currentBlur = 40 * (1 - progress)
    const overlayOpacity = 1 - progress

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] select-none"
        style={{
          backdropFilter: `blur(${currentBlur}px)`,
          WebkitBackdropFilter: `blur(${currentBlur}px)`,
          backgroundColor: `rgba(9, 13, 22, ${overlayOpacity})`,
          transition: "backdrop-filter 50ms linear, background-color 50ms linear",
        }}
      />
    )
  }

  // 2. Style Iris / Diaphragme Optique (circle expand) - Masque 100% opaque avec ouverture circulaire
  if (selectedStyle === "iris") {
    const radiusPercent = progress * 140
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-[#090d16] select-none transition-all duration-75"
        style={{
          maskImage: `radial-gradient(circle at 50% 50%, transparent ${radiusPercent}%, black ${radiusPercent + 4}%)`,
          WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${radiusPercent}%, black ${radiusPercent + 4}%)`,
        }}
      />
    )
  }

  // 3. Styles Grille de Tuiles (grid cells)
  const revealedCount = Math.floor(progress * totalCells)
  const revealedSet = new Set(sequence.slice(0, revealedCount))

  const getTileStyle = (isRevealed: boolean) => {
    // ÉTAT NON RÉVÉLÉ : 100% OPAQUE (#0f172a) -> AUCUNE FUITE D'IMAGE !
    if (!isRevealed) {
      return {
        opacity: 1,
        transform: "scale(1) rotate(0deg) translate(0px, 0px)",
        backgroundColor: "#090d16",
        boxShadow: "0 0 1px 0.5px #090d16",
        transitionDuration: "500ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: 2,
      }
    }

    // ÉTAT RÉVÉLÉ : Animation d'effacement spécifique selon le style choisi
    switch (selectedStyle) {
      case "center-out":
        return {
          opacity: 0,
          transform: "scale(1.12) rotate(4deg)",
          backgroundColor: "#0f172a",
          boxShadow: "none",
          transitionDuration: "550ms",
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          zIndex: 1,
        }
      case "diagonal-wave":
        return {
          opacity: 0,
          transform: "translate(12px, 12px) scale(0.95)",
          backgroundColor: "#0f172a",
          boxShadow: "none",
          transitionDuration: "500ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }
      case "spiral":
        return {
          opacity: 0,
          transform: "rotate(-25deg) scale(0.7)",
          backgroundColor: "#0f172a",
          boxShadow: "none",
          transitionDuration: "600ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }
      case "venetian":
        return {
          opacity: 0,
          transform: "perspective(400px) rotateY(90deg)",
          backgroundColor: "#0f172a",
          boxShadow: "none",
          transitionDuration: "500ms",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 1,
        }
      case "curtain-horizontal":
        return {
          opacity: 0,
          transform: "scaleX(0)",
          backgroundColor: "#0f172a",
          boxShadow: "none",
          transitionDuration: "450ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }
      case "top-to-bottom":
        return {
          opacity: 0,
          transform: "translateY(16px) scale(0.92)",
          backgroundColor: "#0f172a",
          boxShadow: "none",
          transitionDuration: "450ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1,
        }
      case "left-to-right":
        return {
          opacity: 0,
          transform: "translateX(16px) scale(0.92)",
          backgroundColor: "#0f172a",
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
          backgroundColor: "#0f172a",
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
            className="relative select-none transition-all"
            style={getTileStyle(isRevealed)}
          />
        )
      })}
    </div>
  )
}

export default BackgroundRevealer
