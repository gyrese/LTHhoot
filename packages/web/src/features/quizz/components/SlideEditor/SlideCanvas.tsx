import {
  type SlideElement,
  type SlideBackground,
} from "@rahoot/common/types/game"
import slideBg from "@rahoot/web/assets/slide-bg.png"
import React, { useRef, useState, useEffect } from "react"
import {
  createImageElement,
  createTextElement,
} from "@rahoot/web/features/quizz/utils/element-factory"
import { uploadImageToServer } from "@rahoot/web/features/quizz/utils/upload"
import {
  Stage,
  Layer,
  Text,
  Rect,
  Ellipse,
  Line,
  Star,
  Transformer,
  Group,
  Image as KonvaImage,
} from "react-konva"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"

type SlideCanvasProps = {
  elements: SlideElement[]
  onChange: (_elements: SlideElement[]) => void
  selectedId?: string
  onSelect: (_id: string | undefined) => void
  // Sélection multiple d'éléments (rubber-band / shift-clic) — optionnelle :
  // les consommateurs en lecture seule (affichage in-game, aperçu) n'en ont
  // pas besoin et continuent de fonctionner sans rien changer.
  selectedIds?: string[]
  onSelectMultiple?: (_ids: string[]) => void
  readOnly?: boolean
  noBackground?: boolean
  background?: SlideBackground
  backgroundOpacity?: number
  onContextMenuEvent?: (_e: MouseEvent, _isElement: boolean) => void
  hideYoutube?: boolean
}

const CANVAS_W = 1920
const CANVAS_H = 1080
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const MARQUEE_CLICK_THRESHOLD = 4

