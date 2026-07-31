import { STATUS, type Status } from "@rahoot/common/types/game/status"
import type { RoundEventType } from "@rahoot/common/types/round-event"
import {
  ROUND_EVENT_LIST,
  ROUND_EVENT_META,
} from "@rahoot/web/features/game/utils/roundEventMeta"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

// États « entre deux questions » : les seuls où armer un événement a du sens,
// puisqu'il sera consommé par la question suivante. SHOW_ROOM en est exclu —
// sa barre d'action porte déjà « Mode Démo » + « Démarrer » et n'a plus la
// place ; le salon expose l'entrée dans son propre panneau.
const ARMABLE_STATUSES: Status[] = [
  STATUS.SHOW_RESPONSES,
  STATUS.SHOW_LEADERBOARD,
]

export function canArmRoundEvent(statusName?: Status): boolean {
  return Boolean(statusName && ARMABLE_STATUSES.includes(statusName))
}

export function ArmEventButton({
  armedEvent,
  onOpen,
}: {
  armedEvent: RoundEventType | null
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const meta = armedEvent ? ROUND_EVENT_META[armedEvent] : null

  return (
    <button
      onClick={onOpen}
      aria-label={t("game:roundEvent.arm")}
      className={clsx(
        "flex h-12 min-w-[52px] items-center justify-center rounded-2xl border text-xl transition-all active:scale-95",
        meta
          ? clsx(meta.accent, meta.border, meta.text)
          : "border-white/10 bg-white/8 text-white/50 hover:bg-white/15",
      )}
    >
      {meta ? meta.icon : "⚡"}
    </button>
  )
}

export function ArmedEventBanner({
  armedEvent,
  onCancel,
}: {
  armedEvent: RoundEventType
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const meta = ROUND_EVENT_META[armedEvent]

  return (
    <div
      className={clsx(
        "mb-3 flex items-center gap-3 rounded-2xl border px-4 py-3",
        meta.accent,
        meta.border,
      )}
    >
      <span className="text-2xl">{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={clsx("text-sm font-black uppercase", meta.text)}>
          {t(meta.labelKey)}
        </p>
        <p className="truncate text-xs text-white/50">
          {t("game:roundEvent.armed")}
        </p>
      </div>
      <button
        onClick={onCancel}
        aria-label={t("game:roundEvent.cancel")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg text-white/60 transition-colors hover:bg-white/20"
      >
        ✕
      </button>
    </div>
  )
}

export function RoundEventDrawer({
  armedEvent,
  onSelect,
  onClose,
}: {
  armedEvent: RoundEventType | null
  onSelect: (_eventType: RoundEventType | null) => void
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-white">
          {t("game:roundEvent.drawerTitle")}
        </h3>
        <p className="mt-1 text-sm text-white/35">
          {t("game:roundEvent.drawerHint")}
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {ROUND_EVENT_LIST.map((eventType) => {
            const meta = ROUND_EVENT_META[eventType]
            const isArmed = armedEvent === eventType

            return (
              <button
                key={eventType}
                onClick={() => onSelect(isArmed ? null : eventType)}
                className={clsx(
                  "flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all active:scale-95",
                  isArmed
                    ? clsx(meta.accent, meta.border)
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                <span className="text-2xl">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      "font-bold",
                      isArmed ? meta.text : "text-white",
                    )}
                  >
                    {t(meta.labelKey)}
                  </p>
                  <p className="text-xs text-white/40">{t(meta.hintKey)}</p>
                </div>
                {isArmed && (
                  <span className={clsx("text-lg", meta.text)}>✓</span>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-white/8 py-3 font-semibold text-white transition-colors hover:bg-white/15"
        >
          {t("common:cancel")}
        </button>
      </div>
    </div>
  )
}
