import { EVENTS } from "@rahoot/common/constants"
import type { McqQuestion } from "@rahoot/common/types/game"
import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
} from "@rahoot/web/features/game/utils/constants"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Loader2, Minus, Plus, Sparkles } from "lucide-react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const Checkmark = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const QuestionEditorAnswers = () => {
  const { currentQuestion, currentIndex, updateQuestion, questions } =
    useQuizzEditor()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
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
  const correctAnswerText = mcq.solutions.length > 0 ? mcq.answers[mcq.solutions[0]!] : undefined
  const canSuggestWrongAnswers = Boolean(correctAnswerText?.trim()) && hasEmptySlot

  const handleSuggestWrongAnswers = () => {
    if (!socket || isSuggesting || !canSuggestWrongAnswers || !correctAnswerText) {
      return
    }

    pendingRef.current = { index: currentIndex, id: mcq.id }
    setIsSuggesting(true)
    socket.emit(EVENTS.QUIZZ.AI_SUGGEST_WRONG_ANSWERS, {
      correctAnswer: correctAnswerText,
      questionContext: mcq.question,
    })
  }

  useEvent(EVENTS.QUIZZ.AI_SUGGEST_WRONG_ANSWERS_SUCCESS, ({ wrongAnswers }) => {
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

    for (let i = 0; i < next.length && suggestionIndex < wrongAnswers.length; i += 1) {
      if (target.solutions.includes(i) || next[i]?.trim()) {
        continue
      }

      next[i] = wrongAnswers[suggestionIndex]!
      suggestionIndex += 1
    }

    updateQuestion(request.index, { answers: next })
  })

  useEvent(EVENTS.QUIZZ.AI_ERROR, (message) => {
    if (!pendingRef.current) {
      return
    }

    pendingRef.current = null
    setIsSuggesting(false)
    toast.error(t(message))
  })

  const updateAnswer = (index: number, value: string) => {
    const next = [...mcq.answers]
    next[index] = value
    updateQuestion(currentIndex, { answers: next })
  }

  const addAnswer = () => {
    if (mcq.answers.length >= 4) {
      return
    }

    updateQuestion(currentIndex, { answers: [...mcq.answers, ""] })
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
    })
  }

  const toggleSolution = (index: number) => {
    const current = mcq.solutions

    if (current.includes(index)) {
      const next = current.filter((s) => s !== index)
      updateQuestion(currentIndex, {
        solutions: next.length > 0 ? next : [index],
      })
    } else {
      updateQuestion(currentIndex, { solutions: [...current, index] })
    }
  }

  const ctrlBtn =
    "focus-ring text-ink-muted hover:bg-panel hover:text-ink flex size-7 items-center justify-center rounded-md transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-30"

  return (
    <div className="z-10 flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="bg-surface/90 text-ink-muted rounded-lg px-2.5 py-1 text-sm font-semibold shadow-sm backdrop-blur-sm">
          {mcq.answers.length}
          {t("quizz:answersCountSuffix")}
        </div>
        <div className="bg-surface/90 flex gap-1 rounded-lg p-1 shadow-sm backdrop-blur-sm">
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
            disabled={mcq.answers.length >= 4}
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {mcq.answers.map((answer, i) => {
            const Icon = ANSWERS_ICONS[i]
            const isSelected = mcq.solutions.includes(i)

            return (
              <motion.div
                key={i}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className={clsx(
                  "shadow-inset flex items-center gap-3 rounded-xl px-4 py-6",
                  ANSWERS_COLORS[i],
                )}
              >
                <Icon className="h-6 w-6 shrink-0 fill-white" />
                <div className="flex flex-1 items-center justify-between gap-1.5 drop-shadow-md">
                  <input
                    className="w-full bg-transparent font-semibold text-white placeholder-white/70 outline-none"
                    placeholder={t("quizz:addAnswerPlaceholder")}
                    value={answer}
                    onChange={(e) => updateAnswer(i, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => toggleSolution(i)}
                    aria-pressed={isSelected}
                    title={t("quizz:markCorrect", "Marquer comme correcte")}
                    className={clsx(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90",
                      isSelected
                        ? "border-white bg-white text-green-600"
                        : "border-white/60 bg-transparent hover:border-white",
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {isSelected && (
                        <motion.span
                          initial={reduceMotion ? false : { scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={reduceMotion ? { opacity: 0 } : { scale: 0 }}
                          transition={{
                            duration: 0.16,
                            ease: [0.34, 1.56, 0.64, 1],
                          }}
                        >
                          <Checkmark />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default QuestionEditorAnswers
