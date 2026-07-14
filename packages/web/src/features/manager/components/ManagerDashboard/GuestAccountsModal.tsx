import { EVENTS } from "@rahoot/common/constants"
import type { GuestMeta } from "@rahoot/common/types/manager"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { Trash2, Users, UserPlus, X } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type Props = {
  isOpen: boolean
  onClose: () => void
  guests: GuestMeta[]
}

const GuestAccountsModal = ({ isOpen, onClose, guests }: Props) => {
  const { socket } = useSocket()
  const { t, i18n } = useTranslation()
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")

  useEvent(EVENTS.MANAGER.ERROR_MESSAGE, (message) => {
    toast.error(t(message))
  })

  if (!isOpen) {
    return null
  }

  const handleCreate = () => {
    if (!name.trim() || password.length < 4) {
      toast.error(
        t(
          "manager:guest.createInvalid",
          "Nom requis et mot de passe d'au moins 4 caractères",
        ),
      )

      return
    }

    socket?.emit(EVENTS.MANAGER.GUEST_CREATE, {
      name: name.trim(),
      password,
    })
    setName("")
    setPassword("")
  }

  const handleDelete = (id: string) => () => {
    socket?.emit(EVENTS.MANAGER.GUEST_DELETE, id)
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-orange-400" />
            <h3 className="text-lg font-black text-white">
              {t("manager:guest.modalTitle", "Comptes invités")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <p className="text-xs leading-relaxed text-white/50">
            {t(
              "manager:guest.modalDesc",
              "Un compte invité se connecte sur /manager/guest et dispose de sa propre bibliothèque : il crée ses quiz sans voir les vôtres. Vous retrouvez ses quiz dans le dossier « Invités ».",
            )}
          </p>

          {/* Création */}
          <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-4">
            <p className="text-xs font-black tracking-wider text-white/60 uppercase">
              {t("manager:guest.createTitle", "Créer un compte")}
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("manager:guest.namePlaceholder", "Nom du compte")}
              className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 transition-colors outline-none focus:bg-white/15"
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
                placeholder={t(
                  "manager:guest.passwordPlaceholder",
                  "Mot de passe (4 caractères min.)",
                )}
                className="w-full flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 transition-colors outline-none focus:bg-white/15"
              />
              <button
                onClick={handleCreate}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-400"
              >
                <UserPlus className="size-4" />
                {t("manager:guest.create", "Créer")}
              </button>
            </div>
          </div>

          {/* Liste */}
          {guests.length === 0 ? (
            <p className="text-center text-sm text-white/40">
              {t("manager:guest.empty", "Aucun compte invité pour le moment")}
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
                    <p className="text-xs text-white/40">
                      {new Date(guest.createdAt).toLocaleDateString(
                        i18n.language,
                      )}
                    </p>
                  </div>
                  <AlertDialog
                    trigger={
                      <button
                        className="rounded-lg p-2 text-red-400 transition-colors hover:bg-white/10"
                        title={t("common:delete")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    }
                    title={t("manager:guest.delete", "Supprimer le compte")}
                    description={t("manager:guest.deleteConfirm", {
                      name: guest.name,
                      defaultValue:
                        "Supprimer le compte « {{name}} » ? Sa bibliothèque de quiz sera aussi supprimée.",
                    })}
                    confirmLabel={t("common:delete")}
                    onConfirm={handleDelete(guest.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GuestAccountsModal
