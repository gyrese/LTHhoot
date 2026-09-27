import clsx from "clsx"
import { Check, X } from "lucide-react"
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ElementType,
  PropsWithChildren,
} from "react"

// Couleur des formes / textes sur fond clair (slate-900).
const DARK_TEXT_COLOR = "#0f172a"

const childrenSizeClass = (text: string): string => {
  if (text.length > 50) {
    return "text-base leading-tight md:text-lg"
  }

  if (text.length > 25) {
    return "text-xl md:text-2xl"
  }

  return "text-3xl md:text-4xl"
}

type Props = PropsWithChildren &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: ElementType
    correct?: boolean
    iconOnly?: boolean
    index?: number
    // Texte et forme sombres (fond clair comme le jaune) pour garder un
    // contraste lisible au vidéoprojecteur.
    darkText?: boolean
    // Pas d'animation d'entrée propre : le parent anime déjà l'apparition.
    noEntrance?: boolean
    // Couleurs personnalisées dans l'éditeur (mise en page de la question) :
    // remplacent la couleur de la case et celle du texte / de la forme.
    fillColor?: string
    textColor?: string
  }

const AnswerButton = ({
  className,
  icon: Icon,
  children,
  correct,
  iconOnly,
  index,
  darkText,
  noEntrance,
  fillColor,
  textColor,
  style,
  ...otherProps
}: Props) => {
  const CorrectIcon = correct ? Check : X
  const contentColor = textColor ?? (darkText ? DARK_TEXT_COLOR : undefined)

  const animStyle: CSSProperties = {
    ...style,
    backgroundColor: fillColor,
    animationDelay:
      index !== undefined && !noEntrance ? `${index * 0.08}s` : undefined,
  }

  return (
    <button
      className={clsx(
        "shadow-inset flex items-center rounded px-4 py-6",
        !noEntrance && "anim-pop-in",
        "transition-[opacity,filter] duration-700 hover:scale-[1.02] active:scale-95",
        correct === true && "anim-glow",
        correct === false && "opacity-40 grayscale",
        iconOnly ? "justify-center" : "gap-3 text-left",
        className,
      )}
      style={animStyle}
      {...otherProps}
    >
      <Icon
        className={clsx("shrink-0", iconOnly ? "h-10 w-10" : "h-6 w-6")}
        fill={contentColor}
      />
      {!iconOnly && (
        <p
          className={clsx(
            "w-full flex-1 font-black tracking-tight break-words transition-all duration-300",
            darkText ? "text-slate-900" : "text-white",
            children && typeof children === "string"
              ? childrenSizeClass(children)
              : "text-3xl md:text-4xl",
          )}
          style={{
            color: textColor,
            textShadow: darkText ? undefined : "0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          {children}
        </p>
      )}
      {!iconOnly && correct !== undefined && (
        <CorrectIcon
          className={clsx(
            "size-8 shrink-0 stroke-6 drop-shadow-md",
            darkText ? "text-slate-900" : "text-white",
          )}
          style={{ color: textColor }}
          aria-hidden="true"
        />
      )}
    </button>
  )
}

export default AnswerButton
