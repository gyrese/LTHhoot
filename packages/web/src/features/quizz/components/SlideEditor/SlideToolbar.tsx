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
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
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
  const reduceMotion = useReducedMotion()
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

        {/* Upload image depuis fichier */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="focus-ring text-ink-muted hover:bg-panel hover:text-ink rounded-lg p-1.5 transition-colors duration-150"
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
            className={clsx(
              "focus-ring rounded-lg p-1.5 transition-colors duration-150",
              showUrlInput
                ? "bg-primary-soft text-primary-ink"
                : "text-ink-muted hover:bg-panel hover:text-ink",
            )}
            title={t("quizz:addImage")}
          >
            <Link className="size-4" />
          </button>

          <AnimatePresence>
            {showUrlInput && (
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                style={{ transformOrigin: "top left" }}
                className="border-border bg-elevated absolute top-full left-0 z-50 mt-1.5 flex min-w-72 gap-1.5 rounded-xl border p-2 shadow-xl shadow-black/10"
              >
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
                  className="border-border text-ink focus:border-primary flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  onClick={addImageFromUrl}
                  disabled={!urlValue.trim()}
                  className="bg-primary text-secondary rounded-lg p-1.5 transition-transform duration-150 hover:brightness-[1.03] active:scale-95 disabled:opacity-40"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  onClick={() => setShowUrlInput(false)}
                  className="text-ink-muted hover:bg-panel rounded-lg p-1.5 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
    </div>
  )
}

export default SlideToolbar
