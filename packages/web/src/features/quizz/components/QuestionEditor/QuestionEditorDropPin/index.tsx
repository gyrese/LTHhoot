import type { DropPinQuestion, DropPinZone } from "@rahoot/common/types/game"
import ZoneCanvas, {
  type DrawTool,
} from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDropPin/ZoneCanvas"
import {
  SHAPE_LABELS,
  zoneColor,
} from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDropPin/shapes"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useQuestionImagePicker } from "../useQuestionImagePicker"
import clsx from "clsx"
import {
  Check,
  Circle,
  ImagePlus,
  MousePointer2,
  PenTool,
  Square,
  Trash2,
  X,
} from "lucide-react"
import { useState } from "react"
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

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [tool, setTool] = useState<DrawTool>("rect")
  const { openPicker, picker } = useQuestionImagePicker(
    (questionIndex, target, url) => {
      if (target.type === "drop_pin") {
        updateQuestion(questionIndex, { pinImage: url, zones: [] })
        setSelectedZoneId(null)
      }
    },
  )

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

  return (
    <div
      tabIndex={-1}
      data-validation-target={`questions.${currentIndex}.zones`}
      className="animate-in fade-in slide-in-from-bottom-4 flex min-h-0 w-full flex-1 flex-col gap-4 duration-500"
    >
      {!q.pinImage && (
        <button
          type="button"
          data-validation-target={`questions.${currentIndex}.pinImage`}
          onClick={() => openPicker(q.id)}
          className="focus-ring border-border text-ink-muted hover:border-primary hover:text-ink flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-black/20 p-8 text-center transition-colors"
        >
          <ImagePlus className="size-10" />
          <span className="text-base font-semibold">
            {t("quizz:dropPin.chooseImage")}
          </span>
          <span className="max-w-md text-sm">
            {t("quizz:dropPin.chooseImageHint")}
          </span>
        </button>
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
                  type="button"
                  onClick={() => openPicker(q.id)}
                  aria-label={t("quizz:dropPin.replaceImageHint")}
                  title={t("quizz:dropPin.replaceImageHint")}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-white/15"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {t("quizz:dropPin.replaceImage")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateQuestion(currentIndex, {
                      pinImage: undefined,
                      zones: [],
                    })
                    setSelectedZoneId(null)
                  }}
                  aria-label={t("quizz:dropPin.removeImageHint")}
                  title={t("quizz:dropPin.removeImageHint")}
                  className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("quizz:dropPin.removeImage")}
                </button>
              </div>
            </div>

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
      {picker}
    </div>
  )
}

export default QuestionEditorDropPin
