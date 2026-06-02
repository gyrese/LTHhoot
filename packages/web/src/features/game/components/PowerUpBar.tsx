import type { PowerUp } from "@rahoot/common/types/powerup"
import { POWER_UP_META_UI, RARITY_STYLE } from "@rahoot/web/features/game/utils/powerupMeta"
import clsx from "clsx"
import { motion, AnimatePresence } from "motion/react"

type Props = {
  powerUps: PowerUp[]
  onUse: (_powerUp: PowerUp) => void
  compact?: boolean
}

// Re-export pour compat
export { POWER_UP_META_UI as POWER_UP_META }

const PowerUpBar = ({ powerUps, onUse, compact = false }: Props) => {
  const slots = Array.from({ length: 3 }, (_, i) => powerUps[i] ?? null)
  const slotSize = compact ? "h-11 w-11" : "h-14 w-14"
  const iconSize = compact ? "size-5" : "size-7"

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {slots.map((powerUp, i) => {
          if (!powerUp) {
            return (
              <div
                key={`empty-${i}`}
                className={clsx("rounded-xl border border-white/10 bg-white/5", slotSize)}
              />
            )
          }

          const meta = POWER_UP_META_UI[powerUp.type]
          const style = RARITY_STYLE[meta.rarity]
          const isLegendary = meta.rarity === "LEGENDARY"

          return (
            <motion.button
              key={powerUp.id}
              initial={{ y: 30, opacity: 0, scale: 0.8 }}
              animate={{
                y: 0,
                opacity: 1,
                scale: 1,
                ...(isLegendary && {
                  boxShadow: [
                    "0 0 8px rgba(251, 191, 36, 0.4)",
                    "0 0 16px rgba(251, 191, 36, 0.7)",
                    "0 0 8px rgba(251, 191, 36, 0.4)",
                  ],
                }),
              }}
              exit={{ y: 20, opacity: 0, scale: 0.8 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
                ...(isLegendary && {
                  boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                }),
              }}
              onClick={() => onUse(powerUp)}
              className={clsx(
                "relative flex items-center justify-center rounded-xl border-2 backdrop-blur-sm transition-transform active:scale-90",
                slotSize,
                style.bg,
                style.border,
                isLegendary && "shadow-lg",
              )}
              title={`${meta.label} — ${style.label}`}
              aria-label={meta.label}
            >
              <meta.Icon
                className={clsx(iconSize, style.text)}
                style={isLegendary ? { filter: "drop-shadow(0 0 6px #FBBF24)" } : undefined}
              />
              <span
                className={clsx(
                  "absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-black/40",
                  meta.rarity === "COMMON" && "bg-slate-300",
                  meta.rarity === "RARE" && "bg-blue-400",
                  isLegendary && "bg-yellow-300",
                )}
              />
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default PowerUpBar
