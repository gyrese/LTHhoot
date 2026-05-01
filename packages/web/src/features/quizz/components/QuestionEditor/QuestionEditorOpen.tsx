import type { OpenQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor, type QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

type OpenWithId = OpenQuestion & { id: string }

const QuestionEditorOpen = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as QuestionWithId & OpenWithId

  const updateAnswer = (index: number, value: string) => {
    const next = [...q.correctAnswers]
    next[index] = value
    updateQuestion(currentIndex, { correctAnswers: next })
  }

  const addAnswer = () => {
    updateQuestion(currentIndex, {
      correctAnswers: [...q.correctAnswers, ""],
    })
  }

  const removeAnswer = (index: number) => {
    if (q.correctAnswers.length <= 1) {
      return
    }

    updateQuestion(currentIndex, {
      correctAnswers: q.correctAnswers.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="z-10 flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="rounded bg-white px-2 py-1 text-sm font-semibold text-gray-500">
          {t("quizz:correctAnswers")}
        </span>
        <button
          type="button"
          onClick={addAnswer}
          className="flex size-7 items-center justify-center rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {q.correctAnswers.map((answer, i) => (
          <div
            key={i}
            className="shadow-inset flex items-center gap-3 rounded bg-green-500 px-4 py-4"
          >
            <input
              className="flex-1 bg-transparent font-semibold text-white placeholder-white/70 outline-none"
              placeholder={t("quizz:addCorrectAnswer")}
              value={answer}
              onChange={(e) => updateAnswer(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeAnswer(i)}
              disabled={q.correctAnswers.length <= 1}
              className="flex size-6 items-center justify-center rounded-full border-2 border-white/60 text-white/80 hover:border-white disabled:opacity-30"
            >
              <Minus className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <p className="px-1 text-xs text-white/70">
        {t("quizz:openAnswerHint")}
      </p>
    </div>
  )
}

export default QuestionEditorOpen
