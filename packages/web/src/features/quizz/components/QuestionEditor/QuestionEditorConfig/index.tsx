import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import QuestionEditorTypeSelector from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTypeSelector"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { Clock, Contrast, Timer, Layers, Trophy, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

const QuestionEditorConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion, selectedId, setSelectedId } = useQuizzEditor()
  const { t } = useTranslation()

  const handleUpdateQuestion = (key: string) => (value: string | number) => {
    updateQuestion(currentIndex, { [key]: value })
  }

  const handleDeleteLayer = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const elements = (currentQuestion.elements || []).filter((el) => el.id !== id)
    updateQuestion(currentIndex, { elements })
    if (selectedId === id) setSelectedId(undefined)
  }

  const handleMoveLayer = (id: string, direction: "up" | "down") => (e: React.MouseEvent) => {
    e.stopPropagation()
    const elements = [...(currentQuestion.elements || [])]
    const index = elements.findIndex((el) => el.id === id)
    if (index === -1) return

    if (direction === "up" && index < elements.length - 1) {
      [elements[index], elements[index + 1]] = [elements[index + 1], elements[index]]
    } else if (direction === "down" && index > 0) {
      [elements[index], elements[index - 1]] = [elements[index - 1], elements[index]]
    }

    updateQuestion(currentIndex, { elements })
  }

  const isTitle = currentQuestion.type === "title"

  return (
    <aside className="z-10 flex w-68 shrink-0 flex-col gap-6 overflow-auto bg-white border-l border-gray-200 px-4 pb-4">
      <ConfigSection title="Type Slide" defaultOpen={false}>
        <QuestionEditorTypeSelector />
      </ConfigSection>

      <ConfigSection title={t("quizz:question.config.propertiesTitle")} defaultOpen={false}>
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
              value={(currentQuestion.backgroundOpacity ?? 0.5) * 100}
              onChange={(e) => handleUpdateQuestion("backgroundOpacity")(Number(e.target.value) / 100)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary"
            />
            <span className="w-8 text-right text-xs font-medium text-gray-500">
              {Math.round((currentQuestion.backgroundOpacity ?? 0.5) * 100)}%
            </span>
          </div>
          <ConfigField.Description>
            {t("quizz:question.config.opacityHint")}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<Clock className="size-4" />}
            label={t(isTitle ? "quizz:question.config.displayDuration" : "quizz:question.config.questionDisplay")}
          />
          <ConfigNumberInput
            value={currentQuestion.cooldown}
            min={3}
            onChange={handleUpdateQuestion("cooldown")}
          />
          <ConfigField.Description>
            {t(isTitle ? "quizz:question.config.displayDurationHint" : "quizz:question.config.questionDisplayHint")}
          </ConfigField.Description>
        </ConfigField>

        {!isTitle && (
          <ConfigField>
            <ConfigField.Label
              icon={<Timer className="size-4" />}
              label={t("quizz:question.config.answerTime")}
            />
            <ConfigNumberInput
              value={currentQuestion.time}
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
                aria-checked={!!currentQuestion.showLeaderboard}
                onClick={() => updateQuestion(currentIndex, { showLeaderboard: !currentQuestion.showLeaderboard })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  currentQuestion.showLeaderboard ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    currentQuestion.showLeaderboard ? "translate-x-4" : "translate-x-0.5"
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

      <ConfigSection title={t("quizz:question.config.layersTitle")} defaultOpen={true}>
        <div className="flex flex-col gap-1.5">
          {[...(currentQuestion?.elements || [])].reverse().map((el, i, arr) => {
            const isSelected = selectedId === el.id
            const originalIndex = arr.length - 1 - i
            
            return (
              <div 
                key={el.id} 
                onClick={() => setSelectedId(el.id)}
                className={clsx(
                  "text-[11px] p-2 rounded-md border flex items-center justify-between shadow-sm cursor-pointer transition-all",
                  isSelected ? "bg-primary/5 border-primary ring-1 ring-primary/20" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                )}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <div className={clsx("size-1.5 rounded-full", isSelected ? "bg-primary" : "bg-gray-300")} />
                  <span className="font-bold capitalize text-gray-700 shrink-0">{el.type}</span>
                  {el.type === "text" && <span className="text-gray-500 truncate italic">"{el.text}"</span>}
                </div>
                
                <div className="flex items-center gap-0.5 ml-2">
                  <button 
                    onClick={handleMoveLayer(el.id, "up")}
                    disabled={originalIndex === arr.length - 1}
                    className="p-1 text-gray-400 hover:text-primary hover:bg-white rounded disabled:opacity-20"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button 
                    onClick={handleMoveLayer(el.id, "down")}
                    disabled={originalIndex === 0}
                    className="p-1 text-gray-400 hover:text-primary hover:bg-white rounded disabled:opacity-20"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button 
                    onClick={handleDeleteLayer(el.id)}
                    className="ml-1 p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
          {(!currentQuestion?.elements || currentQuestion.elements.length === 0) && (
            <p className="text-xs text-gray-400 italic text-center py-4">{t("quizz:question.config.noLayers")}</p>
          )}
        </div>
      </ConfigSection>
    </aside>
  )
}

export default QuestionEditorConfig
