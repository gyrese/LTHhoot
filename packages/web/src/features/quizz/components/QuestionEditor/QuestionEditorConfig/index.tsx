import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import QuestionEditorTypeSelector from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTypeSelector"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { Clock, Contrast, Timer } from "lucide-react"
import { useTranslation } from "react-i18next"

const QuestionEditorConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleUpdateQuestion = (key: string) => (value: string | number) => {
    updateQuestion(currentIndex, { [key]: value })
  }

  const isTitle = currentQuestion.type === "title"

  return (
    <aside className="z-10 flex w-68 shrink-0 flex-col gap-6 overflow-auto bg-white p-4 shadow-sm">
      <ConfigSection title={t("quizz:questionType.title")}>
        <QuestionEditorTypeSelector />
      </ConfigSection>

      <ConfigSection title={t("quizz:question.config.background")}>
        <ConfigField>
          <ConfigField.Label
            icon={<Contrast className="size-4" />}
            label={t("quizz:question.config.opacity")}
          />
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={(currentQuestion.backgroundOpacity ?? 1) * 100}
              onChange={(e) => handleUpdateQuestion("backgroundOpacity")(Number(e.target.value) / 100)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary"
            />
            <span className="w-8 text-right text-xs font-medium text-gray-500">
              {Math.round((currentQuestion.backgroundOpacity ?? 1) * 100)}%
            </span>
          </div>
          <ConfigField.Description>
            {t("quizz:question.config.opacityHint")}
          </ConfigField.Description>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title={t("quizz:question.config.timings")}>
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
      </ConfigSection>
    </aside>
  )
}

export default QuestionEditorConfig
