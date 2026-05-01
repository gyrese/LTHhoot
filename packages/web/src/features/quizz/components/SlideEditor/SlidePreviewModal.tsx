import { type SlideElement } from "@rahoot/common/types/game"
import { X } from "lucide-react"
import { useEffect } from "react"
import SlideCanvas from "./SlideCanvas"

type Props = {
  elements: SlideElement[]
  onClose: () => void
}

const SlidePreviewModal = ({ elements, onClose }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
      >
        <X className="size-5" />
      </button>

      <div
        className="relative h-full w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <SlideCanvas
          elements={elements}
          onChange={() => {}}
          selectedId={undefined}
          onSelect={() => {}}
        />
      </div>
    </div>
  )
}

export default SlidePreviewModal
