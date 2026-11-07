import type { SliderQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useTranslation } from "react-i18next"
import {
  AnswerEditorNumberField,
  AnswerEditorPanel,
  AnswerEditorSection,
} from "./AnswerEditorParts"

const QuestionEditorSlider = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const question = currentQuestion as SliderQuestion & { id: string }

  const updateMin = (newMin: number) => {
    const min = Math.min(newMin, question.max - 1)
    updateQuestion(currentIndex, {
      min,
      correctValue: Math.max(min, question.correctValue),
    })
  }

  const updateMax = (newMax: number) => {
    const max = Math.max(newMax, question.min + 1)
    updateQuestion(currentIndex, {
      max,
      correctValue: Math.min(max, question.correctValue),
    })
  }

  const updateCorrectValue = (correctValue: number) =>
    updateQuestion(currentIndex, { correctValue })

  return (
    <AnswerEditorPanel>
      <AnswerEditorSection title={t("quizz:sliderCorrect")}>
        <div className="grid grid-cols-2 gap-3">
          <AnswerEditorNumberField
            field="min"
            label={t("quizz:sliderMin")}
            value={question.min}
            onChange={updateMin}
          />
          <AnswerEditorNumberField
            field="max"
            label={t("quizz:sliderMax")}
            value={question.max}
            onChange={updateMax}
          />
        </div>
        <AnswerEditorNumberField
          key={question.id}
          field="correctValue"
          label={t("quizz:sliderCorrect")}
          value={question.correctValue}
          min={question.min}
          max={question.max}
          onChange={updateCorrectValue}
        />
        <div className="flex flex-col gap-1.5">
          <input
            type="range"
            aria-label={t("quizz:sliderCorrect")}
            className="accent-primary w-full"
            value={question.correctValue}
            min={question.min}
            max={question.max}
            onChange={(event) => updateCorrectValue(event.target.valueAsNumber)}
          />
          <div className="text-ink-muted flex justify-between text-xs tabular-nums">
            <span>{question.min}</span>
            <span>{question.max}</span>
          </div>
        </div>
        <AnswerEditorNumberField
          field="tolerance"
          label={`${t("quizz:sliderTolerance")} (±${question.tolerance})`}
          value={question.tolerance}
          min={0}
          onChange={(value) =>
            updateQuestion(currentIndex, { tolerance: value })
          }
        />
      </AnswerEditorSection>
    </AnswerEditorPanel>
  )
}

export default QuestionEditorSlider
