import type { PropsWithChildren, ReactNode } from "react"

type LabelProps = {
  icon: ReactNode
  label: string
  unit?: string
}

const Label = ({ icon, label, unit = "sec" }: LabelProps) => (
  <div className="text-ink flex items-center gap-2 text-sm font-semibold">
    <span className="text-ink-subtle">{icon}</span>
    {label}
    {unit && (
      <span className="text-ink-subtle text-xs font-normal">({unit})</span>
    )}
  </div>
)

const Description = ({ children }: { children: string }) => (
  <p className="text-ink-subtle text-xs leading-relaxed">{children}</p>
)

const ConfigField = ({ children }: PropsWithChildren) => (
  <div className="flex flex-col gap-1.5">{children}</div>
)

ConfigField.Label = Label
ConfigField.Description = Description

export default ConfigField
