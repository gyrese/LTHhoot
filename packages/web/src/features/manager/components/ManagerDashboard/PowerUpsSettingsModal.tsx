import {
  POWER_UP_TYPE,
  POWER_UP_RARITY,
  POWER_UPS_BY_RARITY,
  type PowerUpRarity,
} from "@rahoot/common/types/powerup"
import { POWER_UP_META_UI, RARITY_STYLE } from "@rahoot/web/features/game/utils/powerupMeta"
import clsx from "clsx"
import { X, Sparkles, CheckSquare, Square } from "lucide-react"
import { useTranslation } from "react-i18next"

type Props = {
  isOpen: boolean
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

const PowerUpsSettingsModal = ({
  isOpen,
  onClose,
  powerUpsEnabled,
  onTogglePowerUps,
  disabledPowerUps,
  onChangeDisabledPowerUps,
}: Props) => {
  const { t } = useTranslation()

  if (!isOpen) {
    return null
  }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-yellow-400" />
            <h3 className="text-lg font-black text-white">
              {t("manager:powerups.modalTitle", "Configuration des Power-ups")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable grid area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Global toggle */}
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 border border-white/5">
            <div>
              <p className="font-bold text-white">
                {t("manager:powerups.enableTitle", "Activer les Power-ups")}
              </p>
              <p className="text-xs text-white/50">
                {t("manager:powerups.enableDesc", "Permet aux joueurs d'acheter des power-ups à la boutique.")}
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={powerUpsEnabled}
                onChange={(e) => onTogglePowerUps(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-orange-500 peer-checked:after:translate-x-full peer-focus:outline-none" />
            </label>
          </div>

          {/* Grouped lists */}
          {powerUpsEnabled && (
            <div className="space-y-6">
              <div className="flex justify-end gap-3 text-xs">
                <button
                  onClick={handleSelectAll}
                  className="text-orange-400 hover:text-orange-300 font-bold"
                >
                  {t("manager:powerups.selectAll", "Tout cocher")}
                </button>
                <span className="text-white/20">|</span>
                <button
                  onClick={handleSelectNone}
                  className="text-orange-400 hover:text-orange-300 font-bold"
                >
                  {t("manager:powerups.selectNone", "Tout décocher")}
                </button>
              </div>

              {RARITY_ORDER.map((rarity) => {
                const style = RARITY_STYLE[rarity]
                const types = POWER_UPS_BY_RARITY[rarity]

                return (
                  <div key={rarity} className="space-y-2">
                    <h4 className={clsx("text-xs font-black uppercase tracking-wider", style.text)}>
                      {style.label}
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {types.map((type) => {
                        const meta = POWER_UP_META_UI[type]
                        const isEnabled = !disabledPowerUps.includes(type)

                        return (
                          <div
                            key={type}
                            onClick={() => handleTogglePowerUp(type)}
                            className={clsx(
                              "flex items-start gap-3 rounded-xl border p-3 cursor-pointer select-none transition-all",
                              isEnabled
                                ? "bg-white/5 border-white/10 hover:bg-white/10"
                                : "bg-black/40 border-white/5 opacity-40 hover:opacity-50"
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
                                style.border
                              )}
                            >
                              <meta.Icon
                                className={clsx("size-4", style.text)}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white">
                                {meta.label}
                              </p>
                              <p className="line-clamp-2 text-[10px] text-white/50 leading-relaxed">
                                {meta.description}
                              </p>
                            </div>
                          </div>
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
            onClick={onClose}
            className="rounded-xl bg-orange-500 hover:bg-orange-400 px-6 py-2 text-sm font-bold text-white transition-colors"
          >
            {t("manager:powerups.save", "Enregistrer")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PowerUpsSettingsModal
