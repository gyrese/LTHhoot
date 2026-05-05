import { type SlideElement, type TextElement, type ShapeElement, type YoutubeElement } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { 
  Type, 
  Square, 
  Upload, 
  Image as ImageIcon, 
  Play, 
  Undo2, 
  Redo2, 
  Trash2, 
  BringToFront, 
  SendToBack,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Expand
} from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { createTextElement, createShapeElement, createImageElement } from "@rahoot/web/features/quizz/utils/element-factory"
import { BackgroundButton, AudioButton } from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorSlideToolbar"
import SlidePreviewModal from "@rahoot/web/features/quizz/components/SlideEditor/SlidePreviewModal"
import { AVAILABLE_FONTS } from "@rahoot/web/features/quizz/utils/fonts"

const SlideToolbar = () => {
  const { currentQuestion, currentIndex, updateQuestion, selectedId, setSelectedId } = useQuizzEditor()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPreview, setShowPreview] = useState(false)
  
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

  const handleAddImage = () => {
    const url = window.prompt("URL de l'image :", "https://picsum.photos/400/300")
    if (!url) return

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
  }

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) return

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

  const updateSelected = (updates: Partial<SlideElement>) => {
    if (!selectedId) return
    handleUpdateElements(
      elements.map((el) => (el.id === selectedId ? ({ ...el, ...updates } as SlideElement) : el))
    )
  }

  const bringToFront = () => {
    if (!selectedElement) return
    handleUpdateElements([...elements.filter((e) => e.id !== selectedId), selectedElement])
  }

  const sendToBack = () => {
    if (!selectedElement) return
    handleUpdateElements([selectedElement, ...elements.filter((e) => e.id !== selectedId)])
  }

  const removeSelected = () => {
    handleUpdateElements(elements.filter((e) => e.id !== selectedId))
    setSelectedId(undefined)
  }

  const hasColor = (el: SlideElement): el is TextElement | ShapeElement =>
    el.type === "text" || el.type === "shape"

  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageUpload(file)
          e.target.value = ""
        }}
      />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 cursor-not-allowed" title="Annuler">
          <Undo2 className="size-4" />
        </button>
        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 cursor-not-allowed" title="Rétablir">
          <Redo2 className="size-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1.5" />

      {/* Add tools */}
      <div className="flex items-center gap-0.5">
        <button onClick={addText} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title={t("quizz:addText")}>
          <Type className="size-4" />
        </button>
        <button onClick={addShape} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title={t("quizz:addShape")}>
          <Square className="size-4" />
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title={t("quizz:uploadImage")}>
          <Upload className="size-4" />
        </button>
        <button onClick={handleAddImage} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title={t("quizz:addImage")}>
          <ImageIcon className="size-4" />
        </button>
        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title="YouTube">
          <Play className="size-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1.5" />

      {/* Background & Audio */}
      <div className="flex items-center gap-2 mr-1">
        <BackgroundButton />
        <AudioButton />
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1.5" />

      <button 
        onClick={() => setShowPreview(true)}
        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" 
        title="Aperçu"
      >
        <Expand className="size-4" />
      </button>

      {/* Element specific tools */}
      {selectedElement && (
        <>
          <div className="w-px h-6 bg-gray-200 mx-1.5" />
          
          <div className="flex items-center gap-0.5 animate-in fade-in slide-in-from-left-2 duration-200">
            {selectedElement.type === "text" && (
              <>
                <input
                  type="text"
                  value={(selectedElement as TextElement).text}
                  onChange={(e) => updateSelected({ text: e.target.value })}
                  className="bg-gray-100 border-none rounded px-2 py-1 text-xs w-32 outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Texte..."
                />

                <div className="flex items-center gap-1 border-r border-gray-100 pr-1 mr-1 ml-1">
                  <select
                    value={(selectedElement as TextElement).fontFamily || "Arial"}
                    onChange={(e) => updateSelected({ fontFamily: e.target.value })}
                    className="bg-transparent border-none text-xs font-medium outline-none cursor-pointer hover:bg-gray-100 rounded px-1 py-1 max-w-[120px]"
                  >
                    {AVAILABLE_FONTS.map(font => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 border-r border-gray-100 pr-1 mr-1">
                  <button 
                    onClick={() => updateSelected({ fontSize: Math.max(8, ((selectedElement as TextElement).fontSize || 60) - 2) })}
                    className="p-1 hover:bg-gray-100 rounded font-bold text-xs"
                  >-</button>
                  <input
                    type="number"
                    value={(selectedElement as TextElement).fontSize}
                    onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                    className="bg-transparent text-center text-xs w-10 font-medium outline-none"
                  />
                  <button 
                    onClick={() => updateSelected({ fontSize: Math.min(400, ((selectedElement as TextElement).fontSize || 60) + 2) })}
                    className="p-1 hover:bg-gray-100 rounded font-bold text-xs"
                  >+</button>
                </div>

                <button 
                  onClick={() => updateSelected({ fontStyle: (selectedElement as TextElement).fontStyle === "bold" ? "normal" : "bold" })}
                  className={`p-1.5 rounded hover:bg-gray-100 ${(selectedElement as TextElement).fontStyle === "bold" ? "bg-blue-50 text-blue-600" : "text-gray-600"}`}
                >
                  <Bold className="size-4" />
                </button>
                <button 
                  onClick={() => updateSelected({ align: "center" })}
                  className={`p-1.5 rounded hover:bg-gray-100 ${(selectedElement as TextElement).align === "center" ? "bg-blue-50 text-blue-600" : "text-gray-600"}`}
                >
                  <AlignCenter className="size-4" />
                </button>
              </>
            )}

            {hasColor(selectedElement) && (
              <div className="relative group mx-1">
                 <div 
                  className="size-5 rounded border border-gray-300 cursor-pointer shadow-sm"
                  style={{ backgroundColor: selectedElement.fill }}
                />
                <input
                  type="color"
                  value={selectedElement.fill}
                  onChange={(e) => updateSelected({ fill: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            )}

            <div className="w-px h-6 bg-gray-200 mx-1.5" />

            <button onClick={bringToFront} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Avancer">
              <BringToFront className="size-4" />
            </button>
            <button onClick={sendToBack} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Reculer">
              <SendToBack className="size-4" />
            </button>
            <button onClick={removeSelected} className="p-1.5 hover:bg-red-50 rounded text-red-500 ml-1" title="Supprimer">
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
