import type { FastModeIntensity } from "@rahoot/common/types/fast-mode"
import type { QuizzMeta } from "@rahoot/common/types/game"
import FastModeToggle from "./FastModeToggle"
import { Loader2, Play, X, PartyPopper, Sparkles, TimerOff } from "lucide-react"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

type Props = {
  eveningQuizIds: string[]
  quizzList: QuizzMeta[]
  powerUpsEnabled: boolean
  noSpeedMode: boolean
  fastMode: boolean
  fastModeIntensity: FastModeIntensity
  onRemove: (_id: string) => void
  onStart: () => void
  // Lancement déjà demandé / socket coupé : « Démarrer la soirée » bloqué.
  isStarting: boolean
  isConnected: boolean
  onToggleOff: () => void
  onOpenPowerUpsConfig: () => void
  onToggleNoSpeed: () => void
  onToggleFastMode: () => void
  onFastModeIntensityChange: (_intensity: FastModeIntensity) => void
}

const EveningFooter = ({
  eveningQuizIds,
  quizzList,
  powerUpsEnabled,
  noSpeedMode,
  fastMode,
  fastModeIntensity,
  onRemove,
  onStart,
  isStarting,
  isConnected,
  onToggleOff,
  onOpenPowerUpsConfig,
  onToggleNoSpeed,
  onToggleFastMode,
  onFastModeIntensityChange,
}: Props) => {
  const { t } = useTranslation()
  const canStart = eveningQuizIds.length >= 2 && !isStarting && isConnected

  const totalQuestions = quizzList
    .filter((q) => eveningQuizIds.includes(q.id))
    .reduce((acc, _q) => acc, 0)

  return (
    // Deux lignes sous ~1100 px (sélection, puis réglages + lancement) : sur
    // une seule ligne `h-20`, les 7 contrôles débordaient de l'écran.
    <footer className="relative z-10 flex shrink-0 flex-col gap-2 border-t border-white/10 bg-black/30 px-3 py-2 backdrop-blur-md min-[1100px]:h-20 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:gap-3 min-[1100px]:px-4 min-[1100px]:py-0">
      <div className="flex min-w-0 items-center gap-2 min-[1100px]:flex-1 min-[1100px]:gap-3">
        {/* Badge mode soirée */}
        <button
          type="button"
          onClick={onToggleOff}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-orange-500/20 px-3 py-2 text-sm font-bold text-orange-300 ring-1 ring-orange-500/40 transition-colors hover:bg-orange-500/30 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
          title={t("manager:evening.disable")}
          aria-label={t("manager:evening.disable")}
        >
          <PartyPopper className="size-4" />
          <span className="hidden sm:inline">{t("manager:evening.mode")}</span>
          <X className="size-3 opacity-70" />
        </button>

        {/* Liste des quiz sélectionnés */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
          {eveningQuizIds.length === 0 && (
            <p className="text-sm text-white/60">
              {t("manager:evening.selectTwo")}
            </p>
          )}
          {eveningQuizIds.map((id, index) => {
            const quiz = quizzList.find((q) => q.id === id)

            if (!quiz) {
              return null
            }

            return (
              <div
                key={id}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 py-1 pr-1 pl-2 text-xs font-medium text-white ring-1 ring-white/10"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[11px] font-black text-white">
                  {index + 1}
                </span>
                <span className="max-w-[120px] truncate">{quiz.subject}</span>
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  aria-label={t("manager:evening.remove", {
                    name: quiz.subject,
                  })}
                  title={t("manager:evening.remove", { name: quiz.subject })}
                  className="flex min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-full text-orange-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-11"
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Infos + CTA */}
      <div className="flex flex-wrap items-center justify-end gap-2 min-[1100px]:shrink-0 min-[1100px]:flex-nowrap min-[1100px]:gap-3">
        {totalQuestions > 0 && (
          <p className="text-xs text-white/60">{eveningQuizIds.length} quiz</p>
        )}

        {/* Mode sans rapidité */}
        <button
          type="button"
          onClick={onToggleNoSpeed}
          aria-pressed={noSpeedMode}
          aria-label={t("manager:noSpeed.label")}
          className={clsx(
            "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors select-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none",
            noSpeedMode
              ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40 hover:bg-sky-500/30"
              : "bg-white/5 text-white/60 ring-1 ring-white/10 hover:bg-white/10",
          )}
          title={t("manager:noSpeed.hint")}
        >
          <TimerOff className="size-3.5" />
          <span className="hidden sm:inline">{t("manager:noSpeed.label")}</span>
        </button>

        {/* Mode rapide */}
        <FastModeToggle
          fastMode={fastMode}
          intensity={fastModeIntensity}
          onToggle={onToggleFastMode}
          onIntensityChange={onFastModeIntensityChange}
        />

        {/* Configure power-ups */}
        <button
          type="button"
          onClick={onOpenPowerUpsConfig}
          aria-label={t("manager:evening.powerUpsToggle")}
          className={clsx(
            "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors select-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none",
            powerUpsEnabled
              ? "bg-yellow-500/20 text-yellow-200 ring-1 ring-yellow-500/40 hover:bg-yellow-500/30"
              : "bg-white/5 text-white/60 ring-1 ring-white/10 hover:bg-white/10",
          )}
          title={t("manager:evening.powerUpsToggle")}
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">
            {t("manager:evening.powerUps")}
          </span>
        </button>

        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          aria-busy={isStarting}
          className={clsx(
            "flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:outline-none",
            canStart
              ? "bg-orange-500 shadow-lg shadow-orange-500/30 hover:scale-105 hover:bg-orange-400"
              : "cursor-not-allowed bg-white/10 text-white/40",
          )}
        >
          {isStarting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
          {t("manager:evening.start")}
        </button>
      </div>
    </footer>
  )
}

export default EveningFooter
