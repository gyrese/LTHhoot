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
  Play,
  Trash2,
  BringToFront,
  SendToBack,
  AlignCenter,
  Bold,
  Expand,
  Undo2,
  Redo2,
  AlignLeft,
  AlignRight,
  ArrowUpToLine,
  ArrowDownToLine,
  Minimize2,
  Image as ImageIcon,
  Radius,
  Droplet,
} from "lucide-react"
import clsx from "clsx"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import MediaSearchModal from "@rahoot/web/features/quizz/components/MediaSearchModal"
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
import { uploadImageToServer } from "@rahoot/web/features/quizz/utils/upload"

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
  const reduceMotion = useReducedMotion()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showYoutubePanel, setShowYoutubePanel] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)

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

  const handleAddMedia = (url: string) => {
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

  const handleImageUpload = async (file: File) => {
    try {
      const uploadedUrl = await uploadImageToServer(file)

      const img = new window.Image()

      img.onload = () => {
        let width = img.naturalWidth
        let height = img.naturalHeight

        if (width > 600 || height > 600) {
          const ratio = Math.min(600 / width, 600 / height)
          width *= ratio
          height *= ratio
        }

        const el = createImageElement(uploadedUrl, width, height)

        handleUpdateElements([...elements, el])
        setSelectedId(el.id)
      }

      img.src = uploadedUrl
    } catch (err) {
      console.error("Error uploading image in toolbar:", err)
    }
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

  const isRectShape = (el: SlideElement): el is ShapeElement =>
    el.type === "shape" && el.shapeType === "rect"

  const CANVAS_W = 1920
  const CANVAS_H = 1080

  const alignElement = (alignment: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => {
    if (!selectedElement) return
    const width = selectedElement.width
    const height = selectedElement.height
    
    let updates = {}
    switch (alignment) {
      case "left":
        updates = { x: 0 }
        break
      case "centerX":
        updates = { x: Math.round((CANVAS_W - width) / 2) }
        break
      case "right":
        updates = { x: CANVAS_W - width }
        break
      case "top":
        updates = { y: 0 }
        break
      case "centerY":
        updates = { y: Math.round((CANVAS_H - height) / 2) }
        break
      case "bottom":
        updates = { y: CANVAS_H - height }
        break
    }
    
    updateSelected(updates)
  }

  return (
    <div className="border-border bg-surface flex items-center gap-0.5 rounded-xl border px-1.5 py-1 shadow-sm shadow-black/5">
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
              ? "text-ink-muted hover:bg-panel hover:text-ink"
              : "text-ink-subtle/40 cursor-not-allowed",
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
              ? "text-ink-muted hover:bg-panel hover:text-ink"
              : "text-ink-subtle/40 cursor-not-allowed",
          )}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo2 className="size-4" />
        </button>
      </div>

      <div className="bg-border mx-1 h-6 w-px" />

      {/* Add tools */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={addText}
          className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors duration-150"
          title={t("quizz:addText")}
        >
          <Type className="size-4" />
        </button>
        <button
          onClick={addShape}
          className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors duration-150"
          title={t("quizz:addShape")}
        >
          <Square className="size-4" />
        </button>

        {/* Ajouter Image (ouvre la modal) */}
        <button
          onClick={() => setShowMediaModal(true)}
          className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors duration-150"
          title={t("quizz:addImage", "Ajouter une image / GIF")}
        >
          <ImageIcon className="size-4" />
        </button>

        {/* YouTube */}
        <div className="relative">
          <button
            onClick={() => setShowYoutubePanel(!showYoutubePanel)}
            className={clsx(
              "focus-ring rounded-lg p-1.5 transition-colors duration-150",
              showYoutubePanel
                ? "bg-primary-soft text-primary-ink"
                : "text-ink-muted hover:bg-panel hover:text-ink",
            )}
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

      <div className="bg-border mx-1 h-6 w-px" />

      {/* Background & Audio */}
      <div className="mr-1 flex items-center gap-2">
        <BackgroundButton />
        <AudioButton />
      </div>

      <div className="bg-border mx-1 h-6 w-px" />

      <button
        onClick={() => setShowPreview(true)}
        className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors duration-150"
        title="Aperçu"
      >
        <Expand className="size-4" />
      </button>

      {/* Outils élément sélectionné */}
      <AnimatePresence>
        {selectedElement && (
          <motion.div
            key="element-tools"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="flex items-center gap-0.5"
          >
            <div className="bg-border mx-1 h-6 w-px" />

            {selectedElement.type === "text" && (
              <>
                <input
                  type="text"
                  value={(selectedElement as TextElement).text}
                  onChange={(e) => updateSelected({ text: e.target.value })}
                  className="bg-panel text-ink focus:ring-primary/40 w-32 rounded-lg border-none px-2 py-1 text-xs outline-none focus:ring-2"
                  placeholder="Texte..."
                />

                <div className="border-border mr-1 ml-1 flex items-center gap-1 border-r pr-1">
                  <select
                    value={
                      (selectedElement as TextElement).fontFamily || "Arial"
                    }
                    onChange={(e) =>
                      updateSelected({ fontFamily: e.target.value })
                    }
                    className="text-ink hover:bg-panel max-w-[120px] cursor-pointer rounded-lg border-none bg-transparent px-1 py-1 text-xs font-medium outline-none"
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

                <div className="border-border mr-1 flex items-center gap-1 border-r pr-1">
                  <button
                    onClick={() =>
                      updateSelected({
                        fontSize: Math.max(
                          8,
                          ((selectedElement as TextElement).fontSize || 60) - 2,
                        ),
                      })
                    }
                    className="text-ink-muted hover:bg-panel hover:text-ink rounded-md p-1 text-xs font-bold transition-colors active:scale-95"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={(selectedElement as TextElement).fontSize}
                    onChange={(e) =>
                      updateSelected({ fontSize: Number(e.target.value) })
                    }
                    className="text-ink w-10 bg-transparent text-center text-xs font-medium outline-none"
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
                    className="text-ink-muted hover:bg-panel hover:text-ink rounded-md p-1 text-xs font-bold transition-colors active:scale-95"
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
                  className={clsx(
                    "focus-ring rounded-lg p-1.5 transition-colors active:scale-95",
                    (selectedElement as TextElement).fontStyle === "bold"
                      ? "bg-primary-soft text-primary-ink"
                      : "text-ink-muted hover:bg-panel hover:text-ink",
                  )}
                >
                  <Bold className="size-4" />
                </button>
                <button
                  onClick={() => updateSelected({ align: "center" })}
                  className={clsx(
                    "focus-ring rounded-lg p-1.5 transition-colors active:scale-95",
                    (selectedElement as TextElement).align === "center"
                      ? "bg-primary-soft text-primary-ink"
                      : "text-ink-muted hover:bg-panel hover:text-ink",
                  )}
                >
                  <AlignCenter className="size-4" />
                </button>
              </>
            )}

            {hasColor(selectedElement) && (
              <div className="group relative mx-1">
                <div
                  className="border-border-strong size-5 cursor-pointer rounded-md border shadow-sm"
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

            {isRectShape(selectedElement) && (
              <div className="mr-1 flex items-center gap-1" title="Angles arrondis">
                <Radius className="text-ink-muted size-4 shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={Math.min(selectedElement.width, selectedElement.height) / 2}
                  value={selectedElement.cornerRadius || 0}
                  onChange={(e) =>
                    updateSelected({ cornerRadius: Number(e.target.value) })
                  }
                  className="accent-primary h-1 w-16 cursor-pointer"
                />
              </div>
            )}

            <div className="mr-1 flex items-center gap-1" title="Opacité">
              <Droplet className="text-ink-muted size-4 shrink-0" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={selectedElement.opacity ?? 1}
                onChange={(e) =>
                  updateSelected({ opacity: Number(e.target.value) })
                }
                className="accent-primary h-1 w-16 cursor-pointer"
              />
              <span className="text-ink-subtle w-8 text-right text-[10px] tabular-nums">
                {Math.round((selectedElement.opacity ?? 1) * 100)}%
              </span>
            </div>

            <div className="bg-border mx-1 h-6 w-px" />

            {/* Alignements horizontaux */}
            <button
              onClick={() => alignElement("left")}
              className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors active:scale-95"
              title="Aligner à gauche"
            >
              <AlignLeft className="size-4" />
            </button>
            <button
              onClick={() => alignElement("centerX")}
              className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors active:scale-95"
              title="Centrer horizontalement"
            >
              <AlignCenter className="size-4" />
            </button>
            <button
              onClick={() => alignElement("right")}
              className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors active:scale-95"
              title="Aligner à droite"
            >
              <AlignRight className="size-4" />
            </button>

            <div className="bg-border mx-0.5 h-6 w-px opacity-50" />

            {/* Alignements verticaux */}
            <button
              onClick={() => alignElement("top")}
              className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors active:scale-95"
              title="Aligner en haut"
            >
              <ArrowUpToLine className="size-4" />
            </button>
            <button
              onClick={() => alignElement("centerY")}
              className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors active:scale-95"
              title="Centrer verticalement"
            >
              <Minimize2 className="size-4 rotate-90" />
            </button>
            <button
              onClick={() => alignElement("bottom")}
              className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors active:scale-95"
              title="Aligner en bas"
            >
              <ArrowDownToLine className="size-4" />
            </button>

            <div className="bg-border mx-1 h-6 w-px" />

            <button
              onClick={bringToFront}
              className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors active:scale-95"
              title="Avancer"
            >
              <BringToFront className="size-4" />
            </button>
            <button
              onClick={sendToBack}
              className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors active:scale-95"
              title="Reculer"
            >
              <SendToBack className="size-4" />
            </button>
            <button
              onClick={removeSelected}
              className="focus-ring text-danger hover:bg-danger-soft ml-1 rounded-lg p-1.5 transition-colors active:scale-95"
              title="Supprimer"
            >
              <Trash2 className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showPreview && (
        <SlidePreviewModal
          question={currentQuestion}
          onClose={() => setShowPreview(false)}
        />
      )}
      <MediaSearchModal
        open={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onSelect={handleAddMedia}
      />
    </div>
  )
}

export default SlideToolbar
