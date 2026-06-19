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
  Maximize,
  Sun,
} from "lucide-react"
import React, { type CSSProperties, useEffect, useRef } from "react"

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
  | "opacity"

type ContextMenuProps = {
  x: number
  y: number
  hasSelection: boolean
  selectedType?: string
  canPaste: boolean
  onClose: () => void
  onAction: (_action: ContextMenuAction) => void
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
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking exactly where we opened the context menu (prevents immediate close on right click)
      if (e.button === 2) {
        return
      }

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
  const menuStyle: CSSProperties = {
    top: Math.min(y, window.innerHeight - 300),
    left: Math.min(x, window.innerWidth - 200),
  }

  return (
    <div
      ref={menuRef}
      className="border-border bg-elevated/95 text-ink pointer-events-auto fixed z-[100] w-48 rounded-xl border p-1 text-sm shadow-xl shadow-black/15 backdrop-blur-md"
      style={menuStyle}
      onContextMenu={handleContextMenu}
    >
      {hasSelection ? (
        <>
          <button
            onClick={() => handleAction("copy")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <Copy className="size-4" /> Copier
          </button>
          <button
            onClick={() => handleAction("cut")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <Scissors className="size-4" /> Couper
          </button>
          <button
            onClick={() => handleAction("paste")}
            disabled={!canPaste}
            className={`focus-ring flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors ${canPaste ? "hover:bg-panel" : "cursor-not-allowed opacity-50"}`}
          >
            <ClipboardPaste className="size-4" /> Coller
          </button>
          <div className="bg-border mx-2 my-1 h-px" />
          <button
            onClick={() => handleAction("bringToFront")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <ArrowUpToLine className="size-4" /> Premier plan
          </button>
          <button
            onClick={() => handleAction("sendToBack")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <ArrowDownToLine className="size-4" /> Dernier plan
          </button>
          <div className="bg-border mx-2 my-1 h-px" />
          <button
            onClick={() => handleAction("bringForward")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <ArrowUp className="size-4" /> Avancer
          </button>
          <button
            onClick={() => handleAction("sendBackward")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <ArrowDown className="size-4" /> Reculer
          </button>

          {selectedType === "image" && (
            <>
              <div className="bg-border mx-2 my-1 h-px" />
              <button
                onClick={() => handleAction("setAsBackground")}
                className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
              >
                <Maximize className="size-4" /> Mettre en fond
              </button>
              <button
                onClick={() => handleAction("opacity")}
                className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
              >
                <Sun className="size-4" /> Opacité
              </button>
            </>
          )}
          <div className="bg-border mx-2 my-1 h-px" />
          <button
            onClick={() => handleAction("delete")}
            className="focus-ring text-danger hover:bg-danger-soft flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <Trash2 className="size-4" /> Supprimer
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => handleAction("paste")}
            disabled={!canPaste}
            className={`focus-ring flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors ${canPaste ? "hover:bg-panel" : "cursor-not-allowed opacity-50"}`}
          >
            <ClipboardPaste className="size-4" /> Coller
          </button>
          <div className="bg-border mx-2 my-1 h-px" />
          <button
            onClick={() => handleAction("addText")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <Type className="size-4" /> Ajouter Texte
          </button>
          <button
            onClick={() => handleAction("addShape")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <Square className="size-4" /> Ajouter Forme
          </button>
          <button
            onClick={() => handleAction("addImage")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <ImageIcon className="size-4" /> Ajouter Image
          </button>
          <button
            onClick={() => handleAction("addYoutube")}
            className="focus-ring hover:bg-panel flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors"
          >
            <Play className="size-4" /> Ajouter YouTube
          </button>
        </>
      )}
    </div>
  )
}

export default SlideContextMenu
