import { POWER_UP_CATALOG, type PowerUp } from "@rahoot/common/types/powerup"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import { POWER_UP_META_UI, RARITY_STYLE } from "@rahoot/web/features/game/utils/powerupMeta"
import clsx from "clsx"
import { X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { useState } from "react"

type OtherPlayer = { id: string; username: string; avatar?: string }

type Props = {
  powerUp: PowerUp | null
  players: OtherPlayer[]
  onConfirm: (_targetIds?: string[]) => void
  onCancel: () => void
}

const PowerUpConfirmDrawer = ({ powerUp, players, onConfirm, onCancel }: Props) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const meta = powerUp ? POWER_UP_META_UI[powerUp.type] : null
  const targeting = powerUp ? POWER_UP_CATALOG[powerUp.type].target : null
  const style = meta ? RARITY_STYLE[meta.rarity] : null

  let requiredTargets = 0

  if (targeting === "ONE_OPPONENT") {
    requiredTargets = 1
  } else if (targeting === "TWO_OPPONENTS") {
    requiredTargets = 2
  }

  let bgRarityColor = "rgba(148,163,184,0.25)"

  if (meta?.rarity === "LEGENDARY") {
    bgRarityColor = "rgba(251,191,36,0.25)"
  } else if (meta?.rarity === "RARE") {
    bgRarityColor = "rgba(96,165,250,0.25)"
  }

  let rarityTextColor = "text-slate-300"

  if (meta?.rarity === "LEGENDARY") {
    rarityTextColor = "text-yellow-200"
  } else if (meta?.rarity === "RARE") {
    rarityTextColor = "text-blue-200"
  }

  const canConfirm = requiredTargets === 0 || selectedIds.length === requiredTargets

  const handleClose = () => {
    setSelectedIds([])
    onCancel()
  }

  const handleConfirm = () => {
    if (!powerUp || !canConfirm) {
      return
    }

    const ids = selectedIds.length > 0 ? selectedIds : undefined
    setSelectedIds([])
    onConfirm(ids)
  }

  const toggleTarget = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id)
      }

      if (prev.length >= requiredTargets) {
        // Remplacer le plus ancien sélectionné
        return [...prev.slice(1), id]
      }

      return [...prev, id]
    })
  }

  return (
    <AnimatePresence>
      {powerUp && meta && style && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className={clsx(
              "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t-2 p-6 backdrop-blur-xl",
              style.bg,
              style.border,
            )}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    "flex h-14 w-14 items-center justify-center rounded-2xl border-2",
                    style.border,
                  )}
                  style={{
                    background: bgRarityColor,
                  }}
                >
                  <meta.Icon
                    className={clsx("size-7", style.text)}
                    style={meta.rarity === "LEGENDARY" ? { filter: "drop-shadow(0 0 6px #FBBF24)" } : undefined}
                  />
                </div>
                <div>
                  <p
                    className={clsx(
                      "text-[10px] font-black uppercase tracking-widest",
                      rarityTextColor,
                    )}
                  >
                    {style.label}
                  </p>
                  <p className="text-xl font-black text-white">{meta.label}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-xl p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-white/70">{meta.description}</p>

            {requiredTargets > 0 && players.length > 0 && (
              <div className="mb-4 max-h-44 overflow-y-auto">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/50">
                  {requiredTargets === 1 ? "Choisir une cible" : `Choisir ${requiredTargets} cibles`}
                  {selectedIds.length > 0 && (
                    <span className="ml-2 text-white/30">({selectedIds.length}/{requiredTargets})</span>
                  )}
                </p>
                <div className="flex flex-col gap-2">
                  {players.map((p) => {
                    const selected = selectedIds.includes(p.id)

                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleTarget(p.id)}
                        className={clsx(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "bg-orange-500/20 ring-1 ring-orange-500/60"
                            : "bg-white/5 hover:bg-white/10",
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
                          <GameAvatar seed={p.avatar ?? p.username} className="h-full w-full" />
                        </div>
                        <p className={clsx("flex-1 text-sm font-bold", selected ? "text-orange-300" : "text-white")}>
                          {p.username}
                        </p>
                        {selected && <div className="h-2 w-2 rounded-full bg-orange-500" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {targeting === "LEADER_AUTO" && (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/60">
                ⚡ Cible automatique : le leader actuel du classement
              </div>
            )}

            {targeting === "ALL_OPPONENTS" && (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/60">
                💥 Affecte TOUS les adversaires
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-bold text-white/60 transition-colors hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={clsx(
                  "flex-1 rounded-2xl py-3 text-sm font-bold text-white transition-all",
                  canConfirm
                    ? "bg-orange-500 hover:scale-[1.02] hover:bg-orange-400 shadow-lg shadow-orange-500/30"
                    : "cursor-not-allowed bg-white/10 text-white/30",
                )}
              >
                Utiliser
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default PowerUpConfirmDrawer
