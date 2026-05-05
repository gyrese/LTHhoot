import { ChevronDown, ChevronUp } from "lucide-react"
import { useState, type PropsWithChildren } from "react"

type Props = PropsWithChildren<{
  title: string
  defaultOpen?: boolean
}>

const ConfigSection = ({ title, defaultOpen = true, children }: Props) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 last:border-0 last:pb-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between group cursor-pointer"
      >
        <h3 className="text-sm font-bold tracking-wide text-gray-500 uppercase group-hover:text-gray-700 transition-colors">
          {title}
        </h3>
        {isOpen ? (
          <ChevronUp className="size-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        ) : (
          <ChevronDown className="size-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        )}
      </button>
      {isOpen && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  )
}

export default ConfigSection
