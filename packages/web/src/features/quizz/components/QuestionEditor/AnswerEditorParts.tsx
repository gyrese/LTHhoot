import { FieldErrors, ValidatedInput } from "../EditorValidation"
import { ChevronDown, Minus, Plus } from "lucide-react"
import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"

const answerPanelTheme = {
  "--color-surface": "rgb(255 255 255 / 0.08)",
  "--color-panel": "rgb(255 255 255 / 0.12)",
  "--color-border": "rgb(255 255 255 / 0.2)",
  "--color-border-strong": "rgb(255 255 255 / 0.35)",
  "--color-ink": "#ffffff",
  "--color-ink-muted": "rgb(255 255 255 / 0.85)",
  "--color-ink-subtle": "rgb(255 255 255 / 0.75)",
} as CSSProperties

export const AnswerEditorPanel = ({
  children,
  validationField,
}: {
  children: ReactNode
  validationField?: string
}) => {
  const { t } = useTranslation()
  return (
    <details
      key={validationField}
      open
      data-validation-target={validationField}
      style={answerPanelTheme}
      className="text-ink group relative z-10 w-full rounded-xl border border-white/20 bg-slate-950/60 shadow-lg backdrop-blur-xl"
    >
      <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {t("quizz:previewFlow.answers")}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-border flex max-h-[min(28dvh,16rem)] flex-col gap-2 overflow-y-auto border-t p-3">
        {children}
      </div>
    </details>
  )
}

export const AnswerEditorSection = ({
  title,
  children,
  hint,
  action,
  actionLabel,
}: {
  title: string
  children: ReactNode
  hint?: string
  action?: () => void
  actionLabel?: string
}) => (
  <section className="flex min-w-0 flex-col gap-2">
    <div className="flex min-h-9 items-center justify-between gap-3">
      <h3 className="text-ink text-sm font-semibold">{title}</h3>
      {action && (
        <button
          type="button"
          onClick={action}
          aria-label={actionLabel}
          title={actionLabel}
          className="focus-ring border-border bg-panel text-ink-muted hover:text-ink flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
    {children}
    {hint && <p className="text-ink-muted text-xs">{hint}</p>}
  </section>
)

export const AnswerEditorNumberField = ({
  field,
  label,
  value,
  min,
  max,
  onChange,
}: {
  field: string
  label: string
  value: number
  min?: number
  max?: number
  onChange: (_value: number) => void
}) => {
  const id = useId()
  const [input, setInput] = useState(String(value))

  useEffect(() => {
    setInput(String(value))
  }, [value])

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-ink-muted text-xs font-semibold">
        {label}
      </label>
      <ValidatedInput
        id={id}
        field={field}
        type="number"
        value={input}
        min={min}
        max={max}
        onChange={(event) => {
          const raw = event.target.value
          setInput(raw)
          const next = Number(raw)

          if (raw !== "" && Number.isFinite(next)) {
            onChange(next)
          }
        }}
        onBlur={() => setInput(String(value))}
        className="border-border bg-surface text-ink focus:border-primary focus:ring-primary/30 w-full rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:ring-2"
      />
    </div>
  )
}

export const EditableAnswerList = ({
  field,
  values,
  minimum,
  title,
  placeholder,
  hint,
  onChange,
}: {
  field: string
  values: string[]
  minimum: number
  title: string
  placeholder: string
  hint?: string
  onChange: (_values: string[]) => void
}) => {
  const { t } = useTranslation()

  return (
    <AnswerEditorSection
      title={title}
      hint={hint}
      action={() => onChange([...values, ""])}
      actionLabel={t("quizz:answerEditor.add")}
    >
      <FieldErrors field={field} exact />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {values.map((value, index) => (
          <div key={index} className="flex min-w-0 items-center gap-2">
            <span className="bg-panel text-ink-muted flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums">
              {index + 1}
            </span>
            <ValidatedInput
              field={`${field}.${index}`}
              aria-label={`${placeholder} ${index + 1}`}
              placeholder={placeholder}
              value={value}
              onChange={(event) =>
                onChange(
                  values.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
              className="border-border bg-surface text-ink placeholder:text-ink-muted focus:border-primary focus:ring-primary/30 min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            />
            <button
              type="button"
              disabled={values.length <= minimum}
              onClick={() =>
                onChange(values.filter((_, itemIndex) => itemIndex !== index))
              }
              aria-label={`${t("quizz:answerEditor.remove")} ${index + 1}`}
              title={t("quizz:answerEditor.remove")}
              className="focus-ring border-border text-ink-muted hover:bg-panel hover:text-ink flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </AnswerEditorSection>
  )
}
