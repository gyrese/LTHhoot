import { useEffect, type RefObject } from "react"

const zones = {
  top: [0.5, 0.04],
  "top-right": [0.96, 0.04],
  right: [0.96, 0.5],
  "bottom-right": [0.96, 0.96],
  bottom: [0.5, 0.96],
  "bottom-left": [0.04, 0.96],
  left: [0.04, 0.5],
  "top-left": [0.04, 0.04],
} as const

export function sampleEdgeColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  return Object.fromEntries(
    Object.entries(zones).map(([zone, [x, y]]) => {
      const centerX = Math.round(x * (width - 1))
      const centerY = Math.round(y * (height - 1))
      const rgb = [0, 0, 0]
      let weight = 0
      for (
        let py = Math.max(0, centerY - 2);
        py <= Math.min(height - 1, centerY + 2);
        py += 1
      ) {
        for (
          let px = Math.max(0, centerX - 2);
          px <= Math.min(width - 1, centerX + 2);
          px += 1
        ) {
          const index = (py * width + px) * 4
          const alpha = data[index + 3] / 255
          const channels = [data[index], data[index + 1], data[index + 2]]
          // Favor colored pixels over black/white details in the same patch.
          const saturation =
            (Math.max(...channels) - Math.min(...channels)) / 255
          const pixelWeight = alpha * (0.2 + saturation)
          channels.forEach((channel, i) => {
            rgb[i] += channel * pixelWeight
          })
          weight += pixelWeight
        }
      }
      if (!weight) {
        return [zone, "#fb923c"]
      }
      const average = rgb.map((channel) => channel / weight)
      if (Math.max(...average) < 8) {
        return [zone, "rgb(180 180 180)"]
      }
      const gain = Math.max(1, 220 / Math.max(1, ...average))
      const color = average.map((channel) =>
        Math.min(255, Math.round(channel * gain)),
      )
      return [zone, `rgb(${color.join(" ")})`]
    }),
  ) as Record<string, string>
}

/** Sample the existing image once after loading, never during pointer movement. */
export default function useImageEdgeColors(
  root: RefObject<HTMLElement | null>,
  source: string | undefined,
) {
  useEffect(() => {
    const node = root.current
    const image = node?.querySelector<HTMLImageElement>("img[data-cover]")
    if (!node) {
      return undefined
    }
    const clear = () => {
      Object.keys(zones).forEach((zone) => {
        node.style.removeProperty(`--edge-${zone}`)
      })
    }
    clear()
    if (!image || !source) {
      return undefined
    }
    const sample = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        return
      }
      try {
        const canvas = document.createElement("canvas")
        canvas.width = 36
        canvas.height = 48
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) {
          return
        }
        // Match the displayed object-cover crop and its center / 35% position.
        const scale = Math.max(
          canvas.width / image.naturalWidth,
          canvas.height / image.naturalHeight,
        )
        const width = canvas.width / scale
        const height = canvas.height / scale
        context.drawImage(
          image,
          (image.naturalWidth - width) * 0.5,
          (image.naturalHeight - height) * 0.35,
          width,
          height,
          0,
          0,
          canvas.width,
          canvas.height,
        )
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
        const colors = sampleEdgeColors(data, canvas.width, canvas.height)
        Object.entries(colors).forEach(([zone, color]) => {
          node.style.setProperty(`--edge-${zone}`, color)
        })
      } catch {
        // Remote images without canvas permission retain the orange fallback.
        clear()
      }
    }
    image.addEventListener("load", sample)
    if (image.complete) {
      sample()
    }
    return () => {
      image.removeEventListener("load", sample)
      clear()
    }
  }, [root, source])
}
