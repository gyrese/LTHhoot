import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import clsx from "clsx"
import type { ReactNode } from "react"

type Props = {
  icon: ReactNode
  label: string
  checked: boolean
  onChange: (_value: boolean) => void
  description?: string
}

/**
 * Interrupteur de configuration réutilisable (extrait des deux toggles dupliqués
 * de l'inspecteur). Accent orange unique, accessible (role=switch + aria).
 */
const ConfigToggle = ({ icon, label, checked, onChange, description }: Props) => (
  <ConfigField>
    <div className="flex items-center justify-between gap-3">
      <ConfigField.Label icon={icon} label={label} unit="" />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx(
          "focus-ring relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150",
          checked ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          className={clsx(
            "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-150",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
    {description && <ConfigField.Description>{description}</ConfigField.Description>}
  </ConfigField>
)

export default ConfigToggle
