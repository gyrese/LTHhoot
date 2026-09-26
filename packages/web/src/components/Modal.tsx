import clsx from "clsx"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type PropsWithChildren,
} from "react"
import { createPortal } from "react-dom"

type Props = PropsWithChildren<{
  // Nom accessible de la boîte de dialogue (lu par les lecteurs d'écran).
  label: string
  onClose: () => void
  // Classes du panneau (role="dialog") : chaque modale garde son apparence.
  className?: string
  // Classes du fond plein écran (couleur, flou, z-index…).
  overlayClassName?: string
  // Un clic sur le fond ferme la modale (désactivable pour les écrans où une
  // fermeture accidentelle ferait perdre une saisie).
  closeOnOverlay?: boolean
}>

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

// Pile des modales ouvertes : seule celle du dessus réagit à Échap et piège
// le focus (LaunchModal ouvre par exemple PowerUpsSettingsModal par-dessus).
const stack: symbol[] = []

const getFocusable = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )

/**
 * Primitive de modale du manager.
 *
 * Rendue dans `document.body` via un portal : les panneaux du dashboard
 * portent un `backdrop-blur`, qui fait d'eux le bloc conteneur de leurs
 * descendants `position: fixed` — sans portal la modale serait rognée.
 *
 * Gère Échap, le focus initial (`[data-autofocus]`, sinon le premier élément
 * focusable), le piège de focus (Tab / Maj+Tab) et la restauration du focus à
 * la fermeture. Un `<dialog>` natif n'est pas utilisé ici : il place la
 * modale dans la « top layer » et rendrait inertes les AlertDialog Radix
 * (portés dans `body`) ouverts depuis ces modales.
 */
const Modal = ({
  label,
  onClose,
  className,
  overlayClassName,
  closeOnOverlay = true,
  children,
}: Props) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const id = Symbol("modal")
    const panel = panelRef.current
    const previous = document.activeElement as HTMLElement | null
    stack.push(id)

    const initial =
      panel?.querySelector<HTMLElement>("[data-autofocus]:not([disabled])") ??
      (panel ? getFocusable(panel)[0] : null) ??
      panel
    initial?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!panel || stack[stack.length - 1] !== id) {
        return
      }

      const active = document.activeElement
      // Focus dans une couche tierce (AlertDialog Radix ouvert depuis la
      // modale) : c'est elle qui gère le clavier.
      const isForeign =
        active !== null && active !== document.body && !panel.contains(active)

      if (isForeign) {
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        onCloseRef.current()

        return
      }

      if (e.key !== "Tab") {
        return
      }

      const focusable = getFocusable(panel)

      if (focusable.length === 0) {
        e.preventDefault()
        panel.focus()

        return
      }

      const [first] = focusable
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (!panel.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      const index = stack.indexOf(id)

      if (index >= 0) {
        stack.splice(index, 1)
      }

      if (previous?.isConnected) {
        previous.focus()
      }
    }
  }, [])

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    // Les clics venus d'un portal enfant (AlertDialog) remontent aussi par
    // l'arbre React : on ne ferme que sur un clic direct sur le fond.
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div
      className={clsx(
        "fixed inset-0 flex items-center justify-center p-4",
        overlayClassName ?? "z-50 bg-black/60 backdrop-blur-sm",
      )}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={clsx("outline-none", className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
