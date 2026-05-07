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
import {
  Stage,
  Layer,
  Text,
  Rect,
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
  readOnly?: boolean
  noBackground?: boolean
  background?: SlideBackground
  backgroundOpacity?: number
  onContextMenuEvent?: (_e: MouseEvent, _isElement: boolean) => void
}

const CANVAS_W = 1920
const CANVAS_H = 1080

const SlideCanvas = ({
  elements,
  onChange,
  selectedId,
  onSelect,
  readOnly = false,
  noBackground = false,
  background,
  backgroundOpacity,
  onContextMenuEvent,
}: SlideCanvasProps) => {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Computed 16:9 canvas size fitted into the available space
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const scale = Math.min(width / CANVAS_W, height / CANVAS_H)

        setCanvasSize({
          width: Math.round(CANVAS_W * scale),
          height: Math.round(CANVAS_H * scale),
        })
      }
    })
    if (outerRef.current) observer.observe(outerRef.current)
    return () => observer.disconnect()
  }, [])

  const scale = canvasSize.width / CANVAS_W

  const checkDeselect = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage()
    if (clickedOnEmpty) onSelect(undefined)
  }

  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const stage = transformerRef.current.getStage()

      if (!stage) {
        return
      }

      const selectedNode = stage.findOne(`#${selectedId}`)

      if (selectedNode) {
        transformerRef.current.nodes([selectedNode])
        transformerRef.current.getLayer()?.batchDraw()
      } else {
        transformerRef.current.nodes([])
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([])
    }
  }, [selectedId, elements])

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
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
        if (el.id !== id) return el
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

  const hasBackground = !!background
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

        const reader = new FileReader()

        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string

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

            const el = {
              ...createImageElement(dataUrl, width, height),
              x: CANVAS_W / 2 - width / 2,
              y: CANVAS_H / 2 - height / 2,
            }

            change([...els, el])
            select(el.id)
          }

          img.src = dataUrl
        }

        reader.readAsDataURL(file)

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
    const reader = new FileReader()

    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string

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

        const el = {
          ...createImageElement(dataUrl, width, height),
          x: Math.max(0, dropX - width / 2),
          y: Math.max(0, dropY - height / 2),
        }

        onChange([...elements, el])
        onSelect(el.id)
      }

      img.src = dataUrl
    }

    reader.readAsDataURL(file)
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
    const dropX = rect ? (e.clientX - rect.left) / scale : 200
    const dropY = rect ? (e.clientY - rect.top) / scale : 200

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
          style={{ width: canvasSize.width, height: canvasSize.height }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Stage
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={(e) => {
              checkDeselect(e)
              if (
                e.target === e.target.getStage() ||
                e.target.id() !== editingId
              ) {
                setEditingId(undefined)
              }
            }}
            onTouchStart={checkDeselect}
            onContextMenu={(e) => {
              e.evt.preventDefault()
              const clickedOnEmpty = e.target === e.target.getStage()
              if (!clickedOnEmpty && e.target.id()) onSelect(e.target.id())
              else if (clickedOnEmpty) onSelect(undefined)
              if (onContextMenuEvent) onContextMenuEvent(e.evt, !clickedOnEmpty)
            }}
            ref={stageRef}
          >
            <Layer scaleX={scale} scaleY={scale}>
              {!noBackground && (
                <>
                  {hasBackground ? (
                    <>
                      <Rect width={CANVAS_W} height={CANVAS_H} fill="#000000" />
                      {bgColor ? (
                        <Rect
                          width={CANVAS_W}
                          height={CANVAS_H}
                          fill={bgColor}
                          opacity={bgOpacity}
                        />
                      ) : (
                        <KonvaImage
                          image={bgImage || undefined}
                          width={CANVAS_W}
                          height={CANVAS_H}
                          opacity={bgOpacity}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Fond par défaut : dark base + salon à 50% */}
                      <Rect width={CANVAS_W} height={CANVAS_H} fill="#0f172a" />
                      <KonvaImage
                        image={defaultBgImage || undefined}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        opacity={0.5}
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
                      draggable={!isEditing}
                      visible={!isEditing}
                      onClick={() => {
                        if (selectedId === el.id) setEditingId(el.id)
                        onSelect(el.id)
                      }}
                      onDblClick={() => setEditingId(el.id)}
                      onTap={() => onSelect(el.id)}
                      onDragEnd={(e) => handleDragEnd(e, el.id)}
                      onTransformEnd={(e) => handleTransformEnd(e, el.id)}
                    />
                  )
                }

                if (el.type === "shape" && el.shapeType === "rect") {
                  return (
                    <Rect
                      key={el.id}
                      id={el.id}
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rotation={el.rotation}
                      fill={el.fill || "#ccc"}
                      draggable
                      onClick={() => onSelect(el.id)}
                      onTap={() => onSelect(el.id)}
                      onDragEnd={(e) => handleDragEnd(e, el.id)}
                      onTransformEnd={(e) => handleTransformEnd(e, el.id)}
                    />
                  )
                }

                if (el.type === "image") {
                  return (
                    <CanvasImageElement
                      key={el.id}
                      el={el}
                      onSelect={onSelect}
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
                      onSelect={onSelect}
                      handleDragEnd={handleDragEnd}
                      handleTransformEnd={handleTransformEnd}
                    />
                  )
                }

                return null
              })}

              <Transformer ref={transformerRef} />
            </Layer>
          </Stage>

          {/* Text editing overlay — positioned relative to the 16:9 inner div */}
          {!readOnly &&
            editingId &&
            (() => {
              const el = elements.find((e) => e.id === editingId)
              if (!el || el.type !== "text") return null
              return (
                <textarea
                  autoFocus
                  className="absolute z-50 m-0 resize-none overflow-hidden border-none bg-transparent p-0 outline-none"
                  value={el.text}
                  onChange={(e) => handleTextChange(el.id, e.target.value)}
                  onBlur={() => setEditingId(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey)
                      setEditingId(undefined)
                  }}
                  style={{
                    left: el.x * scale,
                    top: el.y * scale,
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
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-4 border-dashed border-blue-400 bg-blue-400/10">
              <div className="rounded-lg bg-white/90 px-6 py-3 text-base font-semibold text-blue-600 shadow-lg">
                Déposer l'image ici
              </div>
            </div>
          )}

          {/* YouTube iframes in readOnly — positioned relative to the 16:9 inner div */}
          {readOnly &&
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
                if (el.loop) params.set("playlist", el.videoId)
                if (el.startTime) params.set("start", String(el.startTime))
                if (el.endTime) params.set("end", String(el.endTime))
                return (
                  <iframe
                    key={el.id}
                    src={`https://www.youtube.com/embed/${el.videoId}?${params.toString()}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute rounded-md"
                    style={{
                      left: el.x * scale,
                      top: el.y * scale,
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
  onSelect,
  handleDragEnd,
  handleTransformEnd,
}: {
  el: Extract<SlideElement, { type: "image" }>
  onSelect: (_id: string) => void
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
      draggable
      onClick={() => onSelect(el.id)}
      onTap={() => onSelect(el.id)}
      onDragEnd={(e) => handleDragEnd(e, el.id)}
      onTransformEnd={(e) => handleTransformEnd(e, el.id)}
    />
  )
}

const CanvasYoutubeElement = ({
  el,
  onSelect,
  handleDragEnd,
  handleTransformEnd,
}: {
  el: Extract<SlideElement, { type: "youtube" }>
  onSelect: (_id: string) => void
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
      draggable
      onClick={() => onSelect(el.id)}
      onTap={() => onSelect(el.id)}
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