const SlideCanvas = ({
  elements,
  onChange,
  selectedId,
  onSelect,
  selectedIds,
  onSelectMultiple,
  readOnly = false,
  noBackground = false,
  background,
  backgroundOpacity,
  onContextMenuEvent,
  hideYoutube = false,
}: SlideCanvasProps) => {
  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const multiSelected = selectedIds ?? []

  // Computed 16:9 canvas size fitted into the available space
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const fit = Math.min(width / CANVAS_W, height / CANVAS_H)

        setCanvasSize({
          width: Math.round(CANVAS_W * fit),
          height: Math.round(CANVAS_H * fit),
        })
      }
    })

    if (outerRef.current) {
      observer.observe(outerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // `fitScale` ajuste le canvas 1920×1080 à l'espace dispo ; `zoom` est le
  // niveau de zoom utilisateur (Ctrl+molette) par-dessus. `scale` (le produit
  // des deux) reste le nom utilisé partout ailleurs dans ce fichier pour les
  // conversions écran ↔ contenu, inchangé en dehors de sa définition.
  const fitScale = canvasSize.width / CANVAS_W
  const [zoom, setZoom] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const scale = fitScale * zoom

  const resetZoom = () => {
    setZoom(1)
    setStagePos({ x: 0, y: 0 })
  }

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    if (readOnly || (!e.evt.ctrlKey && !e.evt.metaKey)) {
      return
    }

    e.evt.preventDefault()

    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()

    if (!pointer) {
      return
    }

    const oldScale = fitScale * zoom
    const contentX = (pointer.x - stagePos.x) / oldScale
    const contentY = (pointer.y - stagePos.y) / oldScale

    const scaleBy = 1.05
    const rawZoom = e.evt.deltaY > 0 ? zoom / scaleBy : zoom * scaleBy
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rawZoom))
    const newScale = fitScale * newZoom

    setZoom(newZoom)
    setStagePos({
      x: pointer.x - contentX * newScale,
      y: pointer.y - contentY * newScale,
    })
  }

  // Espace maintenu = mode pan (glisser le calque). Désactivé si le focus est
  // dans un champ texte, même garde que les autres raccourcis de l'éditeur.
  useEffect(() => {
    if (readOnly) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") {
        return
      }

      const target = e.target as HTMLElement | null
      const tag = target?.tagName.toLowerCase()

      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        return
      }

      e.preventDefault()
      setIsSpacePressed(true)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [readOnly])

  const checkDeselect = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage()

    if (clickedOnEmpty) {
      applySelectionResult([])
    }
  }

  // ─── Sélection (simple + multiple) ─────────────────────────────────────────

  const applySelectionResult = (ids: string[]) => {
    if (ids.length >= 2) {
      onSelectMultiple?.(ids)
      onSelect(undefined)
    } else if (ids.length === 1) {
      onSelectMultiple?.([])
      onSelect(ids[0])
    } else {
      onSelectMultiple?.([])
      onSelect(undefined)
    }
  }

  const handleElementClick = (e: KonvaEventObject<MouseEvent>, id: string) => {
    if (e.evt.shiftKey) {
      const current = multiSelected.length
        ? multiSelected
        : selectedId
          ? [selectedId]
          : []
      const next = current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id]

      applySelectionResult(next)

      return
    }

    applySelectionResult([id])
  }

  const handleElementTap = (id: string) => {
    applySelectionResult([id])
  }

  useEffect(() => {
    const stage = transformerRef.current?.getStage()

    if (!transformerRef.current || !stage) {
      return
    }

    const idsForTransform =
      multiSelected.length >= 2
        ? multiSelected
        : selectedId
          ? [selectedId]
          : []

    const nodes = idsForTransform
      .map((id) => {
        const node = stage.findOne(`#${id}`)
        const el = elements.find((element) => element.id === id)

        return node && !el?.isLocked ? node : null
      })
      .filter((node): node is Konva.Node => node !== null)

    transformerRef.current.nodes(nodes)
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedId, multiSelected, elements])

  // ─── Rubber-band (rectangle de sélection) ──────────────────────────────────

  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const marqueeRectRef = useRef<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [marquee, setMarquee] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [isMarqueeTracking, setIsMarqueeTracking] = useState(false)
  const finalizeMarqueeRef = useRef<() => void>(() => {})

  useEffect(() => {
    finalizeMarqueeRef.current = () => {
      const rect = marqueeRectRef.current
      marqueeStartRef.current = null
      marqueeRectRef.current = null
      setIsMarqueeTracking(false)
      setMarquee(null)

      if (!rect) {
        return
      }

      if (
        rect.width < MARQUEE_CLICK_THRESHOLD &&
        rect.height < MARQUEE_CLICK_THRESHOLD
      ) {
        applySelectionResult([])

        return
      }

      const rectX = (rect.x - stagePos.x) / scale
      const rectY = (rect.y - stagePos.y) / scale
      const rectW = rect.width / scale
      const rectH = rect.height / scale

      const matched = elements
        .filter((el) => !el.isLocked)
        .filter((el) => {
          const left = el.x
          const right = el.x + el.width
          const top = el.y
          const bottom = el.y + el.height

          return (
            left < rectX + rectW &&
            right > rectX &&
            top < rectY + rectH &&
            bottom > rectY
          )
        })
        .map((el) => el.id)

      applySelectionResult(matched)
    }
  })

  useEffect(() => {
    if (!isMarqueeTracking) {
      return
    }

    const handleWindowMouseUp = () => finalizeMarqueeRef.current()

    window.addEventListener("mouseup", handleWindowMouseUp)

    return () => window.removeEventListener("mouseup", handleWindowMouseUp)
  }, [isMarqueeTracking])

  const handleStageMouseDown = (
    e: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    if (e.target === e.target.getStage() || e.target.id() !== editingId) {
      setEditingId(undefined)
    }

    if (readOnly || isSpacePressed) {
      return
    }

    const clickedOnEmpty = e.target === e.target.getStage()

    if (!clickedOnEmpty) {
      return
    }

    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()

    if (!pointer) {
      return
    }

    marqueeStartRef.current = pointer
    marqueeRectRef.current = { x: pointer.x, y: pointer.y, width: 0, height: 0 }
    setIsMarqueeTracking(true)
    setMarquee(marqueeRectRef.current)
  }

  const handleStageMouseMove = () => {
    if (!marqueeStartRef.current) {
      return
    }

    const stage = stageRef.current
    const pointer = stage?.getPointerPosition()

    if (!pointer) {
      return
    }

    const start = marqueeStartRef.current
    const rect = {
      x: Math.min(start.x, pointer.x),
      y: Math.min(start.y, pointer.y),
      width: Math.abs(pointer.x - start.x),
      height: Math.abs(pointer.y - start.y),
    }

    marqueeRectRef.current = rect
    setMarquee(rect)
  }

  const [guideLines, setGuideLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([])
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  )

  const handleDragStart = (_e: KonvaEventObject<DragEvent>, dragId: string) => {
    if (readOnly) return

    if (multiSelected.length >= 2 && multiSelected.includes(dragId)) {
      const positions = new Map<string, { x: number; y: number }>()

      multiSelected.forEach((id) => {
        const el = elements.find((element) => element.id === id)

        if (el) {
          positions.set(id, { x: el.x, y: el.y })
        }
      })

      dragStartPositionsRef.current = positions
    }
  }

  const handleDragMove = (e: KonvaEventObject<DragEvent>, dragId: string) => {
    if (readOnly) return

    // Déplacement groupé : applique le même delta à tous les autres éléments
    // sélectionnés, sans passer par la logique de snap (pensée pour un seul
    // élément à la fois).
    if (
      multiSelected.length >= 2 &&
      multiSelected.includes(dragId) &&
      dragStartPositionsRef.current.has(dragId)
    ) {
      const dragNode = e.target
      const start = dragStartPositionsRef.current.get(dragId)!
      const deltaX = dragNode.x() - start.x
      const deltaY = dragNode.y() - start.y
      const stage = stageRef.current

      multiSelected.forEach((id) => {
        if (id === dragId || !stage) return

        const otherStart = dragStartPositionsRef.current.get(id)

        if (!otherStart) return

        const node = stage.findOne(`#${id}`)

        if (node) {
          node.x(otherStart.x + deltaX)
          node.y(otherStart.y + deltaY)
        }
      })

      return
    }

    const dragNode = e.target
    const dragWidth = dragNode.width() * dragNode.scaleX()
    const dragHeight = dragNode.height() * dragNode.scaleY()

    const dragLeft = dragNode.x()
    const dragRight = dragLeft + dragWidth
    const dragCenterX = dragLeft + dragWidth / 2
    const dragTop = dragNode.y()
    const dragBottom = dragTop + dragHeight
    const dragCenterY = dragTop + dragHeight / 2

    const snapThreshold = 8
    let snapX: number | null = null
    let snapY: number | null = null
    const newGuides: typeof guideLines = []

    const vLines = [
      { coord: 0, type: "left" },
      { coord: CANVAS_W / 2, type: "center" },
      { coord: CANVAS_W, type: "right" }
    ]
    const hLines = [
      { coord: 0, type: "top" },
      { coord: CANVAS_H / 2, type: "center" },
      { coord: CANVAS_H, type: "bottom" }
    ]

    elements.forEach((el) => {
      if (el.id === dragId) return

      const left = el.x
      const right = el.x + el.width
      const centerX = el.x + el.width / 2
      const top = el.y
      const bottom = el.y + el.height
      const centerY = el.y + el.height / 2

      vLines.push({ coord: left, type: "left" })
      vLines.push({ coord: centerX, type: "center" })
      vLines.push({ coord: right, type: "right" })

      hLines.push({ coord: top, type: "top" })
      hLines.push({ coord: centerY, type: "center" })
      hLines.push({ coord: bottom, type: "bottom" })
    })

    let minDiffX = snapThreshold
    vLines.forEach((line) => {
      const positions = [
        { val: dragLeft, offset: 0 },
        { val: dragCenterX, offset: -dragWidth / 2 },
        { val: dragRight, offset: -dragWidth }
      ]

      positions.forEach((pos) => {
        const diff = Math.abs(pos.val - line.coord)
        if (diff < minDiffX) {
          minDiffX = diff
          snapX = line.coord + pos.offset

          newGuides.push({
            x1: line.coord,
            y1: 0,
            x2: line.coord,
            y2: CANVAS_H,
          })
        }
      })
    })

    let minDiffY = snapThreshold
    hLines.forEach((line) => {
      const positions = [
        { val: dragTop, offset: 0 },
        { val: dragCenterY, offset: -dragHeight / 2 },
        { val: dragBottom, offset: -dragHeight }
      ]

      positions.forEach((pos) => {
        const diff = Math.abs(pos.val - line.coord)
        if (diff < minDiffY) {
          minDiffY = diff
          snapY = line.coord + pos.offset

          newGuides.push({
            x1: 0,
            y1: line.coord,
            x2: CANVAS_W,
            y2: line.coord,
          })
        }
      })
    })

    if (snapX !== null) {
      dragNode.x(snapX)
    }
    if (snapY !== null) {
      dragNode.y(snapY)
    }

    setGuideLines(newGuides)
  }

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    setGuideLines([])

    if (
      multiSelected.length >= 2 &&
      multiSelected.includes(id) &&
      dragStartPositionsRef.current.has(id)
    ) {
      const node = e.target
      const start = dragStartPositionsRef.current.get(id)!
      const deltaX = node.x() - start.x
      const deltaY = node.y() - start.y

      onChange(
        elements.map((el) => {
          if (!multiSelected.includes(el.id)) return el

          const elStart = dragStartPositionsRef.current.get(el.id)

          if (!elStart) return el

          return { ...el, x: elStart.x + deltaX, y: elStart.y + deltaY }
        }),
      )

      dragStartPositionsRef.current = new Map()

      return
    }

    const node = e.target
    onChange(
      elements.map((el) =>
        el.id === id ? { ...el, x: node.x(), y: node.y() } : el,
      ),
    )
  }

  const handleTransformEnd = (e: KonvaEventObject<Event>, id: string) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    onChange(
      elements.map((el) => {
        if (el.id !== id) {
          return el
        }

        if (el.type === "text") {
          return {
            ...el,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            fontSize: el.fontSize * scaleY,
            rotation: node.rotation(),
          }
        }

        return {
          ...el,
          x: node.x(),
          y: node.y(),
          width: Math.max(5, node.width() * scaleX),
          height: Math.max(5, node.height() * scaleY),
          rotation: node.rotation(),
        }
      }),
    )
  }

  const hasBackground = Boolean(background)
  const bgImage = useSimpleImage(
    background?.type === "image" ? background.value : slideBg,
  )
  const bgColor = background?.type === "color" ? background.value : undefined
  const bgOpacity = backgroundOpacity ?? (background ? 1 : 0.5)
  const defaultBgImage = useSimpleImage("/bg-salon.png")

  const [editingId, setEditingId] = useState<string | undefined>()

  // Ref to avoid stale closures in the paste listener
  const pasteStateRef = useRef({
    elements,
    onChange,
    onSelect,
    readOnly,
    editingId: undefined as string | undefined,
  })

  useEffect(() => {
    pasteStateRef.current = {
      elements,
      onChange,
      onSelect,
      readOnly,
      editingId,
    }
  })

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const {
        elements: els,
        onChange: change,
        onSelect: select,
        readOnly: ro,
        editingId: editing,
      } = pasteStateRef.current

      if (ro || editing) {
        return
      }

      const activeTag = document.activeElement?.tagName.toLowerCase()

      if (activeTag === "input" || activeTag === "textarea") {
        return
      }

      const items = Array.from(e.clipboardData?.items ?? [])

      // Image from clipboard (screenshot, copy from browser)
      const imageItem = items.find((item) => item.type.startsWith("image/"))

      if (imageItem) {
        e.preventDefault()
        const file = imageItem.getAsFile()

        if (!file) {
          return
        }

        const localDataUrl = URL.createObjectURL(file)
        const img = new window.Image()

        img.onload = async () => {
          let width = img.naturalWidth
          let height = img.naturalHeight

          if (width > 600 || height > 600) {
            const ratio = Math.min(600 / width, 600 / height)
            width *= ratio
            height *= ratio
          }

          try {
            const uploadedUrl = await uploadImageToServer(file)
            const el = {
              ...createImageElement(uploadedUrl, width, height),
              x: CANVAS_W / 2 - width / 2,
              y: CANVAS_H / 2 - height / 2,
            }

            change([...els, el])
            select(el.id)
          } catch (err) {
            console.error("Paste image upload failed:", err)
          } finally {
            URL.revokeObjectURL(localDataUrl)
          }
        }

        img.src = localDataUrl

        return
      }

      // Plain text from clipboard
      const textItem = items.find((item) => item.type === "text/plain")

      if (textItem) {
        textItem.getAsString((text) => {
          const trimmed = text.trim()

          if (!trimmed) {
            return
          }

          const el = {
            ...createTextElement(),
            text: trimmed,
            x: CANVAS_W / 2 - 200,
            y: CANVAS_H / 2 - 50,
          }

          change([...els, el])
          select(el.id)
        })
      }
    }

    document.addEventListener("paste", handlePaste)

    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [])

  const handleTextChange = (id: string, text: string) => {
    onChange(elements.map((el) => (el.id === id ? { ...el, text } : el)))
  }

  const processDroppedFile = (file: File, dropX: number, dropY: number) => {
    const localDataUrl = URL.createObjectURL(file)
    const img = new window.Image()

    img.onload = async () => {
      let width = img.naturalWidth
      let height = img.naturalHeight

      if (width > 600 || height > 600) {
        const ratio = Math.min(600 / width, 600 / height)
        width *= ratio
        height *= ratio
      }

      try {
        const uploadedUrl = await uploadImageToServer(file)
        const el = {
          ...createImageElement(uploadedUrl, width, height),
          x: Math.max(0, dropX - width / 2),
          y: Math.max(0, dropY - height / 2),
        }

        onChange([...elements, el])
        onSelect(el.id)
      } catch (err) {
        console.error("Dropped file upload failed:", err)
      } finally {
        URL.revokeObjectURL(localDataUrl)
      }
    }

    img.src = localDataUrl
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    if (readOnly || !e.dataTransfer.types.includes("Files")) {
      return
    }

    dragCounterRef.current += 1
    setIsDraggingFile(true)
  }

  const handleDragLeave = () => {
    dragCounterRef.current -= 1

    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDraggingFile(false)

    if (readOnly) {
      return
    }

    const files = Array.from(e.dataTransfer.files).filter((f: File) =>
      f.type.startsWith("image/"),
    )

    if (!files.length) {
      return
    }

    const rect = innerRef.current?.getBoundingClientRect()
    const dropX = rect ? (e.clientX - rect.left - stagePos.x) / scale : 200
    const dropY = rect ? (e.clientY - rect.top - stagePos.y) / scale : 200

    processDroppedFile(files[0], dropX, dropY)
  }

  return (
    // Outer: fills available space, observed for size
    <div
      ref={outerRef}
      className="flex h-full w-full items-center justify-center"
    >
      {canvasSize.width > 0 && (
        // Inner: exact 16:9 dimensions, anchors all overlays
        <div
          ref={innerRef}
          className="relative"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            cursor: isSpacePressed && !readOnly ? "grab" : undefined,
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Stage
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={() => finalizeMarqueeRef.current()}
            onWheel={handleWheel}
            onTouchStart={checkDeselect}
            onContextMenu={(e) => {
              e.evt.preventDefault()
              const clickedOnEmpty = e.target === e.target.getStage()

              if (!clickedOnEmpty && e.target.id()) {
                const id = e.target.id()

                // Un clic droit sur un membre de la sélection multiple la
                // conserve intacte (pour agir sur tout le groupe) ; sur un
                // élément hors sélection, il redevient la sélection unique.
                if (!multiSelected.includes(id)) {
                  applySelectionResult([id])
                }
              } else if (clickedOnEmpty) {
                applySelectionResult([])
              }

              if (onContextMenuEvent) {
                onContextMenuEvent(e.evt, !clickedOnEmpty)
              }
            }}
            ref={stageRef}
          >
            <Layer
              ref={layerRef}
              x={stagePos.x}
              y={stagePos.y}
              scaleX={scale}
              scaleY={scale}
              draggable={!readOnly && isSpacePressed}
              onDragEnd={(e) => {
                if (e.target.getClassName() !== "Layer") return
                setStagePos({ x: e.target.x(), y: e.target.y() })
              }}
            >
              {!noBackground && (
                <>
                  {hasBackground ? (
                    <>
                      <Rect
                        width={CANVAS_W}
                        height={CANVAS_H}
                        fill="#000000"
                        listening={false}
                      />
                      {bgColor ? (
                        <Rect
                          width={CANVAS_W}
                          height={CANVAS_H}
                          fill={bgColor}
                          opacity={bgOpacity}
                          listening={false}
                        />
                      ) : (
                        <KonvaImage
                          image={bgImage || undefined}
                          width={CANVAS_W}
                          height={CANVAS_H}
                          opacity={bgOpacity}
                          listening={false}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Fond par défaut : dark base + salon à 50% */}
                      <Rect
                        width={CANVAS_W}
                        height={CANVAS_H}
                        fill="#0f172a"
                        listening={false}
                      />
                      <KonvaImage
                        image={defaultBgImage || undefined}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        opacity={0.5}
                        listening={false}
                      />
                    </>
                  )}
                </>
              )}

              {elements.map((el) => {
                if (el.type === "text") {
                  const isEditing = editingId === el.id

                  return (
                    <Text
                      key={el.id}
                      id={el.id}
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rotation={el.rotation}
                      text={isEditing ? "" : el.text}
                      fontSize={el.fontSize}
                      fontFamily={el.fontFamily}
                      fill={el.fill || "#000"}
                      align={el.align}
                      draggable={!isEditing && !el.isLocked}
                      visible={!isEditing}
                      onClick={(e) => {
                        if (selectedId === el.id && !e.evt.shiftKey) {
                          setEditingId(el.id)
                        }

                        handleElementClick(e, el.id)
                      }}
                      onDblClick={() => setEditingId(el.id)}
                      onTap={() => handleElementTap(el.id)}
                      onDragStart={(e) => handleDragStart(e, el.id)}
                      onDragMove={(e) => handleDragMove(e, el.id)}
                      onDragEnd={(e) => handleDragEnd(e, el.id)}
                      onTransformEnd={(e) => handleTransformEnd(e, el.id)}
                    />
                  )
                }

                if (el.type === "shape") {
                  const commonGroup = {
                    id: el.id,
                    x: el.x,
                    y: el.y,
                    rotation: el.rotation,
                    opacity: el.opacity,
                    width: el.width,
                    height: el.height,
                    draggable: !el.isLocked,
                    onClick: (e: KonvaEventObject<MouseEvent>) =>
                      handleElementClick(e, el.id),
                    onTap: () => handleElementTap(el.id),
                    onDragStart: (e: KonvaEventObject<DragEvent>) =>
                      handleDragStart(e, el.id),
                    onDragMove: (e: KonvaEventObject<DragEvent>) =>
                      handleDragMove(e, el.id),
                    onDragEnd: (e: KonvaEventObject<DragEvent>) =>
                      handleDragEnd(e, el.id),
                    onTransformEnd: (e: KonvaEventObject<Event>) =>
                      handleTransformEnd(e, el.id),
                  }

                  if (el.shapeType === "circle") {
                    return (
                      <Group key={el.id} {...commonGroup}>
                        <Ellipse
                          x={el.width / 2}
                          y={el.height / 2}
                          radiusX={el.width / 2}
                          radiusY={el.height / 2}
                          fill={el.fill || "#ccc"}
                        />
                      </Group>
                    )
                  }

                  if (el.shapeType === "triangle") {
                    return (
                      <Group key={el.id} {...commonGroup}>
                        <Line
                          points={[
                            el.width / 2, 0,
                            el.width, el.height,
                            0, el.height,
                          ]}
                          closed
                          fill={el.fill || "#ccc"}
                        />
                      </Group>
                    )
                  }

                  if (el.shapeType === "star") {
                    const r = Math.min(el.width, el.height) / 2

                    return (
                      <Group key={el.id} {...commonGroup}>
                        <Star
                          x={el.width / 2}
                          y={el.height / 2}
                          numPoints={5}
                          innerRadius={r / 2}
                          outerRadius={r}
                          fill={el.fill || "#ccc"}
                        />
                      </Group>
                    )
                  }

                  return (
                    <Rect
                      key={el.id}
                      id={el.id}
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rotation={el.rotation}
                      opacity={el.opacity}
                      fill={el.fill || "#ccc"}
                      cornerRadius={el.cornerRadius || 0}
                      draggable={!el.isLocked}
                      onClick={(e) => handleElementClick(e, el.id)}
                      onTap={() => handleElementTap(el.id)}
                      onDragStart={(e) => handleDragStart(e, el.id)}
                      onDragMove={(e) => handleDragMove(e, el.id)}
                      onDragEnd={(e) => handleDragEnd(e, el.id)}
                      onTransformEnd={(e) => handleTransformEnd(e, el.id)}
                    />
                  )
                }

                if (el.type === "image") {
                  const isGif =
                    el.url.toLowerCase().endsWith(".gif") ||
                    el.url.toLowerCase().includes(".gif?") ||
                    el.url.startsWith("data:image/gif")

                  if (readOnly && isGif) {
                    return null
                  }

                  return (
                    <CanvasImageElement
                      key={el.id}
                      el={el}
                      onElementClick={handleElementClick}
                      onElementTap={handleElementTap}
                      handleDragStart={handleDragStart}
                      handleDragMove={handleDragMove}
                      handleDragEnd={handleDragEnd}
                      handleTransformEnd={handleTransformEnd}
                    />
                  )
                }

                if (el.type === "youtube" && !readOnly) {
                  return (
                    <CanvasYoutubeElement
                      key={el.id}
                      el={el}
                      onElementClick={handleElementClick}
                      onElementTap={handleElementTap}
                      handleDragStart={handleDragStart}
                      handleDragMove={handleDragMove}
                      handleDragEnd={handleDragEnd}
                      handleTransformEnd={handleTransformEnd}
                    />
                  )
                }

                return null
              })}

              {guideLines.map((line, idx) => (
                <Line
                  key={idx}
                  points={[line.x1, line.y1, line.x2, line.y2]}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dash={[6, 4]}
                />
              ))}

              <Transformer ref={transformerRef} />
            </Layer>
          </Stage>

          {/* Rectangle de sélection multiple (rubber-band) */}
          {marquee && (
            <div
              className="border-primary bg-primary/10 pointer-events-none absolute z-40 border"
              style={{
                left: marquee.x,
                top: marquee.y,
                width: marquee.width,
                height: marquee.height,
              }}
            />
          )}

          {/* Indicateur de zoom + réinitialisation */}
          {!readOnly && (
            <div className="pointer-events-auto absolute right-2 bottom-2 z-40 flex items-center gap-2 rounded-lg bg-black/50 px-2 py-1 text-xs text-white backdrop-blur-sm">
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={resetZoom}
                className="rounded px-1.5 py-0.5 hover:bg-white/20"
                title="Réinitialiser le zoom"
              >
                Réinitialiser
              </button>
            </div>
          )}

          {/* Text editing overlay — positioned relative to the 16:9 inner div */}
          {!readOnly &&
            editingId &&
            (() => {
              const el = elements.find((e) => e.id === editingId)

              if (!el || el.type !== "text") {
                return null
              }

              return (
                <textarea
                  autoFocus
                  className="absolute z-50 m-0 resize-none overflow-hidden border-none bg-transparent p-0 outline-none"
                  value={el.text}
                  onChange={(e) => handleTextChange(el.id, e.target.value)}
                  onBlur={() => setEditingId(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      setEditingId(undefined)
                    }
                  }}
                  style={{
                    left: el.x * scale + stagePos.x,
                    top: el.y * scale + stagePos.y,
                    width: el.width * scale,
                    height: (el.height || 100) * scale,
                    fontSize: el.fontSize * scale,
                    fontFamily: el.fontFamily || "Arial",
                    color: el.fill || "#000",
                    textAlign: el.align,
                    transform: `rotate(${el.rotation}deg)`,
                    transformOrigin: "top left",
                    lineHeight: 1.2,
                  }}
                />
              )
            })()}

          {/* Drop zone overlay */}
          {isDraggingFile && (
            <div className="border-primary bg-primary/10 pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-4 border-dashed">
              <div className="text-primary-ink rounded-lg bg-white/90 px-6 py-3 text-base font-semibold shadow-lg">
                Déposer l'image ici
              </div>
            </div>
          )}

          {/* YouTube iframes in readOnly — positioned relative to the 16:9 inner div */}
          {readOnly &&
            !hideYoutube &&
            elements
              .filter(
                (el): el is Extract<SlideElement, { type: "youtube" }> =>
                  el.type === "youtube",
              )
              .map((el) => {
                const params = new URLSearchParams({
                  autoplay: el.autoplay ? "1" : "0",
                  mute: el.mute ? "1" : "0",
                  loop: el.loop ? "1" : "0",
                  controls: el.controls ? "1" : "0",
                  rel: "0",
                  playsinline: "1",
                })

                if (el.loop) {
                  params.set("playlist", el.videoId)
                }

                if (el.startTime) {
                  params.set("start", String(el.startTime))
                }

                if (el.endTime) {
                  params.set("end", String(el.endTime))
                }

                return (
                  <iframe
                    key={el.id}
                    src={`https://www.youtube.com/embed/${el.videoId}?${params.toString()}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute rounded-md"
                    style={{
                      left: el.x * scale + stagePos.x,
                      top: el.y * scale + stagePos.y,
                      width: el.width * scale,
                      height: el.height * scale,
                      transform: `rotate(${el.rotation}deg)`,
                      transformOrigin: "top left",
                      opacity: el.opacity,
                      pointerEvents: "auto",
                    }}
                  />
                )
              })}

          {/* GIF images in readOnly — positioned relative to the 16:9 inner div */}
          {readOnly &&
            elements
              .filter(
                (el): el is Extract<SlideElement, { type: "image" }> =>
                  el.type === "image" && (
                    el.url.toLowerCase().endsWith(".gif") ||
                    el.url.toLowerCase().includes(".gif?") ||
                    el.url.startsWith("data:image/gif")
                  ),
              )
              .map((el) => (
                <img
                  key={el.id}
                  src={el.url}
                  alt=""
                  className="absolute rounded-md pointer-events-none"
                  style={{
                    left: el.x * scale + stagePos.x,
                    top: el.y * scale + stagePos.y,
                    width: el.width * scale,
                    height: el.height * scale,
                    transform: `rotate(${el.rotation}deg)`,
                    transformOrigin: "top left",
                    opacity: el.opacity,
                  }}
                />
              ))}
        </div>
      )}
    </div>
  )
}

const useSimpleImage = (url: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    const img = new window.Image()
    img.src = url
    img.crossOrigin = "Anonymous"
    img.onload = () => setImage(img)
  }, [url])

  return image
}

const CanvasImageElement = ({
  el,
  onElementClick,
  onElementTap,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handleTransformEnd,
}: {
  el: Extract<SlideElement, { type: "image" }>
  onElementClick: (_e: KonvaEventObject<MouseEvent>, _id: string) => void
  onElementTap: (_id: string) => void
  handleDragStart: (_e: KonvaEventObject<DragEvent>, _id: string) => void
  handleDragMove: (_e: KonvaEventObject<DragEvent>, _id: string) => void
  handleDragEnd: (_e: KonvaEventObject<DragEvent>, _id: string) => void
  handleTransformEnd: (_e: KonvaEventObject<Event>, _id: string) => void
}) => {
  const image = useSimpleImage(el.url)

  return (
    <KonvaImage
      id={el.id}
      image={image || undefined}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      rotation={el.rotation}
      opacity={el.opacity}
      draggable={!el.isLocked}
      onClick={(e) => onElementClick(e, el.id)}
      onTap={() => onElementTap(el.id)}
      onDragStart={(e) => handleDragStart(e, el.id)}
      onDragMove={(e) => handleDragMove(e, el.id)}
      onDragEnd={(e) => handleDragEnd(e, el.id)}
      onTransformEnd={(e) => handleTransformEnd(e, el.id)}
    />
  )
}

const CanvasYoutubeElement = ({
  el,
  onElementClick,
  onElementTap,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handleTransformEnd,
}: {
  el: Extract<SlideElement, { type: "youtube" }>
  onElementClick: (_e: KonvaEventObject<MouseEvent>, _id: string) => void
  onElementTap: (_id: string) => void
  handleDragStart: (_e: KonvaEventObject<DragEvent>, _id: string) => void
  handleDragMove: (_e: KonvaEventObject<DragEvent>, _id: string) => void
  handleDragEnd: (_e: KonvaEventObject<DragEvent>, _id: string) => void
  handleTransformEnd: (_e: KonvaEventObject<Event>, _id: string) => void
}) => {
  const image = useSimpleImage(
    `https://img.youtube.com/vi/${el.videoId}/hqdefault.jpg`,
  )

  return (
    <Group
      id={el.id}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      rotation={el.rotation}
      draggable={!el.isLocked}
      onClick={(e) => onElementClick(e, el.id)}
      onTap={() => onElementTap(el.id)}
      onDragStart={(e) => handleDragStart(e, el.id)}
      onDragMove={(e) => handleDragMove(e, el.id)}
      onDragEnd={(e) => handleDragEnd(e, el.id)}
      onTransformEnd={(e) => handleTransformEnd(e, el.id)}
    >
      <Rect width={el.width} height={el.height} fill="#000" cornerRadius={8} />
      {image && (
        <KonvaImage
          image={image}
          width={el.width}
          height={el.height}
          opacity={0.8}
        />
      )}
      <Rect
        x={el.width / 2 - 30}
        y={el.height / 2 - 20}
        width={60}
        height={40}
        fill="#ff0000"
        cornerRadius={8}
      />
      <Text
        text="▶"
        fill="#ffffff"
        fontSize={24}
        x={el.width / 2 - 10}
        y={el.height / 2 - 12}
      />
    </Group>
  )
}

export default SlideCanvas
