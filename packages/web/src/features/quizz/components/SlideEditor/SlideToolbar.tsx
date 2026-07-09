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
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Layers,
  Lock,
  Unlock,
  RefreshCw,
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
    showLayersPanel,
    setShowLayersPanel,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showYoutubePanel, setShowYoutubePanel] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)
  const [isReplacingImage, setIsReplacingImage] = useState(false)

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
    if (isReplacingImage) {
      updateSelected({ url })
      setIsReplacingImage(false)
      setShowMediaModal(false)

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

  const alignElement = (
    alignment: "left" | "centerX" | "right" | "top" | "centerY" | "bottom",
  ) => {
    if (!selectedElement) {
      return
    }

    const { width } = selectedElement
    const { height } = selectedElement

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

  const isItalic = (selectedElement as TextElement)?.fontStyle?.includes(
    "italic",
  )
  const isBold = (selectedElement as TextElement)?.fontStyle?.includes("bold")
  const isUnderline = (
    selectedElement as TextElement
  )?.textDecoration?.includes("underline")
  const isStrikethrough = (
    selectedElement as TextElement
  )?.textDecoration?.includes("line-through")

  const toggleBold = () => {
    let nextStyle = "normal"

    if (isBold && isItalic) {
      nextStyle = "italic"
    } else if (isBold && !isItalic) {
      nextStyle = "normal"
    } else if (!isBold && isItalic) {
      nextStyle = "bold italic"
    } else {
      nextStyle = "bold"
    }

    updateSelected({ fontStyle: nextStyle })
  }

  const toggleItalic = () => {
    let nextStyle = "normal"

    if (isBold && isItalic) {
      nextStyle = "bold"
    } else if (!isBold && isItalic) {
      nextStyle = "normal"
    } else if (isBold && !isItalic) {
      nextStyle = "bold italic"
    } else {
      nextStyle = "italic"
    }

    updateSelected({ fontStyle: nextStyle })
  }

  const toggleUnderline = () => {
    let nextDecoration = "none"

    if (isUnderline && isStrikethrough) {
      nextDecoration = "line-through"
    } else if (isUnderline && !isStrikethrough) {
      nextDecoration = "none"
    } else if (!isUnderline && isStrikethrough) {
      nextDecoration = "underline line-through"
    } else {
      nextDecoration = "underline"
    }

    updateSelected({ textDecoration: nextDecoration })
  }

  const toggleStrikethrough = () => {
    let nextDecoration = "none"

    if (isUnderline && isStrikethrough) {
      nextDecoration = "underline"
    } else if (!isUnderline && isStrikethrough) {
      nextDecoration = "none"
    } else if (isUnderline && !isStrikethrough) {
      nextDecoration = "underline line-through"
    } else {
      nextDecoration = "line-through"
    }

    updateSelected({ textDecoration: nextDecoration })
  }

  const toggleLock = () => {
    if (selectedElement) {
      updateSelected({ isLocked: !selectedElement.isLocked })
    }
  }

  const handleReplaceImageClick = () => {
    setIsReplacingImage(true)
    setShowMediaModal(true)
  }

  return (
    <div className="flex w-full items-center justify-center gap-6 py-1 text-xs">
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

      {/* Partie Gauche : Outils généraux du canvas */}
      <div className="flex items-center gap-1">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={clsx(
              "cursor-pointer rounded p-1.5 transition-colors",
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
              "cursor-pointer rounded p-1.5 transition-colors",
              canRedo
                ? "text-ink-muted hover:bg-panel hover:text-ink"
                : "text-ink-subtle/40 cursor-not-allowed",
            )}
            title="Rétablir (Ctrl+Y)"
          >
            <Redo2 className="size-4" />
          </button>
        </div>

        <div className="bg-border mx-1 h-5 w-px" />

        {/* Add tools */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={addText}
            className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors duration-150"
            title={t("quizz:addText")}
          >
            <Type className="size-4" />
          </button>
          <button
            onClick={addShape}
            className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors duration-150"
            title={t("quizz:addShape")}
          >
            <Square className="size-4" />
          </button>

          {/* Ajouter Image */}
          <button
            onClick={() => {
              setIsReplacingImage(false)
              setShowMediaModal(true)
            }}
            className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors duration-150"
            title={t("quizz:addImage", "Ajouter une image / GIF")}
          >
            <ImageIcon className="size-4" />
          </button>

          {/* YouTube */}
          <div className="relative">
            <button
              onClick={() => setShowYoutubePanel(!showYoutubePanel)}
              className={clsx(
                "focus-ring cursor-pointer rounded-lg p-1.5 transition-colors duration-150",
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

        <div className="bg-border mx-1 h-5 w-px" />

        {/* Background & Audio */}
        <div className="flex items-center gap-1.5">
          <BackgroundButton />
          <AudioButton />
        </div>

        <div className="bg-border mx-1 h-5 w-px" />

        <button
          onClick={() => setShowPreview(true)}
          className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors duration-150"
          title="Aperçu"
        >
          <Expand className="size-4" />
        </button>

        <div className="bg-border mx-1 h-5 w-px" />

        {/* Bouton pour afficher/masquer le panneau de calques */}
        <button
          onClick={() => setShowLayersPanel(!showLayersPanel)}
          className={clsx(
            "focus-ring cursor-pointer rounded-lg p-1.5 transition-colors duration-150",
            showLayersPanel
              ? "bg-primary-soft text-primary-ink"
              : "text-ink-muted hover:bg-panel hover:text-ink",
          )}
          title="Afficher/Masquer le panneau de calques"
        >
          <Layers className="size-4" />
        </button>
      </div>

      {/* Partie Droite : Outils contextuels (Élément Sélectionné) */}
      <div className="flex items-center gap-1">
        <AnimatePresence>
          {selectedElement && (
            <motion.div
              key="element-tools"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-1 overflow-x-auto py-0.5 pr-1"
            >
              {/* Lock Button */}
              <button
                onClick={toggleLock}
                className={clsx(
                  "focus-ring cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95",
                  selectedElement.isLocked
                    ? "bg-danger-soft text-danger"
                    : "text-ink-muted hover:bg-panel hover:text-ink",
                )}
                title={
                  selectedElement.isLocked
                    ? "Déverrouiller le calque"
                    : "Verrouiller le calque"
                }
              >
                {selectedElement.isLocked ? (
                  <Lock className="size-4" />
                ) : (
                  <Unlock className="size-4" />
                )}
              </button>

              <div className="bg-border mx-1 h-5 w-px" />

              {/* Text specific tools */}
              {selectedElement.type === "text" && !selectedElement.isLocked && (
                <>
                  <input
                    type="text"
                    value={(selectedElement as TextElement).text}
                    onChange={(e) => updateSelected({ text: e.target.value })}
                    className="bg-panel text-ink focus:ring-primary/40 w-28 rounded-lg border-none px-2 py-1 text-xs outline-none focus:ring-2"
                    placeholder="Texte..."
                  />

                  <div className="border-border flex items-center gap-1 border-r pr-1">
                    <select
                      value={
                        (selectedElement as TextElement).fontFamily || "Arial"
                      }
                      onChange={(e) =>
                        updateSelected({ fontFamily: e.target.value })
                      }
                      className="text-ink hover:bg-panel max-w-[100px] cursor-pointer rounded-lg border-none bg-transparent px-1 py-1 text-xs font-medium outline-none"
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

                  <div className="border-border flex shrink-0 items-center gap-0.5 border-r pr-1">
                    <button
                      onClick={() =>
                        updateSelected({
                          fontSize: Math.max(
                            8,
                            ((selectedElement as TextElement).fontSize || 60) -
                              2,
                          ),
                        })
                      }
                      className="text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-md px-1 py-0.5 text-xs font-bold transition-colors active:scale-95"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={(selectedElement as TextElement).fontSize}
                      onChange={(e) =>
                        updateSelected({ fontSize: Number(e.target.value) })
                      }
                      className="text-ink w-8 bg-transparent text-center text-xs font-medium outline-none"
                    />
                    <button
                      onClick={() =>
                        updateSelected({
                          fontSize: Math.min(
                            400,
                            ((selectedElement as TextElement).fontSize || 60) +
                              2,
                          ),
                        })
                      }
                      className="text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-md px-1 py-0.5 text-xs font-bold transition-colors active:scale-95"
                    >
                      +
                    </button>
                  </div>

                  {/* Text Style formatting buttons (Bold, Italic, Underline) */}
                  <div className="border-border flex items-center gap-0.5 border-r pr-1">
                    <button
                      onClick={toggleBold}
                      className={clsx(
                        "focus-ring cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95",
                        isBold
                          ? "bg-primary-soft text-primary-ink font-bold"
                          : "text-ink-muted hover:bg-panel hover:text-ink",
                      )}
                      title="Gras"
                    >
                      <Bold className="size-4" />
                    </button>
                    <button
                      onClick={toggleItalic}
                      className={clsx(
                        "focus-ring cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95",
                        isItalic
                          ? "bg-primary-soft text-primary-ink italic"
                          : "text-ink-muted hover:bg-panel hover:text-ink",
                      )}
                      title="Italique"
                    >
                      <Italic className="size-4" />
                    </button>
                    <button
                      onClick={toggleUnderline}
                      className={clsx(
                        "focus-ring cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95",
                        isUnderline
                          ? "bg-primary-soft text-primary-ink underline"
                          : "text-ink-muted hover:bg-panel hover:text-ink",
                      )}
                      title="Souligné"
                    >
                      <Underline className="size-4" />
                    </button>
                    <button
                      onClick={toggleStrikethrough}
                      className={clsx(
                        "focus-ring cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95",
                        isStrikethrough
                          ? "bg-primary-soft text-primary-ink line-through"
                          : "text-ink-muted hover:bg-panel hover:text-ink",
                      )}
                      title="Barré"
                    >
                      <Strikethrough className="size-4" />
                    </button>
                  </div>
                </>
              )}
              {hasColor(selectedElement) && !selectedElement.isLocked && (
                <div
                  className="group relative mx-1 shrink-0"
                  title="Couleur de remplissage"
                >
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

              {/* Surlignage / Couleur de fond du texte */}
              {selectedElement.type === "text" && !selectedElement.isLocked && (
                <div className="border-border flex items-center gap-1 border-r pr-1">
                  <div
                    className="group relative mx-1 shrink-0"
                    title="Surlignage du texte"
                  >
                    <div
                      className="border-border-strong flex size-5 cursor-pointer items-center justify-center rounded-md border shadow-sm"
                      style={{
                        backgroundColor:
                          (selectedElement as TextElement).textBackground ||
                          "transparent",
                      }}
                    >
                      <Highlighter className="text-ink-muted size-3" />
                    </div>
                    <input
                      type="color"
                      value={
                        (selectedElement as TextElement).textBackground ||
                        "#ffff00"
                      }
                      onChange={(e) =>
                        updateSelected({ textBackground: e.target.value })
                      }
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </div>
                  {/* Supprimer le surlignage */}
                  {(selectedElement as TextElement).textBackground && (
                    <button
                      onClick={() =>
                        updateSelected({ textBackground: undefined })
                      }
                      className="text-danger hover:bg-danger-soft cursor-pointer rounded px-1 py-0.5 text-[9px] font-bold"
                      title="Enlever le surlignage"
                    >
                      X
                    </button>
                  )}
                </div>
              )}

              {/* Outils spécifiques au texte : Bordures / Contours (stroke) */}
              {selectedElement.type === "text" && !selectedElement.isLocked && (
                <div className="border-border flex shrink-0 items-center gap-1.5 border-r pr-1">
                  {/* Contour de couleur */}
                  <div
                    className="group relative mx-0.5 shrink-0"
                    title="Couleur de contour du texte"
                  >
                    <div
                      className="border-border-strong text-ink-muted flex size-5 cursor-pointer items-center justify-center rounded-md border text-[9px] font-bold shadow-sm"
                      style={{
                        backgroundColor:
                          (selectedElement as TextElement).stroke ||
                          "transparent",
                      }}
                    >
                      {!(selectedElement as TextElement).stroke && "A"}
                    </div>
                    <input
                      type="color"
                      value={
                        (selectedElement as TextElement).stroke || "#000000"
                      }
                      onChange={(e) =>
                        updateSelected({ stroke: e.target.value })
                      }
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </div>
                  {/* Épaisseur de contour */}
                  <div
                    className="flex items-center gap-1"
                    title="Épaisseur de contour du texte"
                  >
                    <span className="text-ink-subtle text-[9px] select-none">
                      Cont.
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={(selectedElement as TextElement).strokeWidth || 0}
                      onChange={(e) =>
                        updateSelected({ strokeWidth: Number(e.target.value) })
                      }
                      className="accent-primary h-1 w-10 cursor-pointer"
                    />
                    <span className="text-ink-subtle w-4 font-mono text-[9px] select-none">
                      {(selectedElement as TextElement).strokeWidth || 0}
                    </span>
                  </div>
                  {/* Supprimer le contour */}
                  {(selectedElement as TextElement).stroke && (
                    <button
                      onClick={() =>
                        updateSelected({ stroke: undefined, strokeWidth: 0 })
                      }
                      className="text-danger hover:bg-danger-soft cursor-pointer rounded px-1 py-0.5 text-[9px] font-bold"
                      title="Enlever le contour"
                    >
                      X
                    </button>
                  )}
                </div>
              )}

              {/* Outils spécifiques aux formes : Bordures / Contours */}
              {selectedElement.type === "shape" &&
                !selectedElement.isLocked && (
                  <div className="border-border flex shrink-0 items-center gap-1.5 border-r pr-1">
                    {/* Bordure de couleur */}
                    <div
                      className="group relative mx-0.5 shrink-0"
                      title="Couleur de bordure"
                    >
                      <div
                        className="border-border-strong size-5 cursor-pointer rounded-md border shadow-sm"
                        style={{
                          backgroundColor:
                            (selectedElement as ShapeElement).stroke ||
                            "transparent",
                        }}
                      />
                      <input
                        type="color"
                        value={
                          (selectedElement as ShapeElement).stroke || "#000000"
                        }
                        onChange={(e) =>
                          updateSelected({ stroke: e.target.value })
                        }
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </div>
                    {/* Épaisseur de bordure */}
                    <div
                      className="flex items-center gap-1"
                      title="Épaisseur de bordure"
                    >
                      <span className="text-ink-subtle text-[9px] select-none">
                        Ép.
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={
                          (selectedElement as ShapeElement).strokeWidth || 0
                        }
                        onChange={(e) =>
                          updateSelected({
                            strokeWidth: Number(e.target.value),
                          })
                        }
                        className="accent-primary h-1 w-10 cursor-pointer"
                      />
                      <span className="text-ink-subtle w-4 font-mono text-[9px] select-none">
                        {(selectedElement as ShapeElement).strokeWidth || 0}
                      </span>
                    </div>
                  </div>
                )}

              {/* Remplacer l'image */}
              {selectedElement.type === "image" &&
                !selectedElement.isLocked && (
                  <button
                    onClick={handleReplaceImageClick}
                    className="focus-ring text-ink-muted hover:bg-panel hover:text-ink flex shrink-0 cursor-pointer items-center gap-1 rounded-lg p-1.5 transition-colors active:scale-95"
                    title="Remplacer la source de l'image"
                  >
                    <RefreshCw className="size-4" />
                    <span>Remplacer</span>
                  </button>
                )}

              {/* Arrondis Rectangle */}
              {isRectShape(selectedElement) && !selectedElement.isLocked && (
                <div
                  className="flex shrink-0 items-center gap-1"
                  title="Angles arrondis"
                >
                  <Radius className="text-ink-muted size-4 shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={
                      Math.min(selectedElement.width, selectedElement.height) /
                      2
                    }
                    value={(selectedElement as ShapeElement).cornerRadius || 0}
                    onChange={(e) =>
                      updateSelected({ cornerRadius: Number(e.target.value) })
                    }
                    className="accent-primary h-1 w-12 cursor-pointer"
                  />
                </div>
              )}

              {/* Opacité (tous éléments sauf si verrouillé) */}
              {!selectedElement.isLocked && (
                <div
                  className="flex shrink-0 items-center gap-1"
                  title="Opacité"
                >
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
                    className="accent-primary h-1 w-12 cursor-pointer"
                  />
                  <span className="text-ink-subtle w-6 text-right text-[9px] tabular-nums select-none">
                    {Math.round((selectedElement.opacity ?? 1) * 100)}%
                  </span>
                </div>
              )}

              <div className="bg-border mx-1 h-5 w-px" />

              {/* Alignements généraux sur le canvas (sauf si verrouillé) */}
              {!selectedElement.isLocked && (
                <div className="flex items-center gap-0.5">
                  {/* Alignements horizontaux */}
                  <button
                    onClick={() => {
                      if (selectedElement.type === "text") {
                        updateSelected({ align: "left" })
                      } else {
                        alignElement("left")
                      }
                    }}
                    className={clsx(
                      "focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95",
                      selectedElement.type === "text" &&
                        (selectedElement as TextElement).align === "left" &&
                        "bg-primary-soft text-primary-ink",
                    )}
                    title="Aligner à gauche"
                  >
                    <AlignLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (selectedElement.type === "text") {
                        updateSelected({ align: "center" })
                      } else {
                        alignElement("centerX")
                      }
                    }}
                    className={clsx(
                      "focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95",
                      selectedElement.type === "text" &&
                        (selectedElement as TextElement).align === "center" &&
                        "bg-primary-soft text-primary-ink",
                    )}
                    title={
                      selectedElement.type === "text"
                        ? "Centrer le texte"
                        : "Centrer horizontalement"
                    }
                  >
                    <AlignCenter className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (selectedElement.type === "text") {
                        updateSelected({ align: "right" })
                      } else {
                        alignElement("right")
                      }
                    }}
                    className={clsx(
                      "focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95",
                      selectedElement.type === "text" &&
                        (selectedElement as TextElement).align === "right" &&
                        "bg-primary-soft text-primary-ink",
                    )}
                    title="Aligner à droite"
                  >
                    <AlignRight className="size-4" />
                  </button>

                  <div className="bg-border mx-0.5 h-5 w-px opacity-50" />

                  {/* Alignements verticaux */}
                  <button
                    onClick={() => alignElement("top")}
                    className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95"
                    title="Aligner en haut"
                  >
                    <ArrowUpToLine className="size-4" />
                  </button>
                  <button
                    onClick={() => alignElement("centerY")}
                    className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95"
                    title="Centrer verticalement"
                  >
                    <Minimize2 className="size-4 rotate-90" />
                  </button>
                  <button
                    onClick={() => alignElement("bottom")}
                    className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95"
                    title="Aligner en bas"
                  >
                    <ArrowDownToLine className="size-4" />
                  </button>

                  <div className="bg-border mx-1 h-5 w-px" />

                  {/* Plan/Order */}
                  <button
                    onClick={bringToFront}
                    className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95"
                    title="Avancer (Premier Plan)"
                  >
                    <BringToFront className="size-4" />
                  </button>
                  <button
                    onClick={sendToBack}
                    className="focus-ring text-ink-muted hover:bg-panel hover:text-ink cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95"
                    title="Reculer (Dernier Plan)"
                  >
                    <SendToBack className="size-4" />
                  </button>
                </div>
              )}

              {/* Bouton de suppression */}
              <button
                onClick={removeSelected}
                className="focus-ring text-danger hover:bg-danger-soft ml-1 cursor-pointer rounded-lg p-1.5 transition-colors active:scale-95"
                title="Supprimer l'élément"
              >
                <Trash2 className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showPreview && (
        <SlidePreviewModal
          question={currentQuestion}
          onClose={() => setShowPreview(false)}
        />
      )}
      <MediaSearchModal
        open={showMediaModal}
        onClose={() => {
          setShowMediaModal(false)
          setIsReplacingImage(false)
        }}
        onSelect={handleAddMedia}
      />
    </div>
  )
}

export default SlideToolbar
