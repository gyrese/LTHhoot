import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import QuestionEditorTypeSelector from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTypeSelector"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { Clock, Contrast, Timer, Layers, Trophy } from "lucide-react"
import { useTranslation } from "react-i18next"

const QuestionEditorConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleUpdateQuestion = (key: string) => (value: string | number) => {
    updateQuestion(currentIndex, { [key]: value })
  }

  const isTitle = currentQuestion.type === "title"

  return (
    <aside className="z-10 flex w-68 shrink-0 flex-col gap-6 overflow-auto bg-white border-l border-gray-200 px-4 pb-4">
      <ConfigSection title="Type Slide" defaultOpen={false}>
        <QuestionEditorTypeSelector />
      </ConfigSection>

      <ConfigSection title="Propriétés" defaultOpen={false}>
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

      <ConfigSection title="Calques" defaultOpen={false}>
        <div className="flex flex-col gap-1.5">
          {[...(currentQuestion?.elements || [])].reverse().map((el, i) => (
            <div key={el.id} className="text-xs p-2 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="font-medium capitalize text-gray-700">{el.type}</span>
                {el.type === "text" && <span className="text-gray-500 truncate">"{el.text}"</span>}
              </div>
              <span className="text-gray-400 shrink-0 text-[10px]">z-index: {currentQuestion.elements!.length - i - 1}</span>
            </div>
          ))}
          {(!currentQuestion?.elements || currentQuestion.elements.length === 0) && (
            <p className="text-xs text-gray-400 italic text-center py-4">Aucun calque</p>
          )}
        </div>
      </ConfigSection>
    </aside>
  )
}

export default QuestionEditorConfig
