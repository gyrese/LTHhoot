import {
  FAST_MODE_INTENSITY,
  type FastModeIntensity,
} from "@rahoot/common/types/fast-mode"
import clsx from "clsx"
import {
  Play,
  PlayCircle,
  Settings2,
  Sparkles,
  TimerOff,
  X,
  Zap,
} from "lucide-react"
import { useTranslation } from "react-i18next"

type Props = {
  isOpen: boolean
  onClose: () => void
  quizzName?: string
  isGuest: boolean
  fastMode: boolean
  onToggleFastMode: (_enabled: boolean) => void
  fastModeIntensity: FastModeIntensity
  onIntensityChange: (_intensity: FastModeIntensity) => void
  noSpeedMode: boolean
  onToggleNoSpeed: (_enabled: boolean) => void
  powerUpsEnabled: boolean
  onOpenPowerUpsConfig: () => void
  onStart: () => void
}

const INTENSITIES: { value: FastModeIntensity; key: string }[] = [
  { value: FAST_MODE_INTENSITY.SMOOTH, key: "smooth" },
  { value: FAST_MODE_INTENSITY.NERVOUS, key: "nervous" },
  { value: FAST_MODE_INTENSITY.HURRY_UP, key: "hurryUp" },
]

/**
 * Modale de lancement d'une partie simple.
 *
 * Regroupe les réglages qui s'entassaient dans la barre du bas (rythme, score,
 * bonus) : ils y étaient invisibles tant qu'on ne les cherchait pas, et sans
 * place pour en ajouter. Le mode Soirée garde son propre footer — il sera repris
 * séparément avec un fonctionnement différent.
 *
 * Aucun état local : tout est piloté par le parent. La modale est donc toujours
 * synchrone avec les réglages réels, y compris si l'un d'eux change pendant
 * qu'elle est ouverte (cf. le piège « modale montée en permanence » de
 * tasks/lessons.md).
 */
const LaunchModal = ({
  isOpen,
  onClose,
  quizzName,
  isGuest,
  fastMode,
  onToggleFastMode,
  fastModeIntensity,
  onIntensityChange,
  noSpeedMode,
  onToggleNoSpeed,
  powerUpsEnabled,
  onOpenPowerUpsConfig,
  onStart,
}: Props) => {
  const { t } = useTranslation()

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("manager:launch.title")}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-white/40 uppercase">
              {t("manager:launch.title")}
            </p>
            <h2 className="truncate text-xl font-black text-white">
              {quizzName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t("common:close", "Fermer")}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-6 py-5">
          {/* ── Rythme ── */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-bold tracking-wider text-white/40 uppercase">
              {t("manager:launch.section.rhythm")}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onToggleFastMode(false)}
                aria-pressed={!fastMode}
                className={clsx(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-colors",
                  !fastMode
                    ? "bg-white/10 ring-2 ring-white/30"
                    : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10",
                )}
              >
                <span className="text-sm font-bold text-white">
                  {t("manager:launch.rhythm.normal")}
                </span>
                <span className="text-xs text-white/40">
                  {t("manager:launch.rhythm.normalHint")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onToggleFastMode(true)}
                aria-pressed={fastMode}
                className={clsx(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-colors",
                  fastMode
                    ? "bg-orange-500/20 ring-2 ring-orange-500/50"
                    : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <Zap className="size-3.5" />
                  {t("manager:fastMode.label")}
                </span>
                <span className="text-xs text-white/40">
                  {t("manager:launch.rhythm.fastHint")}
                </span>
              </button>
            </div>

            {/* Intensités : uniquement en mode rapide, où elles ont un sens. */}
            {fastMode && (
              <div className="flex flex-col gap-2 rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
                <span className="text-xs font-bold text-white/50">
                  {t("manager:fastMode.intensityLabel")}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {INTENSITIES.map(({ value, key }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onIntensityChange(value)}
                      aria-pressed={fastModeIntensity === value}
                      className={clsx(
                        "cursor-pointer rounded-lg px-2 py-2 text-xs font-bold transition-colors",
                        fastModeIntensity === value
                          ? "bg-orange-500/30 text-orange-100 ring-1 ring-orange-500/40"
                          : "text-white/40 hover:bg-white/10 hover:text-white/70",
                      )}
                    >
                      {t(`manager:fastMode.intensity.${key}.label`)}
                    </button>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-white/40">
                  {t(
                    `manager:fastMode.intensity.${
                      INTENSITIES.find((i) => i.value === fastModeIntensity)
                        ?.key ?? "nervous"
                    }.hint`,
                  )}
                </p>
              </div>
            )}
          </section>

          {/* ── Score ── */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-bold tracking-wider text-white/40 uppercase">
              {t("manager:launch.section.score")}
            </h3>

            <button
              type="button"
              onClick={() => onToggleNoSpeed(!noSpeedMode)}
              aria-pressed={noSpeedMode}
              className={clsx(
                "flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors",
                noSpeedMode
                  ? "bg-sky-500/20 ring-2 ring-sky-500/40"
                  : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10",
              )}
            >
              <TimerOff
                className={clsx(
                  "mt-0.5 size-4 shrink-0",
                  noSpeedMode ? "text-sky-200" : "text-white/40",
                )}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-white">
                  {t("manager:noSpeed.label")}
                </span>
                <span className="text-xs leading-relaxed text-white/40">
                  {t("manager:noSpeed.hint")}
                </span>
              </span>
            </button>
          </section>

          {/* ── Bonus (admin uniquement : pas de power-ups en session invité) ── */}
          {!isGuest && (
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-bold tracking-wider text-white/40 uppercase">
                {t("manager:launch.section.bonus")}
              </h3>

              <button
                type="button"
                onClick={onOpenPowerUpsConfig}
                className={clsx(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors",
                  powerUpsEnabled
                    ? "bg-yellow-500/20 ring-2 ring-yellow-500/40"
                    : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10",
                )}
              >
                <Sparkles
                  className={clsx(
                    "size-4 shrink-0",
                    powerUpsEnabled ? "text-yellow-200" : "text-white/40",
                  )}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-bold text-white">
                    {t("manager:quizz.powerUps")}
                  </span>
                  <span className="text-xs text-white/40">
                    {powerUpsEnabled
                      ? t("manager:launch.powerUps.on")
                      : t("manager:launch.powerUps.off")}
                  </span>
                </span>
                <Settings2 className="ml-auto size-4 shrink-0 text-white/30" />
              </button>
            </section>
          )}
        </div>

        {/* Pied : l'action principale */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t("common:cancel", "Annuler")}
          </button>
          <button
            type="button"
            onClick={onStart}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-105 hover:bg-orange-400"
          >
            {isGuest ? (
              <>
                <PlayCircle className="size-4" />
                {t("manager:guest.testQuizz", "Tester le quiz")}
              </>
            ) : (
              <>
                <Play className="size-4 fill-current" />
                {t("manager:quizz.startGame")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LaunchModal
