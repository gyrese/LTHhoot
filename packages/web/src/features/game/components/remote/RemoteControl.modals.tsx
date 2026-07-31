import { useTranslation } from "react-i18next"

// Confirmation générique de la télécommande (expulsion, fin de session,
// coupure du temps) — remplace les window.confirm natifs, inutilisables au
// doigt et non stylables.
export function ConfirmModal({
  title,
  highlight,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  highlight?: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 text-center">
          <div className="mb-2 text-3xl">⚠️</div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {highlight && (
            <p className="mt-1 font-semibold text-orange-400">{highlight}</p>
          )}
          <p className="mt-1 text-sm text-white/35">{message}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl bg-white/8 py-3 font-semibold text-white transition-colors hover:bg-white/15"
          >
            {t("common:cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-red-500 py-3 font-bold text-white transition-colors hover:bg-red-400 active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
