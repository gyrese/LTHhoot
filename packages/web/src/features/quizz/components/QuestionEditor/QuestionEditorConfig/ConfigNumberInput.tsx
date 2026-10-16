import { useEffect, useState, type InputHTMLAttributes } from "react"
import { ValidatedInput } from "../../EditorValidation"

type Props = {
  field?: string
  value: number
  min?: number
  max?: number
  onChange: (_value: number) => void
}

const ConfigNumberInput = ({ value, min, max, onChange, field }: Props) => {
  const [input, setInput] = useState(String(value))

  useEffect(() => {
    setInput(String(value))
  }, [value])

  const handleChange = (raw: string) => {
    setInput(raw)

    const num = Number(raw)

    if (raw.trim() === "" || !Number.isFinite(num)) {
      return
    }

    if (
      (min === undefined || num >= min) &&
      (max === undefined || num <= max)
    ) {
      onChange(num)
    }
  }

  const props: InputHTMLAttributes<HTMLInputElement> = {
    type: "number",
    min,
    max,
    value: input,
    onChange: (event) => handleChange(event.target.value),
    onBlur: () => {
      const num = Number(input)
      if (input.trim() === "" || !Number.isFinite(num)) {
        setInput(String(value))
        return
      }
      const clamped = Math.min(max ?? num, Math.max(min ?? num, num))
      setInput(String(clamped))
      if (clamped !== value) {
        onChange(clamped)
      }
    },
    className:
      "border-border text-ink focus:border-primary hover:border-border-strong focus:ring-primary/30 w-full rounded-lg border px-3 py-1.5 text-sm transition-colors outline-none focus:ring-2",
  }
  return field ? (
    <ValidatedInput field={field} {...props} />
  ) : (
    <input {...props} />
  )
}

export default ConfigNumberInput
