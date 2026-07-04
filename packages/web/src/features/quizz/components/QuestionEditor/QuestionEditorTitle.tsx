import { EVENTS } from "@rahoot/common/constants"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { Loader2, Sparkles } from "lucide-react"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const QuestionEditorTitle = () => {
  const { updateQuestion, currentIndex, currentQuestion, questions } =
    useQuizzEditor()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isRephrasing, setIsRephrasing] = useState(false)
  // Slide capturé À L'ENVOI (index + id) : la réponse IA arrive 1-3 s plus
  // tard, et l'utilisateur peut avoir changé de slide entre-temps — appliquer
  // au `currentIndex` de réception écraserait la mauvaise question.
  const pendingRef = useRef<{ index: number; id: string } | null>(null)

  const handleChangeQuestion = (e: ChangeEvent<HTMLTextAreaElement>) => {
    updateQuestion(currentIndex, { question: e.target.value })
  }

  const handleRephrase = () => {
    if (!socket || isRephrasing || !currentQuestion.question.trim()) {
      return
    }

    pendingRef.current = { index: currentIndex, id: currentQuestion.id }
    setIsRephrasing(true)
    socket.emit(EVENTS.QUIZZ.AI_REPHRASE, { currentText: currentQuestion.question })
  }

  useEvent(EVENTS.QUIZZ.AI_REPHRASE_SUCCESS, ({ rephrased }) => {
    const request = pendingRef.current

    if (!request) {
      return
    }

    pendingRef.current = null
    setIsRephrasing(false)

    // On n'applique que si le slide d'origine est toujours à cet index
    // (réordonnancement/suppression pendant la requête → on abandonne).
    if (questions[request.index]?.id === request.id) {
      updateQuestion(request.index, { question: rephrased })
    }
  })

  useEvent(EVENTS.QUIZZ.AI_ERROR, (message) => {
    if (!pendingRef.current) {
      return
    }

    pendingRef.current = null
    setIsRephrasing(false)
    toast.error(t(message))
  })

  useEffect(() => {
    const textarea = textareaRef.current

    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [currentQuestion.question])

  return (
    <div className="focus-within:ring-primary/40 z-10 flex items-center gap-2 rounded-xl bg-white shadow-lg shadow-black/10 ring-1 ring-black/5 transition-shadow focus-within:ring-2">
      <textarea
        ref={textareaRef}
        rows={1}
        className="text-ink placeholder:text-ink-subtle w-full resize-none overflow-hidden p-4 text-center text-xl font-semibold outline-none"
        placeholder={t("quizz:question.placeholder")}
        value={currentQuestion.question}
        onChange={handleChangeQuestion}
      />
      <button
        type="button"
        onClick={handleRephrase}
        disabled={isRephrasing || !currentQuestion.question.trim()}
        className="mr-3 flex size-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-30"
        title={t("quizz:question.aiRephrase", "Reformuler par IA")}
      >
        {isRephrasing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
      </button>
    </div>
  )
}

export default QuestionEditorTitle
