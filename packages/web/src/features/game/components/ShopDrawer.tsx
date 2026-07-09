import {
  POWER_UP_RARITY,
  POWER_UPS_BY_RARITY,
  getPowerUpPrice,
  type PowerUpRarity,
  type PowerUpType,
} from "@rahoot/common/types/powerup"
import {
  POWER_UP_META_UI,
  RARITY_STYLE,
} from "@rahoot/web/features/game/utils/powerupMeta"
import clsx from "clsx"
import { Coins, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { useTranslation } from "react-i18next"

const MAX_POWER_UPS = 3

type Props = {
  open: boolean
  coins: number
  inventoryCount: number
  disabledPowerUps?: string[]
  onBuy: (_type: PowerUpType) => void
  onClose: () => void
}

const RARITY_ORDER: PowerUpRarity[] = [
  POWER_UP_RARITY.COMMON,
  POWER_UP_RARITY.RARE,
  POWER_UP_RARITY.LEGENDARY,
]

const ShopDrawer = ({
  open,
  coins,
  inventoryCount,
  disabledPowerUps = [],
  onBuy,
  onClose,
}: Props) => {
  const { t } = useTranslation()
  const inventoryFull = inventoryCount >= MAX_POWER_UPS

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t-2 border-yellow-500/40 bg-slate-900/90 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-black tracking-widest text-yellow-300/70 uppercase">
                  {t("game:shop.subtitle", "Dépense tes pièces")}
                </p>
                <p className="text-xl font-black text-white">
                  {t("game:shop.title", "Boutique")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-xl bg-yellow-500/20 px-3 py-2 text-base font-black text-yellow-300 ring-1 ring-yellow-500/40">
                  <Coins className="size-5" />
                  <span className="tabular-nums">{coins}</span>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-xl p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {inventoryFull && (
              <div className="shrink-0 border-b border-white/10 bg-orange-500/10 px-5 py-2 text-center text-xs font-bold text-orange-300">
                {t(
                  "game:shop.inventoryFull",
                  "Inventaire plein (3/3) — utilise un power-up avant d'en acheter",
                )}
              </div>
            )}

            {/* Liste par rareté */}
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {RARITY_ORDER.map((rarity) => {
                const style = RARITY_STYLE[rarity]
                const items = POWER_UPS_BY_RARITY[rarity].filter(
                  (type) => !disabledPowerUps.includes(type),
                )

                if (items.length === 0) {
                  return null
                }

                return (
                  <div key={rarity}>
                    <p
                      className={clsx(
                        "mb-2 px-1 text-xs font-black tracking-widest uppercase",
                        style.text,
                      )}
                    >
                      {style.label}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {items.map((type) => {
                        const meta = POWER_UP_META_UI[type]
                        const price = getPowerUpPrice(type)
                        const affordable = coins >= price
                        const canBuy = affordable && !inventoryFull

                        return (
                          <div
                            key={type}
                            className={clsx(
                              "flex items-center gap-3 rounded-2xl border p-3",
                              style.bg,
                              style.border,
                            )}
                          >
                            <div
                              className={clsx(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                                style.border,
                              )}
                            >
                              <meta.Icon
                                className={clsx("size-5", style.text)}
                                style={
                                  rarity === "LEGENDARY"
                                    ? { filter: "drop-shadow(0 0 6px #FBBF24)" }
                                    : undefined
                                }
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-white">
                                {meta.label}
                              </p>
                              <p className="line-clamp-2 text-xs text-white/50">
                                {meta.description}
                              </p>
                            </div>
                            <button
                              onClick={() => canBuy && onBuy(type)}
                              disabled={!canBuy}
                              className={clsx(
                                "flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-black transition-all",
                                canBuy
                                  ? "bg-yellow-500 text-slate-900 hover:scale-105 hover:bg-yellow-400 active:scale-95"
                                  : "cursor-not-allowed bg-white/5 text-white/30",
                              )}
                              title={
                                affordable
                                  ? t("game:shop.buy", "Acheter")
                                  : t(
                                      "game:shop.notEnough",
                                      "Pièces insuffisantes",
                                    )
                              }
                            >
                              <Coins className="size-3.5" />
                              <span className="tabular-nums">{price}</span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ShopDrawer
