import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import QuestionEditorTypeSelector from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTypeSelector"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  Clock,
  Contrast,
  Timer,
  Trophy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Volume2,
  Repeat,
  Settings,
  Play,
} from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

const QuestionEditorConfig = () => {
  const {
    currentQuestion,
    currentIndex,
    updateQuestion,
    selectedId,
    setSelectedId,
  } = useQuizzEditor()
  const { t } = useTranslation()

  const handleUpdateQuestion =
    (key: string) => (value: string | number | boolean) => {
      updateQuestion(currentIndex, { [key]: value })
    }

  const handleUpdateElement = (id: string, updates: any) => {
    const elements = (currentQuestion?.elements || []).map((el) =>
      el.id === id ? { ...el, ...updates } : el,
    )
    updateQuestion(currentIndex, { elements })
  }

  const handleDeleteLayer = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const elements = (currentQuestion?.elements || []).filter(
      (el) => el.id !== id,
    )
    updateQuestion(currentIndex, { elements })

    if (selectedId === id) {
      setSelectedId(undefined)
    }
  }

  const handleMoveLayer =
    (id: string, direction: "up" | "down") => (e: React.MouseEvent) => {
      e.stopPropagation()
      const elements = [...(currentQuestion?.elements || [])]
      const index = elements.findIndex((el) => el.id === id)

      if (index === -1) {
        return
      }

      if (direction === "up" && index < elements.length - 1) {
        ;[elements[index], elements[index + 1]] = [
          elements[index + 1],
          elements[index],
        ]
      } else if (direction === "down" && index > 0) {
        ;[elements[index], elements[index - 1]] = [
          elements[index - 1],
          elements[index],
        ]
      }

      updateQuestion(currentIndex, { elements })
    }

  const isTitle = currentQuestion?.type === "title"
  const selectedElement = currentQuestion?.elements?.find(
    (el) => el.id === selectedId,
  )
  const isYoutube = selectedElement?.type === "youtube"

  if (!currentQuestion) {
    return null
  }

  return (
    <aside className="z-10 flex w-68 shrink-0 flex-col gap-6 overflow-auto border-l border-gray-200 bg-white px-4 pb-4">
      <ConfigSection title="Type Slide" defaultOpen={false}>
        <QuestionEditorTypeSelector />
      </ConfigSection>

      {isYoutube && (
        <ConfigSection title="📺 CONFIGURATION YOUTUBE" defaultOpen={true}>
          <div className="flex flex-col gap-4 rounded-xl border-2 border-red-100 bg-red-50/30 p-2">
            {/* Autoplay & Mute */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  handleUpdateElement(selectedId!, {
                    autoplay: !selectedElement!.autoplay,
                  })
                }
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase shadow-sm transition-all",
                  selectedElement!.autoplay
                    ? "border-red-600 bg-red-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                <Play className="size-3" /> Autoplay
              </button>
              <button
                onClick={() =>
                  handleUpdateElement(selectedId!, {
                    mute: !selectedElement!.mute,
                  })
                }
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase shadow-sm transition-all",
                  selectedElement!.mute
                    ? "border-red-600 bg-red-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                <Volume2 className="size-3" /> Muet
              </button>
            </div>

            {/* Loop & Controls */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  handleUpdateElement(selectedId!, {
                    loop: !selectedElement!.loop,
                  })
                }
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase shadow-sm transition-all",
                  selectedElement!.loop
                    ? "border-red-600 bg-red-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                <Repeat className="size-3" /> Boucle
              </button>
              <button
                onClick={() =>
                  handleUpdateElement(selectedId!, {
                    controls: !selectedElement!.controls,
                  })
                }
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase shadow-sm transition-all",
                  selectedElement!.controls
                    ? "border-red-600 bg-red-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                <Settings className="size-3" /> Contrôles
              </button>
            </div>

            <div className="my-1 h-px bg-red-100" />

            {/* Start & End Time */}
            <div className="flex flex-col gap-3">
              <ConfigField>
                <ConfigField.Label
                  icon={<Clock className="size-4" />}
                  label="Début (sec)"
                />
                <ConfigNumberInput
                  value={(selectedElement as any).startTime || 0}
                  min={0}
                  onChange={(val) =>
                    handleUpdateElement(selectedId!, { startTime: val })
                  }
                />
              </ConfigField>

              <ConfigField>
                <ConfigField.Label
                  icon={<Clock className="size-4" />}
                  label="Fin (sec)"
                />
                <ConfigNumberInput
                  value={(selectedElement as any).endTime || 0}
                  min={0}
                  onChange={(val) =>
                    handleUpdateElement(selectedId!, { endTime: val })
                  }
                />
                <ConfigField.Description>
                  0 pour désactiver
                </ConfigField.Description>
              </ConfigField>
            </div>
          </div>
        </ConfigSection>
      )}

      <ConfigSection
        title={t("quizz:question.config.propertiesTitle")}
        defaultOpen={false}
      >
        <ConfigField>
          <ConfigField.Label
            icon={<Contrast className="size-4" />}
            label={t("quizz:question.config.opacity")}
            unit=""
          />
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={(currentQuestion?.backgroundOpacity ?? 0.5) * 100}
              onChange={(e) =>
                handleUpdateQuestion("backgroundOpacity")(
                  Number(e.target.value) / 100,
                )
              }
              className="accent-primary h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
            />
            <span className="w-8 text-right text-xs font-medium text-gray-500">
              {Math.round((currentQuestion?.backgroundOpacity ?? 0.5) * 100)}%
            </span>
          </div>
          <ConfigField.Description>
            {t("quizz:question.config.opacityHint")}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<Clock className="size-4" />}
            label={t(
              isTitle
                ? "quizz:question.config.displayDuration"
                : "quizz:question.config.questionDisplay",
            )}
          />
          <ConfigNumberInput
            value={currentQuestion?.cooldown}
            min={3}
            onChange={handleUpdateQuestion("cooldown")}
          />
          <ConfigField.Description>
            {t(
              isTitle
                ? "quizz:question.config.displayDurationHint"
                : "quizz:question.config.questionDisplayHint",
            )}
          </ConfigField.Description>
        </ConfigField>

        {!isTitle && (
          <ConfigField>
            <ConfigField.Label
              icon={<Timer className="size-4" />}
              label={t("quizz:question.config.answerTime")}
            />
            <ConfigNumberInput
              value={currentQuestion?.time}
              min={5}
              onChange={handleUpdateQuestion("time")}
            />
            <ConfigField.Description>
              {t("quizz:question.config.answerTimeHint")}
            </ConfigField.Description>
          </ConfigField>
        )}

        {!isTitle && (
          <ConfigField>
            <div className="flex items-center justify-between">
              <ConfigField.Label
                icon={<Trophy className="size-4" />}
                label={t("quizz:question.config.showLeaderboard")}
                unit=""
              />
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(currentQuestion?.showLeaderboard)}
                onClick={() =>
                  updateQuestion(currentIndex, {
                    showLeaderboard: !currentQuestion?.showLeaderboard,
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  currentQuestion?.showLeaderboard ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    currentQuestion?.showLeaderboard
                      ? "translate-x-4"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <ConfigField.Description>
              {t("quizz:question.config.showLeaderboardHint")}
            </ConfigField.Description>
          </ConfigField>
        )}
      </ConfigSection>

      <ConfigSection
        title={t("quizz:question.config.layersTitle")}
        defaultOpen={true}
      >
        <div className="flex flex-col gap-1.5">
          {[...(currentQuestion?.elements || [])]
            .reverse()
            .map((el, i, arr) => {
              const isSelected = selectedId === el.id
              const originalIndex = arr.length - 1 - i

              return (
                <div
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  className={clsx(
                    "flex cursor-pointer items-center justify-between rounded-md border p-2 text-[11px] shadow-sm transition-all",
                    isSelected
                      ? "bg-primary/5 border-primary ring-primary/20 ring-1"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                  )}
                >
                  <div className="flex flex-1 items-center gap-2 overflow-hidden">
                    <div
                      className={clsx(
                        "size-1.5 rounded-full",
                        isSelected ? "bg-primary" : "bg-gray-300",
                      )}
                    />
                    <span className="shrink-0 font-bold text-gray-700 capitalize">
                      {el.type}
                    </span>
                    {el.type === "text" && (
                      <span className="truncate text-gray-500 italic">
                        "{el.text}"
                      </span>
                    )}
                  </div>

                  <div className="ml-2 flex items-center gap-0.5">
                    <button
                      onClick={handleMoveLayer(el.id, "up")}
                      disabled={originalIndex === arr.length - 1}
                      className="hover:text-primary rounded p-1 text-gray-400 hover:bg-white disabled:opacity-20"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      onClick={handleMoveLayer(el.id, "down")}
                      disabled={originalIndex === 0}
                      className="hover:text-primary rounded p-1 text-gray-400 hover:bg-white disabled:opacity-20"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    <button
                      onClick={handleDeleteLayer(el.id)}
                      className="ml-1 rounded p-1 text-gray-400 hover:bg-white hover:text-red-500"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          {(!currentQuestion?.elements ||
            currentQuestion.elements.length === 0) && (
            <p className="py-4 text-center text-xs text-gray-400 italic">
              {t("quizz:question.config.noLayers")}
            </p>
          )}
        </div>
      </ConfigSection>
    </aside>
  )
}

export default QuestionEditorConfig
