import type { PowerUpEffect } from "@rahoot/common/types/powerup"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
import { POWER_UP_META_UI, RARITY_STYLE } from "@rahoot/web/features/game/utils/powerupMeta"
import { HAPTIC_PATTERNS, vibrate } from "@rahoot/web/features/game/utils/haptics"
import clsx from "clsx"
import { motion } from "motion/react"
import { useEffect } from "react"

type Props = {
  effect: PowerUpEffect
}

const PowerUpEffectToast = ({ effect }: Props) => {
  const meta = POWER_UP_META_UI[effect.type]
  const { isHost } = useGameConfig()

  useEffect(() => {
    if (!isHost) {
      vibrate(HAPTIC_PATTERNS.POWERUP_RECEIVED)
    }
  }, [isHost])

  if (!meta) {
    return null
  }

  const style = RARITY_STYLE[meta.rarity]
  const activator = effect.activatedByUsername ?? "Un joueur"
  const targets = effect.affectedPlayers
    .filter((p) => p.username !== activator)
    .map((p) => p.username)
    .filter((v, i, arr) => arr.indexOf(v) === i)

  let bgRarityColor = "rgba(148,163,184,0.3)"

  if (meta.rarity === "LEGENDARY") {
    bgRarityColor = "rgba(251,191,36,0.3)"
  } else if (meta.rarity === "RARE") {
    bgRarityColor = "rgba(96,165,250,0.3)"
  }

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={clsx(
        "pointer-events-auto flex items-center gap-3 rounded-2xl border-2 px-4 py-3 backdrop-blur-xl shadow-2xl",
        style.bg,
        style.border,
      )}
    >
      <div
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          style.border,
        )}
        style={{
          background: bgRarityColor,
        }}
      >
        <meta.Icon className={clsx("size-5", style.text)} />
      </div>
      <div className="flex flex-col">
        <p className="text-sm font-extrabold text-white">
          {activator} → <span className={style.text}>{meta.label}</span>
        </p>
        {targets.length > 0 && (
          <p className="text-xs text-white/60">
            {effect.mirrored ? "Renvoyé sur " : "Sur "}
            {targets.join(", ")}
          </p>
        )}
        {targets.length === 0 && effect.affectedPlayers.length === 0 && (
          <p className="text-xs text-white/60">Effet personnel</p>
        )}
      </div>
    </motion.div>
  )
}

export default PowerUpEffectToast
