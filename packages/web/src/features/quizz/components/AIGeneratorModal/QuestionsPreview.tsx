import type { Question } from "@rahoot/common/types/game"
import {
  DIFFICULTY_BADGE_CLASSES,
  DIFFICULTY_LABELS,
} from "@rahoot/web/features/quizz/components/AIGeneratorModal/options"
import { Check, Clock, Lightbulb } from "lucide-react"
import { useTranslation } from "react-i18next"

type Props = {
  questions: Question[]
  selected: Set<number>
  onToggle: (_index: number) => void
  onToggleAll: (_selectAll: boolean) => void
  suggestedDescription: string
  useDescription: boolean
  onToggleDescription: () => void
  hasExistingDescription: boolean
}

/** Résumé lisible de la bonne réponse, pour valider une question d'un coup d'œil. */
const summarizeAnswer = (question: Question): string => {
  switch (question.type) {
    case "mcq":
      return question.solutions
        .map((index) => question.answers[index])
        .filter(Boolean)
        .join(", ")

    case "true_false":
      return question.solution === 1 ? "Vrai" : "Faux"

    case "open":
      return question.correctAnswers.join(" / ")

    case "slider":
      return `${question.correctValue} (± ${question.tolerance})`

    case "date":
      return `${question.correctYear} (± ${question.tolerance} ans)`

    case "puzzle":
      return question.items.join(" → ")

    default:
      return ""
  }
}

const QuestionsPreview = ({
  questions,
  selected,
  onToggle,
  onToggleAll,
  suggestedDescription,
  useDescription,
  onToggleDescription,
  hasExistingDescription,
}: Props) => {
  const { t } = useTranslation()
  const allSelected = selected.size === questions.length

  return (
    <div className="space-y-5">
      {suggestedDescription && (
        <button
          type="button"
          onClick={onToggleDescription}
          aria-pressed={useDescription}
          className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
            useDescription
              ? "border-primary bg-primary-soft/40"
              : "border-border hover:bg-border/20"
          }`}
        >
          <span
            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
              useDescription
                ? "bg-primary border-primary text-secondary"
                : "border-border"
            }`}
          >
            {useDescription && <Check className="size-3" strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-ink block text-xs font-bold">
              Description du quiz proposée
            </span>
            <span className="text-ink-muted mt-1 block text-sm italic">
              « {suggestedDescription} »
            </span>
            {hasExistingDescription && (
              <span className="text-ink-subtle mt-1 block text-[11px]">
                Cochez pour remplacer la description actuelle.
              </span>
            )}
          </span>
        </button>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-ink text-sm font-bold">
          {selected.size} / {questions.length} question(s) retenue(s)
        </p>
        <button
          type="button"
          onClick={() => onToggleAll(!allSelected)}
          className="text-ink-muted hover:text-ink text-xs font-semibold underline-offset-2 transition-colors hover:underline"
        >
          {allSelected ? "Tout décocher" : "Tout cocher"}
        </button>
      </div>

      <ul className="space-y-2">
        {questions.map((question, index) => {
          const isSelected = selected.has(index)
          const answer = summarizeAnswer(question)

          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => onToggle(index)}
                aria-pressed={isSelected}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary-soft/40"
                    : "border-border hover:bg-border/20 opacity-60"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    isSelected
                      ? "bg-primary border-primary text-secondary"
                      : "border-border"
                  }`}
                >
                  {isSelected && <Check className="size-3" strokeWidth={3} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="bg-border/40 text-ink-muted rounded px-1.5 py-0.5 text-[10px] font-semibold">
                      {t(`quizz:questionType.${question.type}`)}
                    </span>
                    {question.difficulty && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${DIFFICULTY_BADGE_CLASSES[question.difficulty]}`}
                      >
                        {DIFFICULTY_LABELS[question.difficulty]}
                      </span>
                    )}
                    <span className="text-ink-subtle flex items-center gap-0.5 text-[10px]">
                      <Clock className="size-3" />
                      {question.time}s
                    </span>
                  </span>

                  <span className="text-ink block text-sm font-medium">
                    {question.question}
                  </span>

                  {answer && (
                    <span className="text-ink-subtle mt-1 block truncate text-xs">
                      → {answer}
                    </span>
                  )}

                  {question.answerReveal?.text && (
                    <span className="text-ink-subtle mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug">
                      <Lightbulb className="mt-px size-3 shrink-0" />
                      <span>{question.answerReveal.text}</span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default QuestionsPreview
