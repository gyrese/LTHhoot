import {
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react"
import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react"

// Keep the supplied spring with a gentler ±5° tilt.
const spring = { stiffness: 150, damping: 15 }
const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** Apply to the inner card surface; Anime.js owns its outer layout wrapper. */
export default function useCardTilt(enabled = true) {
  const reducedMotion = useReducedMotion()
  const blocked = !enabled || Boolean(reducedMotion)
  const ignoreMouseUntil = useRef(0)
  const targetX = useMotionValue(0)
  const targetY = useMotionValue(0)
  const rotateX = useSpring(targetX, spring)
  const rotateY = useSpring(targetY, spring)
  // Keep depth in front of the frame even while the rotation springs back.
  const depth = useSpring(0, { stiffness: 150, damping: 26 })
  const artDepth = useTransform(depth, (value) => `${Math.max(0, value)}px`)
  const contentDepth = useTransform(
    depth,
    (value) => `${Math.max(0, value) * 1.6 + 2}px`,
  )
  const toolsDepth = useTransform(
    depth,
    (value) => `${Math.max(0, value) * 1.8 + 3}px`,
  )
  const lightX = useMotionValue("50%")
  const lightY = useMotionValue("50%")
  const lightOpacity = useSpring(0, spring)
  const transform = useMotionTemplate`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`

  const reset = (instant: boolean) => {
    targetX.set(0)
    targetY.set(0)
    if (instant) {
      rotateX.jump(0)
      rotateY.jump(0)
      depth.jump(0)
      lightOpacity.jump(0)
    } else {
      depth.set(0)
      lightOpacity.set(0)
    }
  }

  useEffect(() => {
    if (blocked) {
      targetX.jump(0)
      targetY.jump(0)
      rotateX.jump(0)
      rotateY.jump(0)
      depth.jump(0)
      lightOpacity.jump(0)
    }
  }, [blocked, targetX, targetY, rotateX, rotateY, depth, lightOpacity])

  const follow = (
    event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>,
  ) => {
    if ("pointerType" in event && event.pointerType === "touch") {
      ignoreMouseUntil.current = performance.now() + 800
      reset(true)
      return
    }
    if (blocked || performance.now() < ignoreMouseUntil.current) {
      return
    }
    // Measure the stationary layout wrapper, not the already tilted surface.
    const bounds =
      event.currentTarget.closest<HTMLElement>("[data-library-id]") ??
      event.currentTarget
    const rect = bounds.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      return
    }
    const x = clamp((event.clientX - rect.left) / rect.width)
    const y = clamp((event.clientY - rect.top) / rect.height)
    targetX.set((0.5 - y) * 10)
    targetY.set((x - 0.5) * 10)
    depth.set(20)
    lightX.set(`${x * 100}%`)
    lightY.set(`${y * 100}%`)
    lightOpacity.set(0.95)
  }
  const leave = () => reset(false)
  const resetInstantly = () => reset(true)

  return {
    style: {
      transform,
      "--card-art-depth": artDepth,
      "--card-content-depth": contentDepth,
      "--card-tools-depth": toolsDepth,
      "--card-light-x": lightX,
      "--card-light-y": lightY,
      "--card-light-opacity": lightOpacity,
    },
    onPointerEnter: follow,
    onPointerMove: follow,
    onPointerLeave: leave,
    onMouseEnter: follow,
    onMouseMove: follow,
    onMouseLeave: leave,
    onKeyDown: resetInstantly,
    onDragStart: resetInstantly,
    // Motion reserves onDragStart for its own drag gesture; capture native drags too.
    onDragStartCapture: resetInstantly,
  }
}
