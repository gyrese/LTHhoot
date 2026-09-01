import type { DropPinQuestion, DropPinZone } from "@rahoot/common/types/game"
import ZoneCanvas, {
  type DrawTool,
} from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDropPin/ZoneCanvas"
import {
  SHAPE_LABELS,
  zoneColor,
} from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDropPin/shapes"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import {
  Check,
  Circle,
  ImagePlus,
  MousePointer2,
  PenTool,
  Square,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type DropPinWithId = DropPinQuestion & { id: string }

const TOOLS: { id: DrawTool; label: string; icon: typeof Square }[] = [
  { id: "select", label: "Sélectionner", icon: MousePointer2 },
  { id: "rect", label: SHAPE_LABELS.rect, icon: Square },
  { id: "ellipse", label: SHAPE_LABELS.ellipse, icon: Circle },
  { id: "polygon", label: SHAPE_LABELS.polygon, icon: PenTool },
]

const QuestionEditorDropPin = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as DropPinWithId
  const zones = q.zones ?? []

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [tool, setTool] = useState<DrawTool>("rect")

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

  const updateZone = (zoneId: string, patch: Partial<DropPinZone>) => {
    updateZones(zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z)))
  }

  const removeZone = (zoneId: string) => {
    updateZones(zones.filter((z) => z.id !== zoneId))

    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null)
    }
  }

  const fileInput = (
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
  )

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
          {fileInput}
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
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {/* Barre d'outils de dessin */}
            <div className="flex shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-1.5">
                {TOOLS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTool(id)}
                    title={label}
                    className={clsx(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all",
                      tool === id
                        ? "bg-primary text-white shadow-lg"
                        : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {zones.length > 0 && (
                  <button
                    onClick={() => {
                      updateZones([])
                      setSelectedZoneId(null)
                    }}
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

            {fileInput}

            <ZoneCanvas
              pinImage={q.pinImage}
              zones={zones}
              tool={tool}
              selectedZoneId={selectedZoneId}
              onSelectZone={setSelectedZoneId}
              onZonesChange={updateZones}
              onZoneDrawn={() => setTool("select")}
            />
          </div>

          {/* Panneau des zones */}
          {zones.length > 0 && (
            <div className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
              <p className="px-1 pb-1 text-xs font-semibold tracking-wider text-white/40 uppercase">
                Zones ({zones.length})
              </p>

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
                        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors",
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
                      {zone.shape ? SHAPE_LABELS[zone.shape] : "Point (hérité)"}
                      {zone.shape === "polygon" &&
                        ` · ${zone.points?.length ?? 0} sommets`}
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
