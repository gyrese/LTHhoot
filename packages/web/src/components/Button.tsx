import clsx from "clsx"
import type { ButtonHTMLAttributes, PropsWithChildren } from "react"
import { twMerge } from "tailwind-merge"

type Size = "sm" | "md" | "lg"

/**
 * `play` = style historique skeuomorphe (jeu / Kahoot-like), conservé par
 * défaut pour ne pas régresser l'UI du jeu. Les autres variants composent le
 * système de design de l'éditeur (tokens + feedback `:active` + focus-ring).
 */
type Variant = "play" | "primary" | "secondary" | "ghost" | "subtle" | "danger"

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  PropsWithChildren & {
    size?: Size
    variant?: Variant
    classNameContent?: string
  }

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1 text-sm",
  md: "p-2 text-lg",
  lg: "px-5 py-3 text-xl",
}

const variantClasses: Record<Variant, string> = {
  // Historique : ombre inset + texte blanc sur orange (jeu). Inchangé.
  play: "btn-shadow bg-primary rounded-md font-semibold text-white",
  // Action principale éditeur : orange marque + encre near-black (contraste AA).
  primary:
    "focus-ring rounded-lg bg-primary font-semibold text-secondary shadow-sm transition-transform duration-150 ease-out-soft hover:brightness-[1.03] active:scale-[0.97]",
  // Action neutre : surface claire + bordure token.
  secondary:
    "focus-ring rounded-lg border border-border bg-surface font-semibold text-ink transition-[transform,background-color,border-color] duration-150 ease-out-soft hover:border-border-strong hover:bg-panel active:scale-[0.97]",
  // Action tertiaire : sans fond, se révèle au survol.
  ghost:
    "focus-ring rounded-lg font-semibold text-ink-muted transition-[transform,background-color,color] duration-150 ease-out-soft hover:bg-panel hover:text-ink active:scale-[0.97]",
  // Accent doux : teinte orange (export, actions secondaires accentuées).
  subtle:
    "focus-ring rounded-lg bg-primary-soft font-semibold text-primary-ink transition-transform duration-150 ease-out-soft hover:brightness-[0.98] active:scale-[0.97]",
  // Destructif sobre.
  danger:
    "focus-ring rounded-lg bg-danger-soft font-semibold text-danger transition-transform duration-150 ease-out-soft hover:brightness-[0.98] active:scale-[0.97]",
}

const Button = ({
  children,
  className,
  classNameContent,
  size = "md",
  variant = "play",
  ...otherProps
}: Props) => (
  <button
    className={twMerge(
      clsx(variantClasses[variant], sizeClasses[size], className),
    )}
    {...otherProps}
  >
    <div
      className={twMerge(
        clsx(
          "btn-content flex items-center justify-center gap-2",
          classNameContent,
        ),
      )}
    >
      {children}
    </div>
  </button>
)

export default Button
