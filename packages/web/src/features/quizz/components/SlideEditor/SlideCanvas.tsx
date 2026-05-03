import { type SlideElement } from "@rahoot/common/types/game"
import { useRef, useState, useEffect } from "react"
import { Stage, Layer, Text, Rect, Transformer, Group, Image as KonvaImage } from "react-konva"

type SlideCanvasProps = {
  elements: SlideElement[]
  onChange: (_elements: SlideElement[]) => void
  selectedId?: string
  onSelect: (_id: string | undefined) => void
  readOnly?: boolean
}

const SlideCanvas = ({ elements, onChange, selectedId, onSelect, readOnly = false }: SlideCanvasProps) => {
  const stageRef = useRef<any>(null)
  const transformerRef = useRef<any>(null)

  const checkDeselect = (e: any) => {
    // Deselect when clicked on empty area
    const clickedOnEmpty = e.target === e.target.getStage()

    if (clickedOnEmpty) {
      onSelect(undefined)
    }
  }

  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const stage = transformerRef.current.getStage()
      const selectedNode = stage.findOne(`#${selectedId}`)

      if (selectedNode) {
        transformerRef.current.nodes([selectedNode])
        transformerRef.current.getLayer().batchDraw()
      } else {
        transformerRef.current.nodes([])
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([])
    }
  }, [selectedId, elements])

  const handleDragEnd = (e: any, id: string) => {
    const node = e.target
    const newElements = elements.map((el) => {
      if (el.id === id) {
        return {
          ...el,
          x: node.x(),
          y: node.y(),
        }
      }

      
return el
    })
    onChange(newElements)
  }

  const handleTransformEnd = (e: any, id: string) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()

    // Reset scale to 1 and update width/height
    node.scaleX(1)
    node.scaleY(1)

    const newElements = elements.map((el) => {
      if (el.id === id) {
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
      }

      
return el
    })
    onChange(newElements)
  }

  // Calculate scaling to fit 1920x1080 into whatever the container size is.
  // We'll fix it to a 16:9 ratio in the parent component.
  // For simplicity, let's assume Stage width and height are provided by parent or we just use a fixed internal coordinate system and let CSS handle scaling if possible.
  // Actually, Konva doesn't auto-scale via CSS nicely, we need to listen to resize. Let's start with a fixed internal size 1920x1080 and scale it down.
  const [size, setSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setSize({ width, height })
      }
    }

    checkSize()
    window.addEventListener("resize", checkSize)

    
return () => window.removeEventListener("resize", checkSize)
  }, [])

  const scale = Math.min(size.width / 1920, size.height / 1080)
  const offsetX = (size.width - 1920 * scale) / 2
  const offsetY = (size.height - 1080 * scale) / 2

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {size.width > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          onMouseDown={checkDeselect}
          onTouchStart={checkDeselect}
          ref={stageRef}
        >
          <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
            {elements.map((el) => {
              if (el.type === "text") {
                return (
                  <Text
                    key={el.id}
                    id={el.id}
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    rotation={el.rotation}
                    text={el.text}
                    fontSize={el.fontSize}
                    fontFamily={el.fontFamily}
                    fill={el.fill || "#000"}
                    align={el.align}
                    draggable
                    onClick={() => onSelect(el.id)}
                    onTap={() => onSelect(el.id)}
                    onDragEnd={(e) => handleDragEnd(e, el.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, el.id)}
                  />
                )
              }

              if (el.type === "shape") {
                if (el.shapeType === "rect") {
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

              if (el.type === "youtube") {
                if (readOnly) {
                  return null
                }

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
      )}

      {readOnly &&
        size.width > 0 &&
        elements
          .filter((el): el is Extract<SlideElement, { type: "youtube" }> => el.type === "youtube")
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
                  left: offsetX + el.x * scale,
                  top: offsetY + el.y * scale,
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

const CanvasImageElement = ({ el, onSelect, handleDragEnd, handleTransformEnd }: any) => {
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

const CanvasYoutubeElement = ({ el, onSelect, handleDragEnd, handleTransformEnd }: any) => {
  const thumbnailUrl = `https://img.youtube.com/vi/${el.videoId}/hqdefault.jpg`
  const image = useSimpleImage(thumbnailUrl)
  
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
      <Rect
        width={el.width}
        height={el.height}
        fill="#000"
        cornerRadius={8}
      />
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
