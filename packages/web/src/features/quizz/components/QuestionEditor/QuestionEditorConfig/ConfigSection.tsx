import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState, type PropsWithChildren, type ReactNode } from "react"
import clsx from "clsx"

type Props = PropsWithChildren<{
  title: string
  icon?: ReactNode
  defaultOpen?: boolean
}>

const ConfigSection = ({
  title,
  icon,
  defaultOpen = true,
  children,
}: Props) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const reduceMotion = useReducedMotion()

  return (
    <div className="border-border/70 border-b last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="focus-ring group flex w-full items-center justify-between gap-2 rounded-md py-3"
      >
        <span className="flex items-center gap-2">
          {icon && (
            <span className="text-ink-subtle group-hover:text-primary-ink transition-colors">
              {icon}
            </span>
          )}
          <span className="text-ink text-sm font-semibold">{title}</span>
        </span>
        <ChevronDown
          className={clsx(
            "text-ink-subtle size-4 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={
              reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }
            }
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ConfigSection
