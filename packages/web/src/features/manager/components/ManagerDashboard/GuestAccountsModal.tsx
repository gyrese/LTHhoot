import { EVENTS } from "@rahoot/common/constants"
import type { GuestMeta } from "@rahoot/common/types/manager"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import Modal from "@rahoot/web/components/Modal"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { translateServerError } from "@rahoot/web/features/manager/utils/errors"
import { Loader2, Trash2, Users, UserPlus, X } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type Props = {
  onClose: () => void
  guests: GuestMeta[]
}

// Montée par le parent seulement quand elle est ouverte.
const GuestAccountsModal = ({ onClose, guests }: Props) => {
  const { socket } = useSocket()
  const { t, i18n } = useTranslation()
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  // Création / suppression en attente de confirmation du serveur : il ne
  // renvoie pas d'accusé, seulement la config à jour (ou un message d'erreur).
  const [pendingCreate, setPendingCreate] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  useEffect(() => {
    if (pendingCreate && guests.some((g) => g.name === pendingCreate)) {
      // Le formulaire n'est vidé qu'une fois le compte réellement créé : en
      // cas de refus (nom déjà pris…), la saisie reste corrigeable.
      toast.success(t("manager:guest.created", { name: pendingCreate }))
      setName("")
      setPassword("")
      setPendingCreate(null)
    }

    if (pendingDelete && !guests.some((g) => g.id === pendingDelete)) {
      toast.success(t("manager:guest.deleted"))
      setPendingDelete(null)
    }
  }, [guests])

  useEvent(EVENTS.MANAGER.ERROR_MESSAGE, (message) => {
    setPendingCreate(null)
    setPendingDelete(null)
    toast.error(translateServerError(t, message))
  })

  const handleCreate = () => {
    if (pendingCreate) {
      return
    }

    if (!name.trim() || password.length < 4) {
      toast.error(t("manager:guest.createInvalid"))

      return
    }

    setPendingCreate(name.trim())
    socket?.emit(EVENTS.MANAGER.GUEST_CREATE, {
      name: name.trim(),
      password,
    })
  }

  const handleDelete = (id: string) => () => {
    setPendingDelete(id)
    socket?.emit(EVENTS.MANAGER.GUEST_DELETE, id)
  }

  return (
    <Modal
      label={t("manager:guest.modalTitle")}
      onClose={onClose}
      overlayClassName="animate-fade-in z-50 bg-black/60 backdrop-blur-sm"
      className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-orange-400" />
          <h3 className="text-lg font-black text-white">
            {t("manager:guest.modalTitle")}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("manager:actions.close")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
        <p className="text-xs leading-relaxed text-white/60">
          {t("manager:guest.modalDesc")}
        </p>

        {/* Création */}
        <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-4">
          <p className="text-xs font-black tracking-wider text-white/60 uppercase">
            {t("manager:guest.createTitle")}
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("manager:guest.namePlaceholder")}
            aria-label={t("manager:guest.namePlaceholder")}
            data-autofocus
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 transition-colors outline-none focus:bg-white/15 focus:ring-2 focus:ring-orange-400/60"
          />
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreate()
                }
              }}
              placeholder={t("manager:guest.passwordPlaceholder")}
              aria-label={t("manager:guest.passwordPlaceholder")}
              className="w-full flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 transition-colors outline-none focus:bg-white/15 focus:ring-2 focus:ring-orange-400/60"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={Boolean(pendingCreate)}
              aria-busy={Boolean(pendingCreate)}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
            >
              {pendingCreate ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {t("manager:guest.create")}
            </button>
          </div>
        </div>

        {/* Liste */}
        {guests.length === 0 ? (
          <p className="text-center text-sm text-white/60">
            {t("manager:guest.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {guests.map((guest) => (
              <div
                key={guest.id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {guest.name}
                  </p>
                  <p className="text-xs text-white/60">
                    {new Date(guest.createdAt).toLocaleDateString(
                      i18n.language,
                    )}
                  </p>
                </div>
                <AlertDialog
                  trigger={
                    <button
                      type="button"
                      disabled={pendingDelete === guest.id}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none disabled:opacity-50"
                      title={t("manager:guest.delete")}
                      aria-label={t("manager:guest.deleteNamed", {
                        name: guest.name,
                      })}
                    >
                      {pendingDelete === guest.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  }
                  title={t("manager:guest.delete")}
                  description={t("manager:guest.deleteConfirm", {
                    name: guest.name,
                  })}
                  confirmLabel={t("common:delete")}
                  onConfirm={handleDelete(guest.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default GuestAccountsModal
