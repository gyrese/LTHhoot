import type { PowerUp } from "@rahoot/common/types/powerup"
import {
  POWER_UP_META_UI,
  RARITY_STYLE,
} from "@rahoot/web/features/game/utils/powerupMeta"
import {
  HAPTIC_PATTERNS,
  vibrate,
} from "@rahoot/web/features/game/utils/haptics"
import clsx from "clsx"
import { motion } from "motion/react"
import { useEffect } from "react"

type Props = {
  powerUp: PowerUp
  onDismiss: () => void
}

const DISMISS_MS: Record<string, number> = {
  COMMON: 2500,
  RARE: 3500,
  LEGENDARY: 5000,
}

const PowerUpEarnedToast = ({ powerUp, onDismiss }: Props) => {
  const meta = POWER_UP_META_UI[powerUp.type]
  const style = RARITY_STYLE[meta.rarity]
  const isLegendary = meta.rarity === "LEGENDARY"
  const isRare = meta.rarity === "RARE"

  let rarityIconBg = "bg-slate-500/30"

  if (isLegendary) {
    rarityIconBg = "bg-yellow-500/30"
  } else if (isRare) {
    rarityIconBg = "bg-blue-500/30"
  }

  let rarityTextColor = "text-slate-300"

  if (isLegendary) {
    rarityTextColor = "text-yellow-200"
  } else if (isRare) {
    rarityTextColor = "text-blue-200"
  }

  let rarityLabel = "Commun"

  if (isLegendary) {
    rarityLabel = "✨ Légendaire ✨"
  } else if (isRare) {
    rarityLabel = "★ Rare"
  }

  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_MS[meta.rarity] ?? 3000)

    return () => clearTimeout(timer)
  }, [onDismiss, meta.rarity])

  useEffect(() => {
    // Ce toast n'est monté que côté joueur (cf. GameWrapper.tsx) — pas besoin
    // de vérifier isHost ici.
    vibrate(
      isLegendary
        ? HAPTIC_PATTERNS.POWERUP_LEGENDARY
        : HAPTIC_PATTERNS.POWERUP_RECEIVED,
    )
  }, [isLegendary])

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.5 }}
      animate={{
        y: 0,
        opacity: 1,
        scale: 1,
        ...(isLegendary && { rotate: [0, -2, 2, -1, 0] }),
      }}
      exit={{ y: 40, opacity: 0, scale: 0.8 }}
      transition={{
        type: "spring",
        stiffness: isLegendary ? 300 : 400,
        damping: 22,
        ...(isLegendary && { rotate: { duration: 0.6, delay: 0.2 } }),
      }}
      className="pointer-events-none absolute bottom-36 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap"
    >
      <div
        className={clsx(
          "relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 px-5 py-3 shadow-2xl backdrop-blur-xl",
          style.bg,
          style.border,
          isLegendary && "shadow-yellow-300/60",
          isRare && "shadow-blue-400/40",
        )}
      >
        {/* Halo pour légendaire */}
        {isLegendary && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background:
                "radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)",
            }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <motion.div
          className={clsx(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            rarityIconBg,
          )}
          animate={isLegendary ? { scale: [1, 1.1, 1] } : undefined}
          transition={
            isLegendary
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
        >
          <meta.Icon
            className={clsx("size-6", style.text)}
            style={
              isLegendary
                ? { filter: "drop-shadow(0 0 8px #FBBF24)" }
                : undefined
            }
          />
        </motion.div>

        <div className="relative">
          <p
            className={clsx(
              "text-[10px] font-black tracking-widest uppercase",
              rarityTextColor,
            )}
          >
            {rarityLabel}
          </p>
          <p className="text-base font-extrabold text-white drop-shadow">
            {meta.label}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default PowerUpEarnedToast
