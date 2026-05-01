import type { SliderQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor, type QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useTranslation } from "react-i18next"

type SliderWithId = SliderQuestion & { id: string }

const NumberField = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (_v: number) => void
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-semibold text-white">{label}</label>
    <input
      type="number"
      className="w-full rounded bg-white px-3 py-2 text-center font-bold text-gray-800 outline-none"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  </div>
)

const QuestionEditorSlider = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as QuestionWithId & SliderWithId

  const update = (key: string) => (value: number) =>
    updateQuestion(currentIndex, { [key]: value })

  return (
    <div className="z-10 flex flex-col gap-4 rounded-xl bg-white/10 p-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={t("quizz:sliderMin")}
          value={q.min}
          onChange={update("min")}
        />
        <NumberField
          label={t("quizz:sliderMax")}
          value={q.max}
          onChange={update("max")}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-white">
          {t("quizz:sliderCorrect")}
        </label>
        <input
          type="range"
          className="w-full accent-yellow-400"
          value={q.correctValue}
          min={q.min}
          max={q.max}
          onChange={(e) =>
            updateQuestion(currentIndex, {
              correctValue: parseFloat(e.target.value),
            })
          }
        />
        <div className="flex justify-between text-xs text-white/60">
          <span>{q.min}</span>
          <span className="font-bold text-yellow-300">{q.correctValue}</span>
          <span>{q.max}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-white">
          {t("quizz:sliderTolerance")} (±{q.tolerance})
        </label>
        <input
          type="number"
          className="w-full rounded bg-white px-3 py-2 text-center font-bold text-gray-800 outline-none"
          value={q.tolerance}
          min={0}
          onChange={(e) =>
            updateQuestion(currentIndex, {
              tolerance: parseFloat(e.target.value) || 0,
            })
          }
        />
      </div>
    </div>
  )
}

export default QuestionEditorSlider
