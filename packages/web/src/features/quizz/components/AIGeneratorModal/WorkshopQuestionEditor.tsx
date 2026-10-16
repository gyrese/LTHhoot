import { useId, useState } from "react"
import { questionValidator } from "@rahoot/common/validators/quizz"
import type { Question } from "@rahoot/common/types/game"

const inputClass =
  "focus-ring border-border bg-surface text-ink w-full rounded-md border px-2.5 py-2 text-sm"

export default function WorkshopQuestionEditor({
  question,
  onSave,
  disabled,
}: {
  question: Question
  onSave: (_question: Question) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState(question)
  const [error, setError] = useState("")
  const id = useId()
  const update = (patch: object) =>
    setDraft((prev) => ({ ...prev, ...patch }) as Question)
  const lines = (label: string, value: string[], key: string) => (
    <label className="block space-y-1 text-xs font-semibold">
      <span>{label}</span>
      <textarea
        className={inputClass}
        rows={4}
        value={value.join("\n")}
        onChange={(e) => update({ [key]: e.target.value.split("\n") })}
      />
    </label>
  )
  const number = (label: string, key: string, value: number | undefined) => (
    <label className="block space-y-1 text-xs font-semibold">
      <span>{label}</span>
      <input
        type="number"
        className={inputClass}
        value={value ?? ""}
        onChange={(e) =>
          update({
            [key]: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
      />
    </label>
  )
  return (
    <form
      className="mt-3"
      onSubmit={(event) => {
        event.preventDefault()
        const parsed = questionValidator.safeParse(draft)
        if (!parsed.success) {
          setError(
            "Vérifiez les réponses, la bonne réponse et les valeurs saisies.",
          )
          return
        }
        onSave(parsed.data as Question)
        setError("")
      }}
    >
      <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
        <label
          htmlFor={`${id}-question`}
          className="block text-xs font-semibold"
        >
          Question
        </label>
        <textarea
          id={`${id}-question`}
          className={inputClass}
          rows={2}
          value={draft.question}
          onChange={(e) => update({ question: e.target.value })}
        />
        {draft.type === "mcq" && (
          <div className="space-y-2">
            {draft.answers.map((answer, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Bonne réponse ${index + 1}`}
                  className="accent-primary size-4 shrink-0"
                  checked={draft.solutions.includes(index)}
                  onChange={() =>
                    update({
                      solutions: draft.solutions.includes(index)
                        ? draft.solutions.filter((n) => n !== index)
                        : [...draft.solutions, index],
                    })
                  }
                />
                <input
                  aria-label={`Réponse ${index + 1}`}
                  className={inputClass}
                  value={answer}
                  onChange={(e) =>
                    update({
                      answers: draft.answers.map((value, i) =>
                        i === index ? e.target.value : value,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
        {draft.type === "true_false" && (
          <label className="block space-y-1 text-xs font-semibold">
            <span>Bonne réponse</span>
            <select
              className={inputClass}
              value={draft.solution}
              onChange={(e) => update({ solution: Number(e.target.value) })}
            >
              <option value={0}>Faux</option>
              <option value={1}>Vrai</option>
            </select>
          </label>
        )}
        {draft.type === "open" &&
          lines(
            "Réponses acceptées · une par ligne",
            draft.correctAnswers,
            "correctAnswers",
          )}
        {draft.type === "puzzle" &&
          lines(
            "Éléments dans le bon ordre · un par ligne",
            draft.items,
            "items",
          )}
        {draft.type === "date" && (
          <div className="grid grid-cols-2 gap-2">
            {number("Année correcte", "correctYear", draft.correctYear)}
            {number("Tolérance (années)", "tolerance", draft.tolerance)}
            {number("Année minimum", "minYear", draft.minYear)}
            {number("Année maximum", "maxYear", draft.maxYear)}
          </div>
        )}
        {draft.type === "slider" && (
          <div className="grid grid-cols-2 gap-2">
            {number("Valeur correcte", "correctValue", draft.correctValue)}
            {number("Tolérance", "tolerance", draft.tolerance)}
            {number("Minimum", "min", draft.min)}
            {number("Maximum", "max", draft.max)}
          </div>
        )}
        {draft.type !== "title" &&
          number("Temps de réponse (secondes)", "time", draft.time)}
        <label className="block space-y-1 text-xs font-semibold">
          <span>Explication de la réponse</span>
          <textarea
            className={inputClass}
            rows={2}
            value={draft.answerReveal?.text ?? ""}
            onChange={(e) =>
              update({
                answerReveal: {
                  ...draft.answerReveal,
                  text: e.target.value,
                  enabled: Boolean(e.target.value.trim()),
                },
              })
            }
          />
        </label>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="focus-ring bg-primary text-secondary rounded-md px-3 py-2 text-sm font-semibold"
        >
          Appliquer les modifications
        </button>
      </fieldset>
    </form>
  )
}
