import type { TrueFalseQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor, type QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

type TrueFalseWithId = TrueFalseQuestion & { id: string }

const QuestionEditorTrueFalse = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as QuestionWithId & TrueFalseWithId

  return (
    <div className="z-10 grid grid-cols-2 gap-3">
      {([0, 1] as const).map((val) => {
        const label = val === 0 ? t("quizz:trueFalseFalse") : t("quizz:trueFalseTrue")
        const isSelected = q.solution === val
        const color = val === 0 ? "bg-red-500" : "bg-blue-500"

        return (
          <button
            key={val}
            type="button"
            onClick={() => updateQuestion(currentIndex, { solution: val })}
            className={clsx(
              "shadow-inset flex items-center justify-between rounded px-4 py-6 font-bold text-white transition-opacity",
              color,
              !isSelected && "opacity-50",
            )}
          >
            <span className="text-lg">{label}</span>
            <span className="flex size-6 items-center justify-center rounded-full border-2 border-white">
              {isSelected && (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default QuestionEditorTrueFalse
