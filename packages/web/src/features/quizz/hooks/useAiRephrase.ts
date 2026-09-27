import { EVENTS } from "@rahoot/common/constants"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

// Reformulation IA du titre de la question courante.
const useAiRephrase = () => {
  const { updateQuestion, currentIndex, currentQuestion, questions } =
    useQuizzEditor()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const [isRephrasing, setIsRephrasing] = useState(false)
  // Slide capturé À L'ENVOI (index + id) : la réponse IA arrive 1-3 s plus
  // tard, et l'utilisateur peut avoir changé de slide entre-temps — appliquer
  // au `currentIndex` de réception écraserait la mauvaise question.
  const pendingRef = useRef<{ index: number; id: string; text: string } | null>(
    null,
  )

  const canRephrase = Boolean(currentQuestion?.question.trim())

  const rephrase = () => {
    if (!socket || isRephrasing || !canRephrase) {
      return
    }

    pendingRef.current = {
      index: currentIndex,
      id: currentQuestion.id,
      text: currentQuestion.question,
    }
    setIsRephrasing(true)
    socket.emit(EVENTS.QUIZZ.AI_REPHRASE, {
      currentText: currentQuestion.question,
    })
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
    const index = questions.findIndex((q) => q.id === request.id)
    if (index >= 0 && questions[index].question === request.text) {
      updateQuestion(index, { question: rephrased })
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

  return { rephrase, isRephrasing, canRephrase }
}

export default useAiRephrase
