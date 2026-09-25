import { useEffect, useRef, type PropsWithChildren } from "react"

// Native modal dialogs isolate the background and manage keyboard focus.
export default function EditorDialog({
  children,
  label,
  onClose,
  fullscreen = false,
}: PropsWithChildren<{
  label: string
  onClose?: () => void
  fullscreen?: boolean
}>) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      dialog?.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={label}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault()
        onClose?.()
      }}
      className={
        fullscreen
          ? "bg-surface text-ink m-0 h-dvh max-h-none w-screen max-w-none p-0 backdrop:bg-black/60"
          : "text-ink m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-auto rounded-xl bg-transparent p-0 backdrop:bg-black/60"
      }
    >
      {children}
    </dialog>
  )
}
