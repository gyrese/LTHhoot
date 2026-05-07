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

export type ContextMenuAction =
  | "addText"
  | "addShape"
  | "addImage"
  | "addYoutube"
  | "copy"
  | "cut"
  | "paste"
  | "delete"
  | "bringToFront"
  | "sendToBack"
  | "bringForward"
  | "sendBackward"
  | "setAsBackground"
  | "crop"
  | "opacity"

type ContextMenuProps = {
  x: number
  y: number
  hasSelection: boolean
  selectedType?: string
  canPaste: boolean
  onClose: () => void
  onAction: (action: ContextMenuAction) => void
}

const SlideContextMenu = ({
  x,
  y,
  hasSelection,
  selectedType,
  canPaste,
  onClose,
  onAction,
}: ContextMenuProps) => {
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
      className="pointer-events-auto fixed z-[100] w-48 rounded-xl border border-gray-200 bg-white/95 py-1 text-sm text-gray-700 shadow-xl backdrop-blur-md"
      style={menuStyle}
      onContextMenu={handleContextMenu}
    >
      {hasSelection ? (
        <>
          <button
            onClick={() => handleAction("copy")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <Copy className="size-4" /> Copier
          </button>
          <button
            onClick={() => handleAction("cut")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <Scissors className="size-4" /> Couper
          </button>
          <button
            onClick={() => handleAction("paste")}
            disabled={!canPaste}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${canPaste ? "hover:bg-gray-100" : "cursor-not-allowed opacity-50"}`}
          >
            <ClipboardPaste className="size-4" /> Coller
          </button>
          <div className="mx-2 my-1 h-px bg-gray-200" />
          <button
            onClick={() => handleAction("bringToFront")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <ArrowUpToLine className="size-4" /> Premier plan
          </button>
          <button
            onClick={() => handleAction("sendToBack")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <ArrowDownToLine className="size-4" /> Dernier plan
          </button>
          <div className="mx-2 my-1 h-px bg-gray-200" />
          <button
            onClick={() => handleAction("bringForward")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <ArrowUp className="size-4" /> Avancer
          </button>
          <button
            onClick={() => handleAction("sendBackward")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <ArrowDown className="size-4" /> Reculer
          </button>

          {selectedType === "image" && (
            <>
              <div className="mx-2 my-1 h-px bg-gray-200" />
              <button
                onClick={() => handleAction("setAsBackground")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
              >
                <Maximize className="size-4" /> Mettre en fond
              </button>
              <button
                onClick={() => handleAction("crop")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
              >
                <Crop className="size-4" /> Recadrer
              </button>
              <button
                onClick={() => handleAction("opacity")}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
              >
                <Sun className="size-4" /> Opacité
              </button>
            </>
          )}
          <div className="mx-2 my-1 h-px bg-gray-200" />
          <button
            onClick={() => handleAction("delete")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="size-4" /> Supprimer
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => handleAction("paste")}
            disabled={!canPaste}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${canPaste ? "hover:bg-gray-100" : "cursor-not-allowed opacity-50"}`}
          >
            <ClipboardPaste className="size-4" /> Coller
          </button>
          <div className="mx-2 my-1 h-px bg-gray-200" />
          <button
            onClick={() => handleAction("addText")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <Type className="size-4" /> Ajouter Texte
          </button>
          <button
            onClick={() => handleAction("addShape")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <Square className="size-4" /> Ajouter Forme
          </button>
          <button
            onClick={() => handleAction("addImage")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <ImageIcon className="size-4" /> Ajouter Image
          </button>
          <button
            onClick={() => handleAction("addYoutube")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-100"
          >
            <Play className="size-4" /> Ajouter YouTube
          </button>
        </>
      )}
    </div>
  )
}

export default SlideContextMenu
