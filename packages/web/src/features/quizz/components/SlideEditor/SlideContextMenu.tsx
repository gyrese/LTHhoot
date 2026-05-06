import {
  Type,
  Square,
  Image as ImageIcon,
  Play,
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  Crop,
  Maximize,
  Sun,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useEffect, useRef } from "react"

export type ContextMenuAction = "addText" | "addShape" | "addImage" | "addYoutube" | "copy" | "cut" | "paste" | "delete" | "bringToFront" | "sendToBack" | "bringForward" | "sendBackward" | "setAsBackground" | "crop" | "opacity"

type ContextMenuProps = {
  x: number
  y: number
  hasSelection: boolean
  selectedType?: string
  canPaste: boolean
  onClose: () => void
  onAction: (action: ContextMenuAction) => void
}

const SlideContextMenu = ({ x, y, hasSelection, selectedType, canPaste, onClose, onAction }: ContextMenuProps) => {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking exactly where we opened the context menu (prevents immediate close on right click)
      if (e.button === 2) return

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onClose])

  const handleAction = (action: ContextMenuAction) => {
    onAction(action)
    onClose()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  // Ensure menu stays within window bounds (rough estimation)
  const menuStyle: React.CSSProperties = {
    top: Math.min(y, window.innerHeight - 300),
    left: Math.min(x, window.innerWidth - 200),
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-48 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-xl py-1 text-sm text-gray-700 pointer-events-auto"
      style={menuStyle}
      onContextMenu={handleContextMenu}
    >
      {hasSelection ? (
        <>
          <button onClick={() => handleAction("copy")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <Copy className="size-4" /> Copier
          </button>
          <button onClick={() => handleAction("cut")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <Scissors className="size-4" /> Couper
          </button>
          <button
            onClick={() => handleAction("paste")}
            disabled={!canPaste}
            className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left ${canPaste ? "hover:bg-gray-100" : "opacity-50 cursor-not-allowed"}`}
          >
            <ClipboardPaste className="size-4" /> Coller
          </button>
          <div className="h-px bg-gray-200 my-1 mx-2" />
          <button onClick={() => handleAction("bringToFront")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <ArrowUpToLine className="size-4" /> Premier plan
          </button>
          <button onClick={() => handleAction("sendToBack")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <ArrowDownToLine className="size-4" /> Dernier plan
          </button>
          <div className="h-px bg-gray-200 my-1 mx-2" />
          <button onClick={() => handleAction("bringForward")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <ArrowUp className="size-4" /> Avancer
          </button>
          <button onClick={() => handleAction("sendBackward")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <ArrowDown className="size-4" /> Reculer
          </button>
          
          {selectedType === "image" && (
            <>
              <div className="h-px bg-gray-200 my-1 mx-2" />
              <button onClick={() => handleAction("setAsBackground")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
                <Maximize className="size-4" /> Mettre en fond
              </button>
              <button onClick={() => handleAction("crop")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
                <Crop className="size-4" /> Recadrer
              </button>
              <button onClick={() => handleAction("opacity")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
                <Sun className="size-4" /> Opacité
              </button>
            </>
          )}
          <div className="h-px bg-gray-200 my-1 mx-2" />
          <button onClick={() => handleAction("delete")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 transition-colors text-left">
            <Trash2 className="size-4" /> Supprimer
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => handleAction("paste")}
            disabled={!canPaste}
            className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left ${canPaste ? "hover:bg-gray-100" : "opacity-50 cursor-not-allowed"}`}
          >
            <ClipboardPaste className="size-4" /> Coller
          </button>
          <div className="h-px bg-gray-200 my-1 mx-2" />
          <button onClick={() => handleAction("addText")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <Type className="size-4" /> Ajouter Texte
          </button>
          <button onClick={() => handleAction("addShape")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <Square className="size-4" /> Ajouter Forme
          </button>
          <button onClick={() => handleAction("addImage")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <ImageIcon className="size-4" /> Ajouter Image
          </button>
          <button onClick={() => handleAction("addYoutube")} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left">
            <Play className="size-4" /> Ajouter YouTube
          </button>
        </>
      )}
    </div>
  )
}

export default SlideContextMenu
