import clsx from "clsx"
import { Check, X } from "lucide-react"
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ElementType,
  PropsWithChildren,
} from "react"

type Props = PropsWithChildren &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: ElementType
    correct?: boolean
    iconOnly?: boolean
    index?: number
  }

const AnswerButton = ({
  className,
  icon: Icon,
  children,
  correct,
  iconOnly,
  index,
  style,
  ...otherProps
}: Props) => {
  const CorrectIcon = correct ? Check : X

  const animStyle: CSSProperties = {
    ...style,
    animationDelay: index !== undefined ? `${index * 0.08}s` : undefined,
  }

  return (
    <button
      className={clsx(
        "shadow-inset anim-pop-in flex items-center rounded px-4 py-6 transition-transform duration-150",
        "hover:scale-[1.02] active:scale-95",
        correct === true && "anim-glow",
        correct === false && "opacity-65 grayscale-[40%]",
        iconOnly ? "justify-center" : "gap-3 text-left",
        className,
      )}
      style={animStyle}
      {...otherProps}
    >
      <Icon className={clsx("shrink-0", iconOnly ? "h-10 w-10" : "h-6 w-6")} />
      {!iconOnly && (
        <p
          className={clsx(
            "w-full flex-1 break-words font-black text-white transition-all duration-300 tracking-tight",
            children && typeof children === "string" 
              ? children.length > 50 
                ? "text-base leading-tight md:text-lg" 
                : children.length > 25
                  ? "text-xl md:text-2xl"
                  : "text-3xl md:text-4xl"
              : "text-3xl md:text-4xl"
          )}
          style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
        >
          {children}
        </p>
      )}
      {!iconOnly && correct !== undefined && <CorrectIcon className="size-8 shrink-0 stroke-6 text-white drop-shadow-md" />}
    </button>
  )
}

export default AnswerButton
