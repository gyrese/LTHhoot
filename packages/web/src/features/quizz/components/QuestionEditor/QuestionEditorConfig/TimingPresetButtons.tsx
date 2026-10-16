import clsx from "clsx"
import { useTranslation } from "react-i18next"

type Props = {
  label: string
  value: number
  presets: readonly number[]
  onSelect: (_seconds: number) => void
}

const TimingPresetButtons = ({ label, value, presets, onSelect }: Props) => {
  const { t } = useTranslation()

  return (
    <div
      role="group"
      aria-label={t("quizz:question.config.quickDurations", { field: label })}
      className="grid grid-cols-4 gap-1.5"
    >
      {presets.map((seconds) => (
        <button
          key={seconds}
          type="button"
          aria-pressed={value === seconds}
          aria-label={t("quizz:question.config.chooseDuration", {
            field: label,
            seconds,
          })}
          onClick={() => onSelect(seconds)}
          className={clsx(
            "focus-ring rounded-md border px-1 py-1.5 text-xs font-semibold tabular-nums transition-colors",
            value === seconds
              ? "border-primary bg-primary-soft text-primary-ink"
              : "border-border bg-surface text-ink-muted hover:border-primary hover:text-ink",
          )}
        >
          {seconds} s
        </button>
      ))}
    </div>
  )
}

export default TimingPresetButtons
