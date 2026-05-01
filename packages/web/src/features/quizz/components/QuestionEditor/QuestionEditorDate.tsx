import type { DateQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor, type QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useTranslation } from "react-i18next"

type DateWithId = DateQuestion & { id: string }

const QuestionEditorDate = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as QuestionWithId & DateWithId

  const correctYear = q.correctYear ?? new Date().getFullYear()
  const minYear = q.minYear ?? correctYear - 30
  const maxYear = q.maxYear ?? correctYear + 30

  return (
    <div className="z-10 flex flex-col gap-4 rounded-xl bg-white/10 p-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-white">
          {t("quizz:correctYear")}
        </label>
        <input
          type="number"
          className="w-full rounded bg-white px-3 py-2 text-center text-xl font-bold text-gray-800 outline-none"
          value={correctYear}
          min={-9999}
          max={2200}
          onChange={(e) =>
            updateQuestion(currentIndex, {
              correctYear: parseInt(e.target.value, 10) || 0,
            })
          }
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-semibold text-white">
            {t("quizz:minYear")}
          </label>
          <input
            type="number"
            className="w-full rounded bg-white px-3 py-2 text-center text-lg font-bold text-gray-800 outline-none"
            value={minYear}
            min={-9999}
            max={maxYear - 1}
            onChange={(e) =>
              updateQuestion(currentIndex, {
                minYear: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-semibold text-white">
            {t("quizz:maxYear")}
          </label>
          <input
            type="number"
            className="w-full rounded bg-white px-3 py-2 text-center text-lg font-bold text-gray-800 outline-none"
            value={maxYear}
            min={minYear + 1}
            max={2200}
            onChange={(e) =>
              updateQuestion(currentIndex, {
                maxYear: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-white">
          {t("quizz:tolerance")} (±{q.tolerance} {t("quizz:toleranceYears")})
        </label>
        <input
          type="range"
          className="w-full accent-yellow-400"
          value={q.tolerance}
          min={1}
          max={100}
          onChange={(e) =>
            updateQuestion(currentIndex, {
              tolerance: parseInt(e.target.value, 10),
            })
          }
        />
        <div className="flex justify-between text-xs text-white/60">
          <span>1</span>
          <span className="font-bold text-yellow-300">{q.tolerance}</span>
          <span>100</span>
        </div>
      </div>
    </div>
  )
}

export default QuestionEditorDate
