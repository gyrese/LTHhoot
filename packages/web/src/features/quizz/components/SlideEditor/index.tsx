import { type SlideElement, type YoutubeElement, type TextElement, type ShapeElement } from "@rahoot/common/types/game"
import { Expand, Play, Type, Square, Image as ImageIcon, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 as uuidv4 } from "uuid"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import SlideCanvas from "./SlideCanvas"
import SlidePreviewModal from "./SlidePreviewModal"
import YoutubePanel from "./YoutubePanel"
import SlideContextMenu, { type ContextMenuAction } from "./SlideContextMenu"

type SlideEditorProps = {
  elements: SlideElement[]
  onChange: (_elements: SlideElement[]) => void
}

const hasColor = (el: SlideElement): el is TextElement | ShapeElement =>
  el.type === "text" || el.type === "shape"

const SlideEditor = ({ elements, onChange }: SlideEditorProps) => {
  const { currentQuestion, selectedId, setSelectedId } = useQuizzEditor()
  const [showYoutubePanel, setShowYoutubePanel] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean } | null>(null)
  const [copiedElement, setCopiedElement] = useState<SlideElement | null>(null)

  const handleYoutubeAdd = (el: YoutubeElement) => {
    onChange([...elements, el])
    setSelectedId(el.id)
    setShowYoutubePanel(false)
  }

  const handleContextMenuAction = (action: ContextMenuAction) => {
    // Note: Context menu actions could also be refactored to use the factory but keeping them here for now
    switch (action) {
      case "copy":
        const selected = elements.find(e => e.id === selectedId)
        if (selected) setCopiedElement(selected)
        break
      case "paste":
        if (copiedElement) {
          const newEl = { ...copiedElement, id: `el_${uuidv4()}`, x: copiedElement.x + 20, y: copiedElement.y + 20 }
          onChange([...elements, newEl])
          setSelectedId(newEl.id)
        }
        break
      case "delete":
        onChange(elements.filter(e => e.id !== selectedId))
        setSelectedId(undefined)
        break
      // other actions can be added if needed, but the main toolbar handles them now
    }
  }

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      {/* Panneau YouTube */}
      {showYoutubePanel && (
        <div className="absolute top-14 right-3 z-50 pointer-events-auto">
          <YoutubePanel onAdd={handleYoutubeAdd} onClose={() => setShowYoutubePanel(false)} />
        </div>
      )}

      {/* Canvas Konva */}
      <div className="absolute inset-0 w-full h-full pointer-events-auto">
        <SlideCanvas
          elements={elements}
          onChange={onChange}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onContextMenuEvent={(e) => {
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              show: true,
            })
          }}
        />
      </div>

      {contextMenu?.show && (
        <SlideContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={!!selectedId}
          canPaste={!!copiedElement}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
        />
      )}

      {showPreview && (
        <SlidePreviewModal
          question={currentQuestion}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

export default SlideEditor
