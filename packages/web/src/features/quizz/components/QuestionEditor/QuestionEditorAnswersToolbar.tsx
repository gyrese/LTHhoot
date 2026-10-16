import { EVENTS } from "@rahoot/common/constants"
import type { McqQuestion } from "@rahoot/common/types/game"
import { MAX_MCQ_ANSWERS } from "@rahoot/common/utils/question-layout"
import { resizeLayoutAnswers } from "@rahoot/web/features/game/utils/question-layout"
import EditorDialog from "@rahoot/web/features/quizz/components/EditorDialog"
import { FieldErrors, ValidatedInput } from "../EditorValidation"
import {
  moveMcqAnswer,
  removeMcqAnswer,
} from "@rahoot/web/features/quizz/utils/mcq-answer-actions"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import {
  ArrowDown,
  ArrowUp,
  Check,
  List,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

// Barre d'outils des réponses de QCM (nombre, ajout / retrait, suggestions IA).
// Les cases elles-mêmes sont éditées sur la diapositive (QuestionLayoutEditor).
const QuestionEditorAnswersToolbar = () => {
  const {
    currentQuestion,
    currentIndex,
    updateQuestion,
    questions,
    validationTarget,
  } = useQuizzEditor()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [showManager, setShowManager] = useState(false)
  // Slide capturé À L'ENVOI (index + id) : la réponse IA arrive 1-3 s plus
  // tard, et l'utilisateur peut avoir changé de slide entre-temps — remplir le
  // `currentIndex` de réception écraserait les réponses du mauvais slide.
  const pendingRef = useRef<{ index: number; id: string } | null>(null)
  // This component is only rendered when type === "mcq" (enforced by QuestionEditor switch)
  const mcq = currentQuestion as McqQuestion & { id: string }
  useEffect(() => {
    if (
      validationTarget?.questionIndex === currentIndex &&
      /^questions\.\d+\.(answers|solutions)(\.|$)/u.test(validationTarget.path)
    ) {
      setShowManager(true)
    }
  }, [validationTarget, currentIndex])

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
    const patch = removeMcqAnswer(mcq, mcq.answers.length - 1)
    if (patch) {
      updateQuestion(currentIndex, patch)
    }
  }

  const moveAnswer = (index: number, direction: -1 | 1) => {
    const patch = moveMcqAnswer(mcq, index, direction)
    if (patch) {
      updateQuestion(currentIndex, patch)
    }
  }

  const toggleCorrect = (index: number) => {
    const next = mcq.solutions.includes(index)
      ? mcq.solutions.filter((solution) => solution !== index)
      : [...mcq.solutions, index]
    if (next.length > 0) {
      updateQuestion(currentIndex, { solutions: next })
    }
  }

  const ctrlBtn =
    "focus-ring text-ink-muted hover:bg-panel hover:text-ink flex size-7 items-center justify-center rounded-md transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-30"

  return (
    <>
      <div className="bg-surface/90 flex items-center gap-1 rounded-lg p-1 shadow-sm backdrop-blur-sm">
        <span className="text-ink-muted px-1.5 text-sm font-semibold">
          {mcq.answers.length}
          {t("quizz:answersCountSuffix")}
        </span>
        <button
          type="button"
          onClick={removeAnswer}
          disabled={mcq.answers.length <= 2}
          className={ctrlBtn}
          aria-label={t("quizz:removeAnswer")}
          title={t("quizz:removeAnswer")}
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={addAnswer}
          disabled={mcq.answers.length >= MAX_MCQ_ANSWERS}
          className={ctrlBtn}
          aria-label={t("quizz:addAnswer")}
          title={t("quizz:addAnswer")}
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowManager(true)}
          className="focus-ring text-ink-muted hover:bg-panel hover:text-ink flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors"
          aria-haspopup="dialog"
        >
          <List className="size-4" />
          {t("quizz:answerManager.manage")}
        </button>
        <button
          type="button"
          onClick={handleSuggestWrongAnswers}
          disabled={!canSuggestWrongAnswers || isSuggesting}
          className={clsx(ctrlBtn, "text-primary")}
          aria-label={t("quizz:question.aiSuggestWrongAnswers")}
          title={t("quizz:question.aiSuggestWrongAnswers")}
        >
          {isSuggesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </button>
      </div>

      {showManager && (
        <EditorDialog
          label={t("quizz:answerManager.title")}
          onClose={() => setShowManager(false)}
        >
          <section className="bg-surface flex max-h-[90dvh] flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-ink text-base font-semibold">
                {t("quizz:answerManager.title")}
              </h2>
              <button
                type="button"
                onClick={() => setShowManager(false)}
                className="focus-ring text-ink-muted hover:bg-panel rounded-md p-2"
                aria-label={t("common:close")}
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-ink-muted text-xs">
              {t("quizz:answerManager.hint")}
            </p>
            <FieldErrors field="solutions" />
            <ol className="flex min-h-0 flex-col gap-2 overflow-auto">
              {mcq.answers.map((answer, index) => (
                <li
                  key={`${mcq.id}-${index}`}
                  className="border-border bg-panel rounded-lg border p-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-ink-muted w-5 shrink-0 text-center text-xs font-bold tabular-nums">
                      {index + 1}
                    </span>
                    <ValidatedInput
                      field={`answers.${index}`}
                      type="text"
                      autoFocus={index === 0}
                      value={answer}
                      onChange={(event) =>
                        updateQuestion(currentIndex, {
                          answers: mcq.answers.map((value, answerIndex) =>
                            answerIndex === index ? event.target.value : value,
                          ),
                        })
                      }
                      placeholder={t("quizz:addAnswerPlaceholder")}
                      aria-label={t("quizz:answerManager.answerNumber", {
                        number: index + 1,
                      })}
                      className="focus-ring border-border bg-surface text-ink min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(index)}
                      aria-pressed={mcq.solutions.includes(index)}
                      data-validation-target={
                        index === 0
                          ? `questions.${currentIndex}.solutions`
                          : undefined
                      }
                      aria-label={`${t("quizz:markCorrect")} ${index + 1}`}
                      className={clsx(
                        "focus-ring flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                        mcq.solutions.includes(index)
                          ? "bg-primary-soft text-primary-ink"
                          : "text-ink-muted hover:bg-surface",
                      )}
                    >
                      <Check className="size-3.5" />
                      {t("quizz:answerManager.correct")}
                    </button>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveAnswer(index, -1)}
                      aria-label={`${t("common:moveUp")} ${index + 1}`}
                      className={ctrlBtn}
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === mcq.answers.length - 1}
                      onClick={() => moveAnswer(index, 1)}
                      aria-label={`${t("common:moveDown")} ${index + 1}`}
                      className={ctrlBtn}
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={mcq.answers.length <= 2}
                      onClick={() => {
                        const patch = removeMcqAnswer(mcq, index)
                        if (patch) {
                          updateQuestion(currentIndex, patch)
                        }
                      }}
                      aria-label={`${t("quizz:removeAnswer")} ${index + 1}`}
                      className={clsx(ctrlBtn, "hover:text-danger")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={addAnswer}
              disabled={mcq.answers.length >= MAX_MCQ_ANSWERS}
              className="focus-ring border-border text-primary-ink hover:bg-primary-soft flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-sm font-semibold disabled:opacity-40"
            >
              <Plus className="size-4" />
              {t("quizz:addAnswer")}
            </button>
          </section>
        </EditorDialog>
      )}
    </>
  )
}

export default QuestionEditorAnswersToolbar
