import { useEffect, useState } from "react"

type Props = {
  value: number
  min?: number
  max?: number
  onChange: (_value: number) => void
}

const ConfigNumberInput = ({ value, min, max, onChange }: Props) => {
  const [input, setInput] = useState(String(value))

  useEffect(() => {
    setInput(String(value))
  }, [value])

  const handleChange = (raw: string) => {
    setInput(raw)

    const num = Number(raw)

    if (raw === "" || isNaN(num)) {
      return
    }

    const clamped = Math.min(max ?? num, Math.max(min ?? num, num))
    onChange(clamped)
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={input}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => setInput(String(value))}
      className="border-border text-ink focus:border-primary hover:border-border-strong focus:ring-primary/30 w-full rounded-lg border px-3 py-1.5 text-sm transition-colors outline-none focus:ring-2"
    />
  )
}

export default ConfigNumberInput
