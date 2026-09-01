import type {
  DropPinPoint,
  DropPinShape,
  DropPinZone,
} from "@rahoot/common/types/game"
import {
  polygonPath,
  zoneBounds,
  zoneCenter,
} from "@rahoot/common/utils/drop-pin"
import {
  MIN_ZONE_SIZE,
  resizeZone,
  translateZone,
  zoneColor,
  zoneFromDrag,
  zoneFromPoints,
} from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDropPin/shapes"
import clsx from "clsx"
import React, { useEffect, useRef, useState } from "react"

export type DrawTool = DropPinShape | "select"

type Props = {
  pinImage: string
  zones: DropPinZone[]
  tool: DrawTool
  selectedZoneId: string | null
  onSelectZone: (_id: string | null) => void
  onZonesChange: (_zones: DropPinZone[]) => void
  onZoneDrawn: () => void
}

// Geste en cours : tracé d'une nouvelle zone, déplacement ou redimensionnement
// d'une zone existante. `null` = rien en cours.
type Gesture =
  | { kind: "draw"; start: DropPinPoint; current: DropPinPoint }
  | { kind: "move"; zoneId: string; last: DropPinPoint }
  | { kind: "resize"; zoneId: string }
  | null

const ZoneCanvas = ({
  pinImage,
  zones,
  tool,
  selectedZoneId,
  onSelectZone,
  onZonesChange,
  onZoneDrawn,
}: Props) => {
  const imgRef = useRef<HTMLImageElement>(null)
  const [gesture, setGesture] = useState<Gesture>(null)
  // Sommets déjà posés du polygone en cours, plus la position du curseur pour
  // l'aperçu du segment suivant.
  const [draftPoints, setDraftPoints] = useState<DropPinPoint[]>([])
  const [hoverPoint, setHoverPoint] = useState<DropPinPoint | null>(null)

  // Changer d'outil abandonne le tracé en cours : sinon un polygone à moitié
  // posé réapparaîtrait au retour sur l'outil.
  useEffect(() => {
    setDraftPoints([])
    setGesture(null)
  }, [tool])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraftPoints([])
        setGesture(null)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const pointAt = (clientX: number, clientY: number): DropPinPoint | null => {
    const rect = imgRef.current?.getBoundingClientRect()

    if (!rect || rect.width === 0 || rect.height === 0) {
      return null
    }

    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  const nextLabel = () => `Zone ${zones.length + 1}`

  const commitPolygon = (points: DropPinPoint[]) => {
    if (points.length >= 3) {
      onZonesChange([...zones, zoneFromPoints(points, nextLabel())])
      onZoneDrawn()
    }

    setDraftPoints([])
    setHoverPoint(null)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const point = pointAt(e.clientX, e.clientY)

    if (!point) {
      return
    }

    if (tool === "select") {
      // Clic dans le vide : on désélectionne.
      if (!(e.target as HTMLElement).closest("[data-zone-shape]")) {
        onSelectZone(null)
      }

      return
    }

    if (tool === "polygon") {
      const [first] = draftPoints

      // Reclic sur le premier sommet = fermeture du tracé.
      if (
        first &&
        draftPoints.length >= 3 &&
        Math.hypot(point.x - first.x, point.y - first.y) < 3
      ) {
        commitPolygon(draftPoints)

        return
      }

      setDraftPoints([...draftPoints, point])

      return
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    setGesture({ kind: "draw", start: point, current: point })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const point = pointAt(e.clientX, e.clientY)

    if (!point) {
      return
    }

    if (tool === "polygon" && draftPoints.length > 0) {
      setHoverPoint(point)

      return
    }

    if (!gesture) {
      return
    }

    if (gesture.kind === "draw") {
      setGesture({ ...gesture, current: point })

      return
    }

    if (gesture.kind === "move") {
      const dx = point.x - gesture.last.x
      const dy = point.y - gesture.last.y

      onZonesChange(
        zones.map((z) =>
          z.id === gesture.zoneId ? translateZone(z, dx, dy) : z,
        ),
      )
      setGesture({ ...gesture, last: point })

      return
    }

    onZonesChange(
      zones.map((z) =>
        z.id === gesture.zoneId ? resizeZone(z, point.x, point.y) : z,
      ),
    )
  }

  const handlePointerUp = () => {
    if (gesture?.kind === "draw" && (tool === "rect" || tool === "ellipse")) {
      const { start, current } = gesture

      if (
        Math.abs(current.x - start.x) >= MIN_ZONE_SIZE &&
        Math.abs(current.y - start.y) >= MIN_ZONE_SIZE
      ) {
        onZonesChange([
          ...zones,
          zoneFromDrag(tool, start, current, nextLabel()),
        ])
        onZoneDrawn()
      }
    }

    setGesture(null)
  }

  const startMove = (zoneId: string) => (e: React.PointerEvent<SVGElement>) => {
    onSelectZone(zoneId)

    if (tool !== "select") {
      return
    }

    const point = pointAt(e.clientX, e.clientY)

    if (point) {
      e.stopPropagation()
      setGesture({ kind: "move", zoneId, last: point })
    }
  }

  const startResize =
    (zoneId: string) => (e: React.PointerEvent<SVGElement>) => {
      e.stopPropagation()
      setGesture({ kind: "resize", zoneId })
    }

  const draftPreview = () => {
    if (gesture?.kind === "draw" && tool !== "select" && tool !== "polygon") {
      const preview = zoneFromDrag(tool, gesture.start, gesture.current, "")

      return tool === "rect" ? (
        <rect
          x={preview.x}
          y={preview.y}
          width={preview.width}
          height={preview.height}
          className="fill-white/20 stroke-white"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <ellipse
          cx={preview.x + preview.width / 2}
          cy={preview.y + preview.height / 2}
          rx={preview.width / 2}
          ry={preview.height / 2}
          className="fill-white/20 stroke-white"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
        />
      )
    }

    if (tool === "polygon" && draftPoints.length > 0) {
      const path = [...draftPoints, ...(hoverPoint ? [hoverPoint] : [])]

      return (
        <>
          <polyline
            points={path.map((p) => `${p.x},${p.y}`).join(" ")}
            className="fill-white/10 stroke-white"
            strokeWidth={1.5}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
          {draftPoints.map((p, i) => (
            <circle
              key={`${p.x}-${p.y}-${i}`}
              cx={p.x}
              cy={p.y}
              r={0.9}
              className={clsx(
                "stroke-white",
                i === 0 ? "fill-emerald-400" : "fill-white",
              )}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </>
      )
    }

    return null
  }

  const renderZone = (zone: DropPinZone, index: number) => {
    const color = zoneColor(index)
    const isSelected = selectedZoneId === zone.id
    const bounds = zoneBounds(zone)
    const center = zoneCenter(zone)
    const common = {
      "data-zone-shape": true,
      fill: color,
      fillOpacity: isSelected ? 0.4 : 0.25,
      stroke: color,
      strokeWidth: isSelected ? 2.5 : 1.5,
      strokeDasharray: zone.isCorrect ? undefined : "4 3",
      vectorEffect: "non-scaling-stroke" as const,
      onPointerDown: startMove(zone.id),
      className: clsx(tool === "select" ? "cursor-move" : "cursor-crosshair"),
    }

    return (
      <g key={zone.id}>
        {zone.shape === "polygon" && zone.points ? (
          <path d={polygonPath(zone.points)} {...common} />
        ) : null}

        {zone.shape === "rect" ? (
          <rect
            x={zone.x}
            y={zone.y}
            width={zone.width}
            height={zone.height}
            {...common}
          />
        ) : null}

        {zone.shape === "ellipse" || !zone.shape ? (
          <ellipse
            cx={center.x}
            cy={center.y}
            rx={bounds.width / 2}
            ry={bounds.height / 2}
            {...common}
          />
        ) : null}

        {isSelected &&
          tool === "select" &&
          (zone.shape === "rect" || zone.shape === "ellipse") && (
            <circle
              cx={zone.x + zone.width}
              cy={zone.y + zone.height}
              r={1.2}
              fill="#fff"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="cursor-nwse-resize"
              onPointerDown={startResize(zone.id)}
            />
          )}

        <text
          x={center.x}
          y={center.y}
          textAnchor="middle"
          dominantBaseline="central"
          className="pointer-events-none select-none"
          style={{
            fill: "#fff",
            fontSize: 3.2,
            fontWeight: 800,
            paintOrder: "stroke",
            stroke: "rgba(0,0,0,0.65)",
            strokeWidth: 0.9,
          }}
        >
          {index + 1}
        </text>
      </g>
    )
  }

  return (
    <div
      className="relative flex min-h-0 w-full flex-1 touch-none items-center justify-center overflow-hidden rounded-3xl border border-white/5 bg-black/40 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] select-none"
      onDoubleClick={() => tool === "polygon" && commitPolygon(draftPoints)}
    >
      {zones.length === 0 && draftPoints.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-6">
          <div className="rounded-2xl border border-white/10 bg-black/70 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">
            {tool === "polygon"
              ? "Cliquez pour poser les sommets, double-cliquez pour fermer"
              : "Glissez sur l'image pour tracer une zone"}
          </div>
        </div>
      )}

      <div
        className="relative inline-block max-h-full max-w-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={pinImage}
          alt="Image cible"
          className="block h-auto max-h-[65vh] w-auto max-w-full rounded-xl object-contain select-none"
          draggable={false}
        />

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={clsx(
            "absolute inset-0 h-full w-full",
            tool === "select" ? "cursor-default" : "cursor-crosshair",
          )}
        >
          {zones.map(renderZone)}
          {draftPreview()}
        </svg>
      </div>
    </div>
  )
}

export default ZoneCanvas
