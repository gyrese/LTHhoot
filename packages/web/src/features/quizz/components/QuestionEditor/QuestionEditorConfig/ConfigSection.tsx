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
        className="group flex w-full cursor-pointer items-center justify-between"
      >
        <h3 className="text-sm font-bold tracking-wide text-gray-500 uppercase transition-colors group-hover:text-gray-700">
          {title}
        </h3>
        {isOpen ? (
          <ChevronUp className="size-4 text-gray-400 transition-colors group-hover:text-gray-600" />
        ) : (
          <ChevronDown className="size-4 text-gray-400 transition-colors group-hover:text-gray-600" />
        )}
      </button>
      {isOpen && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  )
}

export default ConfigSection
