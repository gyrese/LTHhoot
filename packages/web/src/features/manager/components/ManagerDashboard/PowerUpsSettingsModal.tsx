import {
  POWER_UP_TYPE,
  POWER_UP_RARITY,
  POWER_UPS_BY_RARITY,
  type PowerUpRarity,
} from "@rahoot/common/types/powerup"
import Modal from "@rahoot/web/components/Modal"
import {
  POWER_UP_META_UI,
  RARITY_STYLE,
} from "@rahoot/web/features/game/utils/powerupMeta"
import clsx from "clsx"
import { X, Sparkles, CheckSquare, Square } from "lucide-react"
import { useTranslation } from "react-i18next"

type Props = {
  onClose: () => void
  powerUpsEnabled: boolean
  onTogglePowerUps: (_enabled: boolean) => void
  disabledPowerUps: string[]
  onChangeDisabledPowerUps: (_disabled: string[]) => void
}

const RARITY_ORDER: PowerUpRarity[] = [
  POWER_UP_RARITY.COMMON,
  POWER_UP_RARITY.RARE,
  POWER_UP_RARITY.LEGENDARY,
]

// Réglage partagé par la partie personnalisée et la soirée : la modale est
// montée par le parent seulement quand elle est ouverte.
const PowerUpsSettingsModal = ({
  onClose,
  powerUpsEnabled,
  onTogglePowerUps,
  disabledPowerUps,
  onChangeDisabledPowerUps,
}: Props) => {
  const { t } = useTranslation()

  const handleTogglePowerUp = (type: string) => {
    if (disabledPowerUps.includes(type)) {
      onChangeDisabledPowerUps(disabledPowerUps.filter((t) => t !== type))
    } else {
      onChangeDisabledPowerUps([...disabledPowerUps, type])
    }
  }

  const handleSelectAll = () => {
    onChangeDisabledPowerUps([])
  }

  const handleSelectNone = () => {
    const all = Object.values(POWER_UP_TYPE) as string[]
    onChangeDisabledPowerUps(all)
  }

  return (
    // Au-dessus de LaunchModal, qui l'ouvre (z-60 > z-50).
    <Modal
      label={t("manager:powerups.modalTitle")}
      onClose={onClose}
      overlayClassName="animate-fade-in z-60 bg-black/60 backdrop-blur-sm"
      className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-yellow-400" />
          <h3 className="text-lg font-black text-white">
            {t("manager:powerups.modalTitle")}
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

      {/* Scrollable grid area */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
        {/* Global toggle */}
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
          <div>
            <p id="powerups-enable-title" className="font-bold text-white">
              {t("manager:powerups.enableTitle")}
            </p>
            <p className="text-xs text-white/60">
              {t("manager:powerups.enableDesc")}
            </p>
          </div>
          <label className="relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              role="switch"
              checked={powerUpsEnabled}
              onChange={(e) => onTogglePowerUps(e.target.checked)}
              aria-labelledby="powerups-enable-title"
              className="peer sr-only"
            />
            {/* Focus clavier visible : anneau orange autour de l'interrupteur. */}
            <div className="peer relative h-6 w-11 rounded-full bg-slate-700 peer-checked:bg-orange-500 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-900 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* Grouped lists */}
        {powerUpsEnabled && (
          <div className="space-y-6">
            <div className="flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className="min-h-8 rounded font-bold text-orange-400 hover:text-orange-300 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
              >
                {t("manager:powerups.selectAll")}
              </button>
              <span className="self-center text-white/30">|</span>
              <button
                type="button"
                onClick={handleSelectNone}
                className="min-h-8 rounded font-bold text-orange-400 hover:text-orange-300 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
              >
                {t("manager:powerups.selectNone")}
              </button>
            </div>

            {RARITY_ORDER.map((rarity) => {
              const style = RARITY_STYLE[rarity]
              const types = POWER_UPS_BY_RARITY[rarity]

              return (
                <div key={rarity} className="space-y-2">
                  <h4
                    className={clsx(
                      "text-xs font-black tracking-wider uppercase",
                      style.text,
                    )}
                  >
                    {style.label}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {types.map((type) => {
                      const meta = POWER_UP_META_UI[type]
                      const isEnabled = !disabledPowerUps.includes(type)

                      return (
                        <button
                          type="button"
                          key={type}
                          onClick={() => handleTogglePowerUp(type)}
                          aria-pressed={isEnabled}
                          className={clsx(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-all select-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none",
                            isEnabled
                              ? "border-white/10 bg-white/5 hover:bg-white/10"
                              : "border-white/5 bg-black/40 opacity-40 hover:opacity-50",
                          )}
                        >
                          <div className="mt-0.5 shrink-0 text-orange-400">
                            {isEnabled ? (
                              <CheckSquare className="size-4" />
                            ) : (
                              <Square className="size-4 text-white/20" />
                            )}
                          </div>
                          <div
                            className={clsx(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                              style.border,
                            )}
                          >
                            <meta.Icon className={clsx("size-4", style.text)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">
                              {meta.label}
                            </p>
                            <p className="line-clamp-2 text-[11px] leading-relaxed text-white/60">
                              {meta.description}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl bg-orange-500 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:outline-none"
        >
          {t("manager:powerups.save")}
        </button>
      </div>
    </Modal>
  )
}

export default PowerUpsSettingsModal
