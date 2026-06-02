import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useEffect, useRef, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"

const QuestionEditorTitle = () => {
  const { updateQuestion, currentIndex, currentQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChangeQuestion = (e: ChangeEvent<HTMLTextAreaElement>) => {
    updateQuestion(currentIndex, { question: e.target.value })
  }

  useEffect(() => {
    const textarea = textareaRef.current

    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [currentQuestion.question])

  return (
    <div className="z-10 rounded-sm bg-white shadow-sm">
      <textarea
        ref={textareaRef}
        rows={1}
        className="w-full resize-none overflow-hidden p-4 text-center text-xl font-semibold text-gray-800 outline-none placeholder:text-gray-400"
        placeholder={t("quizz:question.placeholder")}
        value={currentQuestion.question}
        onChange={handleChangeQuestion}
      />
    </div>
  )
}

export default QuestionEditorTitle
