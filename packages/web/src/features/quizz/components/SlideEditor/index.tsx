import {
  type SlideElement,
  type SlideBackground,
} from "@rahoot/common/types/game"
import { useState } from "react"
import { generateElementId } from "@rahoot/web/features/quizz/utils/id"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import SlideCanvas from "./SlideCanvas"
import SlideContextMenu, { type ContextMenuAction } from "./SlideContextMenu"

type SlideEditorProps = {
  elements: SlideElement[]
  onChange: (_elements: SlideElement[]) => void
  background?: SlideBackground
  backgroundOpacity?: number
}

const SlideEditor = ({
  elements,
  onChange,
  background,
  backgroundOpacity,
}: SlideEditorProps) => {
  const { updateQuestion, currentIndex, selectedId, setSelectedId } =
    useQuizzEditor()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    show: boolean
  } | null>(null)
  const [copiedElement, setCopiedElement] = useState<SlideElement | null>(null)

  const selectedElement = elements.find((e) => e.id === selectedId)
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
            id: generateElementId(),
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
          onChange([
            ...elements.filter((e) => e.id !== selectedId),
            selectedElement,
          ])
        }

        break
      }

      case "sendToBack": {
        if (selectedId && selectedElement) {
          onChange([
            selectedElement,
            ...elements.filter((e) => e.id !== selectedId),
          ])
        }

        break
      }

      case "bringForward": {
        if (selectedId && selectedElement) {
          const idx = elements.findIndex((e) => e.id === selectedId)

          if (idx < elements.length - 1) {
            const newElements = [...elements]
            const temp = newElements[idx]
            newElements[idx] = newElements[idx + 1]
            newElements[idx + 1] = temp
            onChange(newElements)
          }
        }

        break
      }

      case "sendBackward": {
        if (selectedId && selectedElement) {
          const idx = elements.findIndex((e) => e.id === selectedId)

          if (idx > 0) {
            const newElements = [...elements]
            const temp = newElements[idx]
            newElements[idx] = newElements[idx - 1]
            newElements[idx - 1] = temp
            onChange(newElements)
          }
        }

        break
      }

      case "setAsBackground": {
        if (
          selectedType === "image" &&
          selectedElement &&
          "url" in selectedElement
        ) {
          updateQuestion(currentIndex, {
            background: { type: "image", value: selectedElement.url },
            elements: elements.filter((e) => e.id !== selectedId),
          })
          setSelectedId(undefined)
        }

        break
      }

      case "opacity": {
        if (selectedElement) {
          const newOpacity = (selectedElement.opacity || 1) <= 0.5 ? 1 : 0.5
          onChange(
            elements.map((e) =>
              e.id === selectedId ? { ...e, opacity: newOpacity } : e,
            ),
          )
        }

        break
      }

      default:
        break
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full">
      <div className="pointer-events-auto absolute inset-0 h-full w-full">
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
