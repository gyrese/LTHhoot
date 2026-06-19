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
    <div className="focus-within:ring-primary/40 z-10 rounded-xl bg-white shadow-lg shadow-black/10 ring-1 ring-black/5 transition-shadow focus-within:ring-2">
      <textarea
        ref={textareaRef}
        rows={1}
        className="text-ink placeholder:text-ink-subtle w-full resize-none overflow-hidden p-4 text-center text-xl font-semibold outline-none"
        placeholder={t("quizz:question.placeholder")}
        value={currentQuestion.question}
        onChange={handleChangeQuestion}
      />
    </div>
  )
}

export default QuestionEditorTitle
