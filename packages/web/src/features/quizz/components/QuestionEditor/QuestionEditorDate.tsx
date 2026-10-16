import { ValidatedInput } from "../EditorValidation"
import type { DateQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import {
  AnswerEditorNumberField,
  AnswerEditorPanel,
  AnswerEditorSection,
} from "./AnswerEditorParts"

const QuestionEditorDate = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const toleranceId = useId()
  const question = currentQuestion as DateQuestion & { id: string }
  const correctYear = question.correctYear ?? new Date().getFullYear()
  const minYear = question.minYear ?? correctYear - 30
  const maxYear = question.maxYear ?? correctYear + 30

  return (
    <AnswerEditorPanel>
      <AnswerEditorSection title={t("quizz:correctYear")}>
        <AnswerEditorNumberField
          field="correctYear"
          label={t("quizz:correctYear")}
          value={correctYear}
          min={-9999}
          max={2200}
          onChange={(value) =>
            updateQuestion(currentIndex, { correctYear: value })
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <AnswerEditorNumberField
            field="minYear"
            label={t("quizz:minYear")}
            value={minYear}
            min={-9999}
            max={maxYear - 1}
            onChange={(value) =>
              updateQuestion(currentIndex, { minYear: value })
            }
          />
          <AnswerEditorNumberField
            field="maxYear"
            label={t("quizz:maxYear")}
            value={maxYear}
            min={minYear + 1}
            max={2200}
            onChange={(value) =>
              updateQuestion(currentIndex, { maxYear: value })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={toleranceId}
            className="text-ink-muted text-xs font-semibold"
          >
            {t("quizz:tolerance")} (±{question.tolerance}{" "}
            {t("quizz:toleranceYears")})
          </label>
          <ValidatedInput
            id={toleranceId}
            field="tolerance"
            type="range"
            className="accent-primary w-full"
            value={question.tolerance}
            min={1}
            max={100}
            onChange={(event) =>
              updateQuestion(currentIndex, {
                tolerance: Number(event.target.value),
              })
            }
          />
          <div className="text-ink-muted flex justify-between text-xs tabular-nums">
            <span>1</span>
            <span>{question.tolerance}</span>
            <span>100</span>
          </div>
        </div>
      </AnswerEditorSection>
    </AnswerEditorPanel>
  )
}

export default QuestionEditorDate
