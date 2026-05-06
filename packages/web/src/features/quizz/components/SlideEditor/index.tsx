import { type SlideElement, type SlideBackground } from "@rahoot/common/types/game"
import { useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import SlideCanvas from "./SlideCanvas"
import SlideContextMenu, { type ContextMenuAction } from "./SlideContextMenu"

type SlideEditorProps = {
  elements: SlideElement[]
  onChange: (_elements: SlideElement[]) => void
  background?: SlideBackground
  backgroundOpacity?: number
}

const SlideEditor = ({ elements, onChange, background, backgroundOpacity }: SlideEditorProps) => {
  const { currentQuestion, updateQuestion, currentIndex, selectedId, setSelectedId } = useQuizzEditor()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean } | null>(null)
  const [copiedElement, setCopiedElement] = useState<SlideElement | null>(null)

  const selectedElement = elements.find(e => e.id === selectedId)
  const selectedType = selectedElement?.type

  const handleContextMenuAction = (action: ContextMenuAction) => {
    switch (action) {
      case "copy": {
        const selected = elements.find((e) => e.id === selectedId)

        if (selected) {
          setCopiedElement(selected)
        }

        break
      }

      case "paste": {
        if (copiedElement) {
          const newEl = {
            ...copiedElement,
            id: `el_${uuidv4()}`,
            x: copiedElement.x + 20,
            y: copiedElement.y + 20,
          }

          onChange([...elements, newEl])
          setSelectedId(newEl.id)
        }

        break
      }

      case "delete": {
        onChange(elements.filter((e) => e.id !== selectedId))
        setSelectedId(undefined)
        break
      }

      case "bringToFront": {
        if (selectedId && selectedElement) {
          onChange([...elements.filter(e => e.id !== selectedId), selectedElement])
        }
        break
      }

      case "sendToBack": {
        if (selectedId && selectedElement) {
          onChange([selectedElement, ...elements.filter(e => e.id !== selectedId)])
        }
        break
      }

      case "setAsBackground": {
        if (selectedType === "image" && selectedElement && "url" in selectedElement) {
          updateQuestion(currentIndex, { 
            background: { type: "image", value: selectedElement.url },
            elements: elements.filter(e => e.id !== selectedId)
          })
          setSelectedId(undefined)
        }
        break
      }

      case "opacity": {
        if (selectedElement) {
          const newOpacity = ((selectedElement.opacity || 1) <= 0.5) ? 1 : 0.5
          onChange(elements.map(e => e.id === selectedId ? { ...e, opacity: newOpacity } : e))
        }
        break
      }

      case "crop": {
        alert("Action Recadrer à implémenter")
        break
      }

      default:
        break
    }
  }

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <div className="absolute inset-0 w-full h-full pointer-events-auto">
        <SlideCanvas
          elements={elements}
          onChange={onChange}
          selectedId={selectedId}
          onSelect={setSelectedId}
          background={background}
          backgroundOpacity={backgroundOpacity}
          onContextMenuEvent={(e) => {
            setContextMenu({ x: e.clientX, y: e.clientY, show: true })
          }}
        />
      </div>

      {contextMenu?.show && (
        <SlideContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={Boolean(selectedId)}
          selectedType={selectedType}
          canPaste={Boolean(copiedElement)}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
        />
      )}
    </div>
  )
}

export default SlideEditor
