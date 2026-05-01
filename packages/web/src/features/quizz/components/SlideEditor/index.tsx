import { type SlideElement, type YoutubeElement, type TextElement, type ShapeElement } from "@rahoot/common/types/game"
import { Expand, Play, Type, Square, Image as ImageIcon, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 as uuidv4 } from "uuid"
import SlideCanvas from "./SlideCanvas"
import SlidePreviewModal from "./SlidePreviewModal"
import YoutubePanel from "./YoutubePanel"

type SlideEditorProps = {
  elements: SlideElement[]
  onChange: (_elements: SlideElement[]) => void
}

const hasColor = (el: SlideElement): el is TextElement | ShapeElement =>
  el.type === "text" || el.type === "shape"

const SlideEditor = ({ elements, onChange }: SlideEditorProps) => {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [showYoutubePanel, setShowYoutubePanel] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedElement = elements.find((e) => e.id === selectedId)

  const addText = () => {
    const el: SlideElement = {
      id: `el_${  uuidv4()}`,
      type: "text",
      text: "Texte",
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      width: 400,
      height: 100,
      rotation: 0,
      opacity: 1,
      fontSize: 60,
      fontFamily: "Arial",
      fontStyle: "normal",
      textDecoration: "none",
      fill: "#000000",
      align: "left",
    }
    onChange([...elements, el])
    setSelectedId(el.id)
  }

  const addShape = () => {
    const el: SlideElement = {
      id: `el_${  uuidv4()}`,
      type: "shape",
      shapeType: "rect",
      x: 150 + Math.random() * 100,
      y: 150 + Math.random() * 100,
      width: 200,
      height: 150,
      rotation: 0,
      opacity: 1,
      fill: "#3b82f6",
    }
    onChange([...elements, el])
    setSelectedId(el.id)
  }

  const handleAddImage = () => {
    // eslint-disable-next-line no-alert
    const url = window.prompt("URL de l'image :", "https://picsum.photos/400/300")

    if (!url) {return}

    const img = new window.Image()
    img.crossOrigin = "Anonymous"
    
    const addImageElement = (w: number, h: number) => {
      const newImage: SlideElement = {
        id: `el_${  uuidv4()}`,
        type: "image",
        url,
        x: 100 + Math.random() * 50,
        y: 100 + Math.random() * 50,
        width: w,
        height: h,
        rotation: 0,
        opacity: 1,
      }
      onChange([...elements, newImage])
      setSelectedId(newImage.id)
    }

    img.onload = () => {
      let width = img.naturalWidth
      let height = img.naturalHeight

      if (width > 600 || height > 600) {
        const ratio = Math.min(600 / width, 600 / height)
        width *= ratio
        height *= ratio
      }

      addImageElement(width, height)
    }
    img.onerror = () => addImageElement(400, 300)
    img.src = url
  }

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string

      if (!dataUrl) {return}

      const img = new window.Image()
      img.onload = () => {
        let width = img.naturalWidth
        let height = img.naturalHeight

        if (width > 600 || height > 600) {
          const ratio = Math.min(600 / width, 600 / height)
          width *= ratio
          height *= ratio
        }

        const el: SlideElement = {
          id: `el_${  uuidv4()}`,
          type: "image",
          url: dataUrl,
          x: 200 + Math.random() * 100,
          y: 200 + Math.random() * 100,
          width,
          height,
          rotation: 0,
          opacity: 1,
        }
        onChange([...elements, el])
        setSelectedId(el.id)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const updateSelected = (updates: Partial<SlideElement>) => {
    if (!selectedId) {
      return
    }

    onChange(
      elements.map((el) => (el.id === selectedId ? ({ ...el, ...updates } as SlideElement) : el)),
    )
  }

  const removeSelected = () => {
    onChange(elements.filter((e) => e.id !== selectedId))
    setSelectedId(undefined)
  }

  const bringToFront = () => {
    if (!selectedElement) {
      return
    }

    onChange([...elements.filter((e) => e.id !== selectedId), selectedElement])
  }

  const sendToBack = () => {
    if (!selectedElement) {
      return
    }

    onChange([selectedElement, ...elements.filter((e) => e.id !== selectedId)])
  }

  const handleYoutubeAdd = (el: YoutubeElement) => {
    onChange([...elements, el])
    setSelectedId(el.id)
    setShowYoutubePanel(false)
  }

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]

          if (file) {
            void handleImageUpload(file)
          }

          e.target.value = ""
        }}
      />

      {/* Barre d'outils */}
      <div className="absolute top-3 right-3 flex flex-wrap items-center gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-gray-200 pointer-events-auto z-50">
        <button
          onClick={addText}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
          title={t("quizz:addText")}
        >
          <Type className="size-4" />
        </button>
        <button
          onClick={addShape}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
          title={t("quizz:addShape")}
        >
          <Square className="size-4" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
          title={t("quizz:uploadImage")}
        >
          <Upload className="size-4" />
        </button>
        <button
          onClick={handleAddImage}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
          title={t("quizz:addImage")}
        >
          <ImageIcon className="size-4" />
        </button>
        <button
          onClick={() => setShowYoutubePanel((v) => !v)}
          className={`p-2 rounded-lg transition-colors ${showYoutubePanel ? "bg-red-100 text-red-600" : "hover:bg-gray-100 text-gray-700"}`}
          title="YouTube"
        >
          <Play className="size-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <button
          onClick={() => setShowPreview(true)}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
          title="Aperçu plein écran"
        >
          <Expand className="size-4" />
        </button>

        {/* Propriétés de l'élément sélectionné */}
        {selectedElement && (
          <div className="flex items-center gap-2 border-l pl-2 border-gray-200 ml-1">
            {selectedElement.type === "text" && (
              <>
                <input
                  type="text"
                  value={selectedElement.text}
                  onChange={(e) => updateSelected({ text: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1 text-xs w-32"
                />
                <input
                  type="number"
                  value={selectedElement.fontSize}
                  onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                  className="border border-gray-300 rounded px-1 py-1 text-xs w-14"
                  min={8}
                  max={400}
                  title="Taille"
                />
              </>
            )}

            {hasColor(selectedElement) && (
              <input
                type="color"
                value={selectedElement.fill}
                onChange={(e) => updateSelected({ fill: e.target.value })}
                className="w-7 h-7 p-0 border-0 rounded cursor-pointer"
                title="Couleur"
              />
            )}

            <button
              onClick={bringToFront}
              className="p-1 hover:bg-gray-100 rounded text-xs text-gray-600 font-bold"
              title="Devant"
            >
              ↑
            </button>
            <button
              onClick={sendToBack}
              className="p-1 hover:bg-gray-100 rounded text-xs text-gray-600 font-bold"
              title="Derrière"
            >
              ↓
            </button>
            <button
              onClick={removeSelected}
              className="p-1 text-xs text-red-500 hover:bg-red-50 rounded font-medium"
              title="Supprimer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

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
        />
      </div>

      {showPreview && (
        <SlidePreviewModal
          elements={elements}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

export default SlideEditor
