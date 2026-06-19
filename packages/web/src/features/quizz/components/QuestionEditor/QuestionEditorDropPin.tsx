import type { DropPinQuestion, DropPinZone } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { generateId } from "@rahoot/web/features/quizz/utils/id"
import clsx from "clsx"
import {
  Check,
  Crosshair,
  ImagePlus,
  MapPin,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"
import React, { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type DropPinWithId = DropPinQuestion & { id: string }

const ZONE_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
]

const zoneColor = (index: number) => ZONE_COLORS[index % ZONE_COLORS.length]

const QuestionEditorDropPin = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as DropPinWithId
  const zones = q.zones ?? []

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [draggedZoneId, setDraggedZoneId] = useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

  const handleFileUpload = async (file: File) => {
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
        headers: { "x-client-id": localStorage.getItem("client_id") ?? "" },
      })

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const data = (await res.json()) as { url: string }
      updateQuestion(currentIndex, { pinImage: data.url, zones: [] })
    } catch {
      toast.error(t("errors:upload.failed"))
    } finally {
      setUploading(false)
    }
  }

  const updateZones = (next: DropPinZone[]) => {
    updateQuestion(currentIndex, { zones: next })
  }

  const computePct = (clientX: number, clientY: number) => {
    if (!imgRef.current) {
      return null
    }

    const rect = imgRef.current.getBoundingClientRect()
    const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))

    return { x: parseFloat(xPct.toFixed(1)), y: parseFloat(yPct.toFixed(1)) }
  }

  const handleImageClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggedZoneId) {
      setDraggedZoneId(null)

      return
    }

    const target = e.target as HTMLElement

    if (target.closest("[data-zone-marker]")) {
      return
    }

    const pos = computePct(e.clientX, e.clientY)

    if (!pos) {
      return
    }

    const newZone: DropPinZone = {
      id: generateId(),
      x: pos.x,
      y: pos.y,
      width: 5,
      height: 5,
      label: `Zone ${zones.length + 1}`,
      isCorrect: true,
    }

    updateZones([...zones, newZone])
    setSelectedZoneId(newZone.id)
  }

  const handleZonePointerDown =
    (zoneId: string) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      setDraggedZoneId(zoneId)
      setSelectedZoneId(zoneId)
    }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggedZoneId) {
      return
    }

    const pos = computePct(e.clientX, e.clientY)

    if (!pos) {
      return
    }

    updateZones(
      zones.map((z) => (z.id === draggedZoneId ? { ...z, x: pos.x, y: pos.y } : z)),
    )
  }

  const handlePointerUp = () => {
    if (draggedZoneId) {
      // Defer so the click handler can skip
      setTimeout(() => setDraggedZoneId(null), 0)
    }
  }

  const updateZone = (zoneId: string, patch: Partial<DropPinZone>) => {
    updateZones(zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z)))
  }

  const removeZone = (zoneId: string) => {
    updateZones(zones.filter((z) => z.id !== zoneId))

    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null)
    }
  }

  const clearAllZones = () => {
    updateZones([])
    setSelectedZoneId(null)
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex min-h-0 w-full flex-1 flex-col gap-4 duration-500">
      {!q.pinImage && (
        <div
          className={clsx(
            "group flex min-h-[50vh] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300",
            isDraggingFile
              ? "scale-[0.98] border-purple-500 bg-purple-500/10"
              : "border-white/20 bg-black/20 hover:border-white/40 hover:bg-black/40",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDraggingFile(true)
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDraggingFile(false)
            const file = e.dataTransfer.files?.[0]

            if (file) {
              void handleFileUpload(file)
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]

              if (file) {
                void handleFileUpload(file)
              }

              e.target.value = ""
            }}
          />
          <div className="z-10 flex flex-col items-center gap-6 p-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-500 opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm transition-transform duration-500 group-hover:scale-110">
                <UploadCloud
                  className={clsx(
                    "h-12 w-12 transition-colors duration-500",
                    isDraggingFile
                      ? "text-purple-400"
                      : "text-white/60 group-hover:text-white",
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-white">
                {uploading
                  ? "Création de la magie..."
                  : "Glissez l'image cible ici"}
              </h3>
              <p className="mx-auto max-w-md text-base text-white/50">
                Ou cliquez pour parcourir. Choisissez une image sur laquelle vos
                joueurs devront placer leur épingle.
              </p>
            </div>
          </div>
        </div>
      )}

      {q.pinImage && (
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Image + zones */}
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {/* Toolbar */}
            <div className="flex shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-5 py-3 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="border-primary/30 bg-primary/20 flex h-10 w-10 items-center justify-center rounded-xl border">
                  <Crosshair className="text-primary h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base leading-tight font-bold text-white">
                    {zones.length === 0
                      ? "Définissez vos cibles"
                      : `${zones.length} zone${zones.length > 1 ? "s" : ""} définie${zones.length > 1 ? "s" : ""}`}
                  </h4>
                  <p className="mt-0.5 text-xs text-white/60">
                    Cliquez sur l'image pour ajouter une zone. Glissez pour déplacer.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {zones.length > 0 && (
                  <button
                    onClick={clearAllZones}
                    className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition-all hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Tout effacer
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-white/15"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Changer l'image
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]

                if (file) {
                  void handleFileUpload(file)
                }

                e.target.value = ""
              }}
            />

            {/* Canvas image */}
            <div
              className="relative flex min-h-0 w-full flex-1 cursor-crosshair touch-none items-center justify-center overflow-hidden rounded-3xl border border-white/5 bg-black/40 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] select-none"
              onPointerDown={handleImageClick}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {zones.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-6 py-4 text-lg font-bold text-white shadow-2xl backdrop-blur-xl">
                    <MapPin className="text-primary h-6 w-6" />
                    Cliquez pour ajouter une zone cible
                  </div>
                </div>
              )}

              <div className="pointer-events-none relative inline-block max-h-full max-w-full">
                <img
                  ref={imgRef}
                  src={q.pinImage}
                  alt="Target"
                  className="block h-auto max-h-[60vh] w-auto max-w-full rounded-xl object-contain select-none"
                  draggable={false}
                />

                {zones.map((zone, index) => {
                  const color = zoneColor(index)
                  const isSelected = selectedZoneId === zone.id

                  return (
                    <div
                      key={zone.id}
                      data-zone-marker
                      className="pointer-events-auto absolute z-20 cursor-grab active:cursor-grabbing"
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        transform: "translate(-50%, -100%)",
                      }}
                      onPointerDown={handleZonePointerDown(zone.id)}
                    >
                      <div
                        className={clsx(
                          "relative origin-bottom transition-transform",
                          isSelected && "scale-110",
                        )}
                      >
                        {isSelected && (
                          <div
                            className="absolute -bottom-1 left-1/2 h-6 w-6 -translate-x-1/2 animate-ping rounded-full"
                            style={{ backgroundColor: `${color}66` }}
                          />
                        )}

                        <MapPin
                          className="h-10 w-10 drop-shadow-[0_10px_10px_rgba(0,0,0,0.6)]"
                          style={{ color, fill: color }}
                        />

                        {!zone.isCorrect && (
                          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-xs font-black text-white">
                            ✕
                          </div>
                        )}

                        <div
                          className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-2.5 py-1 text-[10px] font-bold whitespace-nowrap text-white shadow-xl backdrop-blur-xl"
                        >
                          {zone.label || `Zone ${index + 1}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Zones panel */}
          {zones.length > 0 && (
            <div className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
              <div className="flex items-center justify-between px-1 pb-1">
                <p className="text-xs font-semibold tracking-wider text-white/40 uppercase">
                  Zones ({zones.length})
                </p>
                <button
                  onClick={() => {
                    const newZone: DropPinZone = {
                      id: generateId(),
                      x: 50,
                      y: 50,
                      width: 5,
                      height: 5,
                      label: `Zone ${zones.length + 1}`,
                      isCorrect: true,
                    }

                    updateZones([...zones, newZone])
                    setSelectedZoneId(newZone.id)
                  }}
                  className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                  title="Ajouter une zone au centre"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {zones.map((zone, index) => {
                const color = zoneColor(index)
                const isSelected = selectedZoneId === zone.id

                return (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZoneId(zone.id)}
                    className={clsx(
                      "group flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-colors",
                      isSelected
                        ? "border-white/30 bg-white/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-md"
                        style={{ backgroundColor: color }}
                      >
                        {index + 1}
                      </div>
                      <input
                        type="text"
                        value={zone.label}
                        onChange={(e) =>
                          updateZone(zone.id, { label: e.target.value })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white outline-none focus:bg-white/15"
                        placeholder={`Zone ${index + 1}`}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeZone(zone.id)
                        }}
                        className="rounded p-1 text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Supprimer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateZone(zone.id, { isCorrect: !zone.isCorrect })
                      }}
                      className={clsx(
                        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                        zone.isCorrect
                          ? "bg-green-500/20 text-green-300"
                          : "bg-red-500/20 text-red-300",
                      )}
                    >
                      {zone.isCorrect ? (
                        <Check className="size-3" />
                      ) : (
                        <X className="size-3" />
                      )}
                      {zone.isCorrect ? "Correcte" : "Incorrecte"}
                    </button>

                    <p className="text-[10px] text-white/40">
                      {zone.x}% , {zone.y}%
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default QuestionEditorDropPin
