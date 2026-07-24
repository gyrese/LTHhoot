import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  Clock,
  Lock,
  MousePointerClick,
  Play,
  Repeat,
  Settings,
  Trash2,
  Unlock,
  Volume2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

const ElementPanel = () => {
  const { currentQuestion, currentIndex, updateQuestion, selectedId, setSelectedId } =
    useQuizzEditor()
  const { t } = useTranslation()

  const selectedElement = currentQuestion?.elements?.find(
    (el) => el.id === selectedId,
  )

  if (!currentQuestion || !selectedElement) {
    return (
      <div className="text-ink-subtle flex flex-col items-center gap-2 py-10 text-center">
        <MousePointerClick className="size-5 opacity-50" />
        <p className="text-xs">
          {t(
            "quizz:question.config.noSelection",
            "Sélectionne un élément sur la slide pour le configurer.",
          )}
        </p>
      </div>
    )
  }

  const handleUpdateElement = (id: string, updates: Record<string, unknown>) => {
    const elements = (currentQuestion.elements || []).map((el) =>
      el.id === id ? { ...el, ...updates } : el,
    )
    updateQuestion(currentIndex, { elements })
  }

  const handleDeleteElement = () => {
    const elements = (currentQuestion.elements || []).filter(
      (el) => el.id !== selectedElement.id,
    )
    updateQuestion(currentIndex, { elements })
    setSelectedId(undefined)
  }

  const isYoutube = selectedElement.type === "youtube"

  const ytChip = (active: boolean) =>
    clsx(
      "focus-ring flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase transition-all duration-150",
      active
        ? "border-primary bg-primary text-secondary"
        : "border-border bg-surface text-ink-muted hover:bg-panel hover:text-ink",
    )

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* En-tête de la sélection */}
      <div className="border-border bg-panel flex items-center justify-between gap-2 rounded-xl border p-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-ink truncate text-sm font-bold capitalize">
            {selectedElement.name || selectedElement.type}
          </span>
          <span className="text-ink-subtle text-[10px] font-medium uppercase">
            {selectedElement.type}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() =>
              handleUpdateElement(selectedElement.id, {
                isLocked: !selectedElement.isLocked,
              })
            }
            className={clsx(
              "focus-ring rounded-lg p-1.5 transition-colors",
              selectedElement.isLocked
                ? "text-primary"
                : "text-ink-subtle hover:bg-surface hover:text-primary-ink",
            )}
            title={selectedElement.isLocked ? "Déverrouiller" : "Verrouiller"}
          >
            {selectedElement.isLocked ? (
              <Lock className="size-4" />
            ) : (
              <Unlock className="size-4" />
            )}
          </button>
          <button
            onClick={handleDeleteElement}
            className="text-ink-subtle hover:bg-danger-soft hover:text-danger focus-ring rounded-lg p-1.5 transition-colors"
            title="Supprimer l'élément"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {isYoutube && (
        <div className="border-border bg-panel flex flex-col gap-4 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                handleUpdateElement(selectedElement.id, {
                  autoplay: !selectedElement.autoplay,
                })
              }
              className={ytChip(Boolean(selectedElement.autoplay))}
            >
              <Play className="size-3" /> Autoplay
            </button>
            <button
              onClick={() =>
                handleUpdateElement(selectedElement.id, {
                  mute: !selectedElement.mute,
                })
              }
              className={ytChip(Boolean(selectedElement.mute))}
            >
              <Volume2 className="size-3" /> Muet
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                handleUpdateElement(selectedElement.id, {
                  loop: !selectedElement.loop,
                })
              }
              className={ytChip(Boolean(selectedElement.loop))}
            >
              <Repeat className="size-3" /> Boucle
            </button>
            <button
              onClick={() =>
                handleUpdateElement(selectedElement.id, {
                  controls: !selectedElement.controls,
                })
              }
              className={ytChip(Boolean(selectedElement.controls))}
            >
              <Settings className="size-3" /> Contrôles
            </button>
          </div>

          <div className="bg-border my-1 h-px" />

          <div className="flex flex-col gap-3">
            <ConfigField>
              <ConfigField.Label
                icon={<Clock className="size-4" />}
                label="Début (sec)"
              />
              <ConfigNumberInput
                value={(selectedElement as { startTime?: number }).startTime || 0}
                min={0}
                onChange={(val) =>
                  handleUpdateElement(selectedElement.id, { startTime: val })
                }
              />
            </ConfigField>

            <ConfigField>
              <ConfigField.Label
                icon={<Clock className="size-4" />}
                label="Fin (sec)"
              />
              <ConfigNumberInput
                value={(selectedElement as { endTime?: number }).endTime || 0}
                min={0}
                onChange={(val) =>
                  handleUpdateElement(selectedElement.id, { endTime: val })
                }
              />
              <ConfigField.Description>
                0 pour désactiver
              </ConfigField.Description>
            </ConfigField>
          </div>
        </div>
      )}
    </div>
  )
}

export default ElementPanel
