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
          score = dist + randVal * 0.4
          break
        }
        case "diagonal-wave": {
          score = cell.c + cell.r + randVal * 0.5
          break
        }
        case "left-to-right": {
          score = cell.c + randVal * 0.3
          break
        }
        case "top-to-bottom": {
          score = cell.r + randVal * 0.3
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

  // Timer à haute fréquence unifié pour animer de manière ultra-fluide (grille ou flou)
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
    }, 16) // ~60 FPS, fluidité maximale sur GPU

    return () => clearInterval(timer)
  }, [duration, startTimeOffset])

  // Pour le style de type défloutage (blur)
  if (selectedStyle === "blur") {
    const currentBlur = 40 * (1 - progress)
    const overlayOpacity = 0.4 * (1 - progress)

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[5] transition-all duration-75 select-none"
        style={{
          backdropFilter: `blur(${currentBlur}px)`,
          WebkitBackdropFilter: `blur(${currentBlur}px)`,
          backgroundColor: `rgba(15, 23, 42, ${overlayOpacity})`,
        }}
      />
    )
  }

  // Pour les styles de type grille de tuiles (grid cells)
  const revealedCount = Math.floor(progress * totalCells)
  const revealedSet = new Set(sequence.slice(0, revealedCount))

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] grid gap-0.5 overflow-hidden p-0.5 select-none"
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
            className="border border-white/5 bg-[#0f172a] transition-all ease-out"
            style={{
              opacity: isRevealed ? 0 : 1,
              transform: isRevealed ? "scale(0.9)" : "scale(1)",
              transitionDuration: "400ms",
            }}
          />
        )
      })}
    </div>
  )
}

export default BackgroundRevealer
