import { useEffect, useId, type InputHTMLAttributes } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, CheckCircle2, ChevronRight, X } from "lucide-react"
import { useQuizzEditor } from "../contexts/quizz-editor-context"
import EditorDialog from "./EditorDialog"

export function FieldErrors({
  field,
  exact = false,
}: {
  field: string
  exact?: boolean
}) {
  const { validationIssues, currentIndex } = useQuizzEditor()
  const { t } = useTranslation()
  const path = `questions.${currentIndex}.${field}`
  const errors = validationIssues.filter(
    (issue) =>
      issue.path === path || (!exact && issue.path.startsWith(`${path}.`)),
  )
  if (!errors.length) {
    return null
  }
  return (
    <div className="bg-surface text-danger mt-1 rounded px-2 py-1 text-xs leading-relaxed">
      {errors.map((issue, index) => (
        <p key={`${issue.path}-${index}`}>
          {issue.field} : {t(issue.message, issue.message)}
        </p>
      ))}
    </div>
  )
}

export function ValidatedInput({
  field,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { field: string }) {
  const { validationIssues, currentIndex } = useQuizzEditor()
  const path = `questions.${currentIndex}.${field}`
  const id = useId()
  const invalid = validationIssues.some(
    (issue) => issue.path === path || issue.path.startsWith(`${path}.`),
  )
  return (
    <div className="min-w-0 flex-1">
      <input
        {...props}
        className={`${props.className ?? ""} w-full min-w-0`}
        data-validation-target={path}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [props["aria-describedby"], invalid ? id : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      <div id={id}>
        <FieldErrors field={field} />
      </div>
    </div>
  )
}

// Focus only after the issue dialog has closed and the destination is mounted.
export function ValidationFocus() {
  const { validationTarget } = useQuizzEditor()
  useEffect(() => {
    if (!validationTarget) {
      return () => undefined
    }
    let frame = 0
    let attempts = 0
    const focus = () => {
      const dialogs = document.querySelectorAll<HTMLElement>(
        'dialog[open], [role="dialog"][aria-modal="true"]',
      )
      const root = dialogs[dialogs.length - 1] ?? document
      const targets = Array.from(
        root.querySelectorAll<HTMLElement>("[data-validation-target]"),
      ).filter((el) => el.getClientRects().length > 0)
      const target =
        targets.find(
          (el) => el.dataset.validationTarget === validationTarget.path,
        ) ??
        targets
          .filter((el) =>
            validationTarget.path.startsWith(`${el.dataset.validationTarget}.`),
          )
          .sort(
            (a, b) =>
              (b.dataset.validationTarget?.length ?? 0) -
              (a.dataset.validationTarget?.length ?? 0),
          )[0]
      if (
        target &&
        (target.dataset.validationTarget === validationTarget.path ||
          attempts >= 15)
      ) {
        target.scrollIntoView({ block: "nearest", inline: "nearest" })
        const control = target.matches("input, textarea, select, button")
          ? target
          : target.querySelector<HTMLElement>(
              "input, textarea, select, button, [tabindex]",
            )
        ;(control ?? target).focus({ preventScroll: true })
      } else {
        attempts += 1
        if (attempts < 30) {
          frame = requestAnimationFrame(focus)
        }
      }
    }
    frame = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(frame)
  }, [validationTarget])
  return null
}

export default function EditorValidation() {
  const {
    validationIssues,
    showValidation,
    setShowValidation,
    goToIssue,
    questions,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const groups = new Map<number | undefined, typeof validationIssues>()
  for (const issue of validationIssues) {
    const group = groups.get(issue.questionIndex) ?? []
    group.push(issue)
    groups.set(issue.questionIndex, group)
  }
  const orderedGroups = [...groups.entries()].sort(
    ([left], [right]) => (left ?? -1) - (right ?? -1),
  )
  return (
    <>
      <ValidationFocus />
      {showValidation && (
        <EditorDialog
          label="Points à corriger"
          onClose={() => setShowValidation(false)}
        >
          <section className="bg-surface flex max-h-[85dvh] flex-col">
            <div className="border-border flex items-center justify-between gap-4 border-b p-4">
              <h2 className="text-ink text-lg font-bold">
                Points à corriger ({validationIssues.length})
              </h2>
              <button
                type="button"
                autoFocus
                className="focus-ring rounded p-2"
                aria-label="Fermer"
                onClick={() => setShowValidation(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-auto p-4">
              {validationIssues.length ? (
                <>
                  <p className="text-ink-muted mb-4 text-sm">
                    Corrigez les points ci-dessous pour enregistrer le quiz.
                    Chaque ligne ouvre le champ concerné. Les problèmes corrigés
                    disparaissent de cette liste.
                  </p>
                  <div className="flex flex-col gap-5">
                    {orderedGroups.map(([questionIndex, issues]) => (
                      <section
                        key={questionIndex ?? "quiz"}
                        aria-label={
                          questionIndex === undefined
                            ? "Réglages du quiz"
                            : `Diapositive ${questionIndex + 1}`
                        }
                      >
                        <h3 className="text-ink flex items-start justify-between gap-3 text-sm font-semibold">
                          <span className="min-w-0">
                            {questionIndex === undefined
                              ? "Réglages du quiz"
                              : `Diapositive ${questionIndex + 1}`}{" "}
                            {questionIndex !== undefined &&
                              questions[questionIndex]?.question?.trim() && (
                                <span
                                  className="text-ink-muted mt-0.5 block truncate text-xs font-normal"
                                  title={questions[questionIndex].question}
                                >
                                  {questions[questionIndex].question}
                                </span>
                              )}
                          </span>
                          <span
                            aria-label={`${issues.length} problème(s)`}
                            className="bg-danger-soft text-danger shrink-0 rounded px-1.5 py-0.5 text-xs tabular-nums"
                          >
                            {issues.length}
                          </span>
                        </h3>
                        <ul className="divide-border mt-2 divide-y">
                          {issues.map((issue, index) => (
                            <li key={`${issue.path}-${index}`}>
                              <button
                                type="button"
                                onClick={() => goToIssue(issue)}
                                aria-label={`Corriger ${issue.field} : ${t(issue.message, issue.message)}`}
                                className="focus-ring hover:bg-panel flex w-full items-start gap-3 rounded-md px-2 py-3 text-left"
                              >
                                <AlertTriangle className="text-danger mt-0.5 size-4 shrink-0" />
                                <span>
                                  <span className="text-ink block text-sm font-semibold">
                                    {issue.field}
                                  </span>
                                  <span className="text-ink-muted block text-sm">
                                    {t(issue.message, issue.message)}
                                  </span>
                                </span>
                                <ChevronRight
                                  aria-hidden="true"
                                  className="text-ink-muted mt-0.5 ml-auto size-4 shrink-0"
                                />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-ink flex items-center gap-2 text-sm">
                  <CheckCircle2 className="text-success size-5" />
                  Aucun point bloquant. Le quiz peut être enregistré.
                </p>
              )}
            </div>
          </section>
        </EditorDialog>
      )}
    </>
  )
}
