import { EVENTS } from "@rahoot/common/constants"
import type { McqQuestion } from "@rahoot/common/types/game"
import { MAX_MCQ_ANSWERS } from "@rahoot/common/utils/question-layout"
import { resizeLayoutAnswers } from "@rahoot/web/features/game/utils/question-layout"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Loader2, Minus, Plus, Sparkles } from "lucide-react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

// Barre d'outils des réponses de QCM (nombre, ajout / retrait, suggestions IA).
// Les cases elles-mêmes sont éditées sur la diapositive (QuestionLayoutEditor).
const QuestionEditorAnswersToolbar = () => {
  const { currentQuestion, currentIndex, updateQuestion, questions } =
    useQuizzEditor()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const [isSuggesting, setIsSuggesting] = useState(false)
  // Slide capturé À L'ENVOI (index + id) : la réponse IA arrive 1-3 s plus
  // tard, et l'utilisateur peut avoir changé de slide entre-temps — remplir le
  // `currentIndex` de réception écraserait les réponses du mauvais slide.
  const pendingRef = useRef<{ index: number; id: string } | null>(null)
  // This component is only rendered when type === "mcq" (enforced by QuestionEditor switch)
  const mcq = currentQuestion as McqQuestion & { id: string }

  const hasEmptySlot = mcq.answers.some(
    (a, i) => !mcq.solutions.includes(i) && !a.trim(),
  )
  const correctAnswerText =
    mcq.solutions.length > 0 ? mcq.answers[mcq.solutions[0]!] : undefined
  const canSuggestWrongAnswers =
    Boolean(correctAnswerText?.trim()) && hasEmptySlot

  const handleSuggestWrongAnswers = () => {
    if (
      !socket ||
      isSuggesting ||
      !canSuggestWrongAnswers ||
      !correctAnswerText
    ) {
      return
    }

    pendingRef.current = { index: currentIndex, id: mcq.id }
    setIsSuggesting(true)
    socket.emit(EVENTS.QUIZZ.AI_SUGGEST_WRONG_ANSWERS, {
      correctAnswer: correctAnswerText,
      questionContext: mcq.question,
    })
  }

  useEvent(
    EVENTS.QUIZZ.AI_SUGGEST_WRONG_ANSWERS_SUCCESS,
    ({ wrongAnswers }) => {
      const request = pendingRef.current

      if (!request) {
        return
      }

      pendingRef.current = null
      setIsSuggesting(false)

      // On remplit le slide d'ORIGINE (pas celui affiché), et seulement s'il
      // est toujours à cet index avec le même type.
      const target = questions[request.index]

      if (!target || target.id !== request.id || target.type !== "mcq") {
        return
      }

      const next = [...target.answers]
      let suggestionIndex = 0

      for (
        let i = 0;
        i < next.length && suggestionIndex < wrongAnswers.length;
        i += 1
      ) {
        if (target.solutions.includes(i) || next[i]?.trim()) {
          continue
        }

        next[i] = wrongAnswers[suggestionIndex]!
        suggestionIndex += 1
      }

      updateQuestion(request.index, { answers: next })
    },
  )

  useEvent(EVENTS.QUIZZ.AI_ERROR, (message) => {
    if (!pendingRef.current) {
      return
    }

    pendingRef.current = null
    setIsSuggesting(false)
    toast.error(t(message))
  })

  // `layout.answers` reste aligné sur les réponses : la nouvelle case prend
  // sa place par défaut, la case retirée disparaît avec sa réponse.
  const addAnswer = () => {
    if (mcq.answers.length >= MAX_MCQ_ANSWERS) {
      return
    }

    updateQuestion(currentIndex, {
      answers: [...mcq.answers, ""],
      layout: resizeLayoutAnswers(mcq.layout, mcq.answers.length + 1),
    })
  }

  const removeAnswer = () => {
    if (mcq.answers.length <= 2) {
      return
    }

    const next = mcq.answers.slice(0, -1)
    const maxIndex = next.length - 1
    const nextSolution = mcq.solutions.filter((s) => s <= maxIndex)

    updateQuestion(currentIndex, {
      answers: next,
      solutions: nextSolution.length > 0 ? nextSolution : [0],
      layout: resizeLayoutAnswers(mcq.layout, next.length),
    })
  }

  const ctrlBtn =
    "focus-ring text-ink-muted hover:bg-panel hover:text-ink flex size-7 items-center justify-center rounded-md transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-30"

  return (
    <div className="bg-surface/90 flex items-center gap-1 rounded-lg p-1 shadow-sm backdrop-blur-sm">
      <span className="text-ink-muted px-1.5 text-sm font-semibold">
        {mcq.answers.length}
        {t("quizz:answersCountSuffix")}
      </span>
      <button
        onClick={removeAnswer}
        disabled={mcq.answers.length <= 2}
        className={ctrlBtn}
        title={t("quizz:removeAnswer", "Retirer une réponse")}
      >
        <Minus className="size-4" />
      </button>
      <button
        onClick={addAnswer}
        disabled={mcq.answers.length >= MAX_MCQ_ANSWERS}
        className={ctrlBtn}
        title={t("quizz:addAnswer", "Ajouter une réponse")}
      >
        <Plus className="size-4" />
      </button>
      <button
        onClick={handleSuggestWrongAnswers}
        disabled={!canSuggestWrongAnswers || isSuggesting}
        className={clsx(ctrlBtn, "text-primary")}
        title={t(
          "quizz:question.aiSuggestWrongAnswers",
          "Générer les mauvaises réponses par IA",
        )}
      >
        {isSuggesting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
      </button>
    </div>
  )
}

export default QuestionEditorAnswersToolbar
