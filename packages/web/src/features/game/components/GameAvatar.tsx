import {
  getPetdexAvatar,
  loadSpritesheet,
} from "@rahoot/web/features/game/utils/avatars"
import clsx from "clsx"
import { useEffect, useMemo, useRef, type CSSProperties } from "react"

type Props = {
  seed: string
  className?: string
  animated?: boolean
  idleBounce?: boolean
  animationStates?: readonly PetdexStateId[]
  style?: CSSProperties
}

const PETDEX_GRID = { cols: 8, rows: 9 }
const PETDEX_STATES = {
  idle: { row: 0, frames: 6 },
  "running-right": { row: 1, frames: 8 },
  "running-left": { row: 2, frames: 8 },
  waving: { row: 3, frames: 4 },
  jumping: { row: 4, frames: 5 },
  failed: { row: 5, frames: 8 },
  waiting: { row: 6, frames: 6 },
  running: { row: 7, frames: 6 },
  review: { row: 8, frames: 6 },
} as const

type PetdexStateId = keyof typeof PETDEX_STATES

const PETDEX_IDLE_STATE: PetdexStateId = "idle"
const PETDEX_FPS = 6

const GameAvatar = ({
  seed,
  className,
  animated,
  idleBounce = true,
  animationStates,
  style,
}: Props) => {
  const pet = getPetdexAvatar(seed)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dpr = useMemo(
    () => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    [],
  )
  const frameSequence = useMemo(() => {
    const states = animationStates?.length
      ? animationStates
      : [PETDEX_IDLE_STATE]

    return states.map((stateId) => PETDEX_STATES[stateId]).filter(Boolean)
  }, [animationStates])
  const sourceUrl = pet.spritesheetUrl

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return undefined
    }

    let raf = 0
    let stopped = false

    const draw = (img: HTMLImageElement) => {
      if (stopped) {
        return
      }

      const frameW = Math.floor(img.width / PETDEX_GRID.cols)
      const frameH = Math.floor(img.height / PETDEX_GRID.rows)

      // Render at native frame resolution, then scale via CSS.
      canvas.width = Math.max(1, Math.floor(frameW * dpr))
      canvas.height = Math.max(1, Math.floor(frameH * dpr))

      const ctx = canvas.getContext("2d")

      if (!ctx) {
        return
      }

      ctx.imageSmoothingEnabled = false
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const drawFrame = (row: number, frameX: number) => {
        ctx.clearRect(0, 0, frameW, frameH)
        ctx.drawImage(
          img,
          frameX * frameW,
          row * frameH,
          frameW,
          frameH,
          0,
          0,
          frameW,
          frameH,
        )
      }

      if (!animated) {
        drawFrame(PETDEX_STATES.idle.row, 0)

        return
      }

      const frameMs = 1000 / PETDEX_FPS
      const start = performance.now()
      const totalFrames = frameSequence.reduce(
        (sum, state) => sum + state.frames,
        0,
      )

      const tick = (now: number) => {
        if (stopped) {
          return
        }

        const loopFrame = Math.floor((now - start) / frameMs) % totalFrames

        let currentFrame = loopFrame
        let activeRow: number = PETDEX_STATES.idle.row
        let activeFrame = 0

        for (const state of frameSequence) {
          if (currentFrame < state.frames) {
            activeRow = state.row
            activeFrame = currentFrame

            break
          }

          currentFrame -= state.frames
        }

        drawFrame(activeRow, activeFrame)
        raf = requestAnimationFrame(tick)
      }

      raf = requestAnimationFrame(tick)
    }

    loadSpritesheet(sourceUrl).then(draw, () => {
      // Échec réseau persistant : canvas vide, nouvel essai au prochain rendu.
    })

    return () => {
      stopped = true

      if (raf) {
        cancelAnimationFrame(raf)
      }
    }
  }, [animated, dpr, frameSequence, sourceUrl])

  return (
    <span
      role="img"
      aria-label={pet.label}
      className={clsx(
        "shrink-0 overflow-hidden",
        animated && idleBounce && "anim-avatar-idle",
        className,
      )}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
    </span>
  )
}

export default GameAvatar
