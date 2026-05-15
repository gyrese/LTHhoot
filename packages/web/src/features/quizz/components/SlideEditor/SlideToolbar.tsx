import {
  type SlideElement,
  type TextElement,
  type ShapeElement,
  type YoutubeElement,
} from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  Type,
  Square,
  Upload,
  Link,
  Play,
  Trash2,
  BringToFront,
  SendToBack,
  AlignCenter,
  Bold,
  Expand,
  X,
  Check,
  Undo2,
  Redo2,
} from "lucide-react"
import clsx from "clsx"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  createTextElement,
  createShapeElement,
  createImageElement,
} from "@rahoot/web/features/quizz/utils/element-factory"
import {
  BackgroundButton,
  AudioButton,
} from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorSlideToolbar"
import SlidePreviewModal from "@rahoot/web/features/quizz/components/SlideEditor/SlidePreviewModal"
import YoutubePanel from "@rahoot/web/features/quizz/components/SlideEditor/YoutubePanel"
import { AVAILABLE_FONTS } from "@rahoot/web/features/quizz/utils/fonts"

const SlideToolbar = () => {
  const {
    currentQuestion,
    currentIndex,
    updateQuestion,
    selectedId,
    setSelectedId,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showYoutubePanel, setShowYoutubePanel] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState("")

  const elements = currentQuestion.elements || []
  const selectedElement = elements.find((e) => e.id === selectedId)

  const handleUpdateElements = (newElements: SlideElement[]) => {
    updateQuestion(currentIndex, { elements: newElements })
  }

  const addText = () => {
    const el = createTextElement()
    handleUpdateElements([...elements, el])
    setSelectedId(el.id)
  }

  const addShape = () => {
    const el = createShapeElement()
    handleUpdateElements([...elements, el])
    setSelectedId(el.id)
  }

  const addImageFromUrl = () => {
    const url = urlValue.trim()

    if (!url) {
      return
    }

    const img = new window.Image()

    img.crossOrigin = "Anonymous"
    img.onload = () => {
      let width = img.naturalWidth
      let height = img.naturalHeight

      if (width > 600 || height > 600) {
        const ratio = Math.min(600 / width, 600 / height)
        width *= ratio
        height *= ratio
      }

      const newImage = createImageElement(url, width, height)

      handleUpdateElements([...elements, newImage])
      setSelectedId(newImage.id)
    }

    img.src = url
    setShowUrlInput(false)
    setUrlValue("")
  }

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string

      if (!dataUrl) {
        return
      }

      const img = new window.Image()

      img.onload = () => {
        let width = img.naturalWidth
        let height = img.naturalHeight

        if (width > 600 || height > 600) {
          const ratio = Math.min(600 / width, 600 / height)
          width *= ratio
          height *= ratio
        }

        const el = createImageElement(dataUrl, width, height)

        handleUpdateElements([...elements, el])
        setSelectedId(el.id)
      }

      img.src = dataUrl
    }

    reader.readAsDataURL(file)
  }

  const handleYoutubeAdd = (el: YoutubeElement) => {
    handleUpdateElements([...elements, el])
    setSelectedId(el.id)
    setShowYoutubePanel(false)
  }

  const updateSelected = (updates: Partial<SlideElement>) => {
    if (!selectedId) {
      return
    }

    handleUpdateElements(
      elements.map((el) =>
        el.id === selectedId ? ({ ...el, ...updates } as SlideElement) : el,
      ),
    )
  }

  const bringToFront = () => {
    if (!selectedElement) {
      return
    }

    handleUpdateElements([
      ...elements.filter((e) => e.id !== selectedId),
      selectedElement,
    ])
  }

  const sendToBack = () => {
    if (!selectedElement) {
      return
    }

    handleUpdateElements([
      selectedElement,
      ...elements.filter((e) => e.id !== selectedId),
    ])
  }

  const removeSelected = () => {
    handleUpdateElements(elements.filter((e) => e.id !== selectedId))
    setSelectedId(undefined)
  }

  const hasColor = (el: SlideElement): el is TextElement | ShapeElement =>
    el.type === "text" || el.type === "shape"

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]

          if (file) {
            handleImageUpload(file)
          }

          e.target.value = ""
        }}
      />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={clsx(
            "rounded p-1.5 transition-colors",
            canUndo
              ? "text-gray-700 hover:bg-gray-100"
              : "cursor-not-allowed text-gray-300",
          )}
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={clsx(
            "rounded p-1.5 transition-colors",
            canRedo
              ? "text-gray-700 hover:bg-gray-100"
              : "cursor-not-allowed text-gray-300",
          )}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo2 className="size-4" />
        </button>
      </div>

      <div className="mx-1.5 h-6 w-px bg-gray-200" />

      {/* Add tools */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={addText}
          className="rounded-lg p-1.5 text-gray-700 transition-colors hover:bg-gray-100"
          title={t("quizz:addText")}
        >
          <Type className="size-4" />
        </button>
        <button
          onClick={addShape}
          className="rounded-lg p-1.5 text-gray-700 transition-colors hover:bg-gray-100"
          title={t("quizz:addShape")}
        >
          <Square className="size-4" />
        </button>

        {/* Upload image depuis fichier */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg p-1.5 text-gray-700 transition-colors hover:bg-gray-100"
          title={t("quizz:uploadImage")}
        >
          <Upload className="size-4" />
        </button>

        {/* Ajouter image par URL */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUrlInput(!showUrlInput)
              setUrlValue("")
            }}
            className={`rounded-lg p-1.5 text-gray-700 transition-colors ${showUrlInput ? "bg-blue-50 text-blue-600" : "hover:bg-gray-100"}`}
            title={t("quizz:addImage")}
          >
            <Link className="size-4" />
          </button>

          {showUrlInput && (
            <div className="absolute top-full left-0 z-50 mt-1 flex min-w-72 gap-1.5 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <input
                autoFocus
                type="text"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addImageFromUrl()
                  }

                  if (e.key === "Escape") {
                    setShowUrlInput(false)
                  }
                }}
                placeholder="https://..."
                className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={addImageFromUrl}
                disabled={!urlValue.trim()}
                className="rounded bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={() => setShowUrlInput(false)}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* YouTube */}
        <div className="relative">
          <button
            onClick={() => setShowYoutubePanel(!showYoutubePanel)}
            className={`rounded-lg p-1.5 text-gray-700 transition-colors ${showYoutubePanel ? "bg-red-50 text-red-600" : "hover:bg-gray-100"}`}
            title="YouTube"
          >
            <Play className="size-4" />
          </button>

          {showYoutubePanel && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <YoutubePanel
                onAdd={handleYoutubeAdd}
                onClose={() => setShowYoutubePanel(false)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mx-1.5 h-6 w-px bg-gray-200" />

      {/* Background & Audio */}
      <div className="mr-1 flex items-center gap-2">
        <BackgroundButton />
        <AudioButton />
      </div>

      <div className="mx-1.5 h-6 w-px bg-gray-200" />

      <button
        onClick={() => setShowPreview(true)}
        className="rounded-lg p-1.5 text-gray-700 transition-colors hover:bg-gray-100"
        title="Aperçu"
      >
        <Expand className="size-4" />
      </button>

      {/* Outils élément sélectionné */}
      {selectedElement && (
        <>
          <div className="mx-1.5 h-6 w-px bg-gray-200" />

          <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-0.5 duration-200">
            {selectedElement.type === "text" && (
              <>
                <input
                  type="text"
                  value={(selectedElement as TextElement).text}
                  onChange={(e) => updateSelected({ text: e.target.value })}
                  className="focus:ring-primary/30 w-32 rounded border-none bg-gray-100 px-2 py-1 text-xs outline-none focus:ring-1"
                  placeholder="Texte..."
                />

                <div className="mr-1 ml-1 flex items-center gap-1 border-r border-gray-100 pr-1">
                  <select
                    value={
                      (selectedElement as TextElement).fontFamily || "Arial"
                    }
                    onChange={(e) =>
                      updateSelected({ fontFamily: e.target.value })
                    }
                    className="max-w-[120px] cursor-pointer rounded border-none bg-transparent px-1 py-1 text-xs font-medium outline-none hover:bg-gray-100"
                  >
                    {AVAILABLE_FONTS.map((font) => (
                      <option
                        key={font}
                        value={font}
                        style={{ fontFamily: font }}
                      >
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mr-1 flex items-center gap-1 border-r border-gray-100 pr-1">
                  <button
                    onClick={() =>
                      updateSelected({
                        fontSize: Math.max(
                          8,
                          ((selectedElement as TextElement).fontSize || 60) - 2,
                        ),
                      })
                    }
                    className="rounded p-1 text-xs font-bold hover:bg-gray-100"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={(selectedElement as TextElement).fontSize}
                    onChange={(e) =>
                      updateSelected({ fontSize: Number(e.target.value) })
                    }
                    className="w-10 bg-transparent text-center text-xs font-medium outline-none"
                  />
                  <button
                    onClick={() =>
                      updateSelected({
                        fontSize: Math.min(
                          400,
                          ((selectedElement as TextElement).fontSize || 60) + 2,
                        ),
                      })
                    }
                    className="rounded p-1 text-xs font-bold hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() =>
                    updateSelected({
                      fontStyle:
                        (selectedElement as TextElement).fontStyle === "bold"
                          ? "normal"
                          : "bold",
                    })
                  }
                  className={`rounded p-1.5 hover:bg-gray-100 ${(selectedElement as TextElement).fontStyle === "bold" ? "bg-blue-50 text-blue-600" : "text-gray-600"}`}
                >
                  <Bold className="size-4" />
                </button>
                <button
                  onClick={() => updateSelected({ align: "center" })}
                  className={`rounded p-1.5 hover:bg-gray-100 ${(selectedElement as TextElement).align === "center" ? "bg-blue-50 text-blue-600" : "text-gray-600"}`}
                >
                  <AlignCenter className="size-4" />
                </button>
              </>
            )}

            {hasColor(selectedElement) && (
              <div className="group relative mx-1">
                <div
                  className="size-5 cursor-pointer rounded border border-gray-300 shadow-sm"
                  style={{ backgroundColor: selectedElement.fill }}
                />
                <input
                  type="color"
                  value={selectedElement.fill}
                  onChange={(e) => updateSelected({ fill: e.target.value })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            )}

            <div className="mx-1.5 h-6 w-px bg-gray-200" />

            <button
              onClick={bringToFront}
              className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
              title="Avancer"
            >
              <BringToFront className="size-4" />
            </button>
            <button
              onClick={sendToBack}
              className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
              title="Reculer"
            >
              <SendToBack className="size-4" />
            </button>
            <button
              onClick={removeSelected}
              className="ml-1 rounded p-1.5 text-red-500 hover:bg-red-50"
              title="Supprimer"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </>
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

export default SlideToolbar
