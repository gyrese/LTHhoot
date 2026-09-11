import {
  FAST_MODE_INTENSITY,
  type FastModeIntensity,
} from "@rahoot/common/types/fast-mode"
import type { QuizzMeta } from "@rahoot/common/types/game"
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
  quizz?: QuizzMeta
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
 * Écran de lancement d'une partie personnalisée.
 *
 * Mis en scène comme un lancement de jeu : l'affiche du quiz occupe le haut de
 * la modale, titre en surimpression sur un dégradé, et les réglages se lisent
 * en dessous. La version précédente était un formulaire de cases à cocher —
 * fonctionnel mais sans rapport avec le moment qu'elle ouvre.
 *
 * Aucun état local : tout est piloté par le parent, donc la modale reste
 * synchrone avec les réglages réels même si l'un d'eux change pendant qu'elle
 * est ouverte (cf. le piège « modale montée en permanence » de lessons.md).
 */
const LaunchModal = ({
  isOpen,
  onClose,
  quizz,
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

  const cover = quizz?.listingImage || quizz?.salonImage
  const activeIntensity =
    INTENSITIES.find((i) => i.value === fastModeIntensity)?.key ?? "nervous"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("manager:launch.title")}
      >
        {/* ── Affiche ── */}
        <div className="relative aspect-[16/7] w-full shrink-0 overflow-hidden bg-gradient-to-br from-orange-500 to-amber-700">
          {cover && (
            <img
              src={cover}
              alt=""
              // Une image manquante ou cassée laisse place au dégradé de repli
              // plutôt qu'à l'icône « image brisée » du navigateur.
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Dégradé : sans lui, le titre devient illisible sur une affiche
              claire ou chargée. */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 cursor-pointer rounded-full bg-black/50 p-2 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
            aria-label={t("common:close", "Fermer")}
          >
            <X className="size-4" />
          </button>

          <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-1 p-5">
            <span className="text-[0.65rem] font-black tracking-[0.2em] text-orange-400 uppercase">
              {t("manager:launch.title")}
            </span>
            <h2 className="text-2xl leading-tight font-black text-white drop-shadow-lg">
              {quizz?.publicName || quizz?.subject}
            </h2>
            {quizz?.description && (
              <p className="line-clamp-2 text-sm text-white/60">
                {quizz.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          {/* ── Rythme ── */}
          <section className="flex flex-col gap-2.5">
            <h3 className="text-[0.65rem] font-black tracking-[0.15em] text-white/35 uppercase">
              {t("manager:launch.section.rhythm")}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onToggleFastMode(false)}
                aria-pressed={!fastMode}
                className={clsx(
                  "flex cursor-pointer flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-left transition-all",
                  !fastMode
                    ? "bg-white/10 ring-2 ring-white/40"
                    : "bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.07]",
                )}
              >
                <span className="text-sm font-black text-white">
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
                  "flex cursor-pointer flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-left transition-all",
                  fastMode
                    ? "bg-orange-500/25 ring-2 ring-orange-400 ring-offset-1 ring-offset-slate-950"
                    : "bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.07]",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-black text-white">
                  <Zap
                    className={clsx(
                      "size-3.5",
                      fastMode && "fill-orange-400 text-orange-400",
                    )}
                  />
                  {t("manager:fastMode.label")}
                </span>
                <span className="text-xs text-white/40">
                  {t("manager:launch.rhythm.fastHint")}
                </span>
              </button>
            </div>

            {/* Intensités : uniquement en mode rapide, où elles ont un sens. */}
            {fastMode && (
              <div className="flex flex-col gap-2 rounded-2xl bg-black/40 p-3 ring-1 ring-white/10">
                <div className="grid grid-cols-3 gap-1.5">
                  {INTENSITIES.map(({ value, key }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onIntensityChange(value)}
                      aria-pressed={fastModeIntensity === value}
                      className={clsx(
                        "cursor-pointer rounded-xl px-2 py-2 text-xs font-black transition-colors",
                        fastModeIntensity === value
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                          : "text-white/40 hover:bg-white/10 hover:text-white/70",
                      )}
                    >
                      {t(`manager:fastMode.intensity.${key}.label`)}
                    </button>
                  ))}
                </div>
                <p className="px-0.5 text-xs leading-relaxed text-white/40">
                  {t(`manager:fastMode.intensity.${activeIntensity}.hint`)}
                </p>
              </div>
            )}
          </section>

          {/* ── Score & bonus ── */}
          <section className="flex flex-col gap-2.5">
            <h3 className="text-[0.65rem] font-black tracking-[0.15em] text-white/35 uppercase">
              {t("manager:launch.section.options")}
            </h3>

            <button
              type="button"
              onClick={() => onToggleNoSpeed(!noSpeedMode)}
              aria-pressed={noSpeedMode}
              className={clsx(
                "flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all",
                noSpeedMode
                  ? "bg-sky-500/20 ring-2 ring-sky-400/60"
                  : "bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.07]",
              )}
            >
              <TimerOff
                className={clsx(
                  "size-4 shrink-0",
                  noSpeedMode ? "text-sky-300" : "text-white/30",
                )}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-black text-white">
                  {t("manager:noSpeed.label")}
                </span>
                <span className="text-xs leading-relaxed text-white/40">
                  {t("manager:launch.noSpeedShort")}
                </span>
              </span>
            </button>

            {/* Power-ups : hors session invité, qui n'y a pas droit. */}
            {!isGuest && (
              <button
                type="button"
                onClick={onOpenPowerUpsConfig}
                className={clsx(
                  "flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all",
                  powerUpsEnabled
                    ? "bg-yellow-500/20 ring-2 ring-yellow-400/60"
                    : "bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.07]",
                )}
              >
                <Sparkles
                  className={clsx(
                    "size-4 shrink-0",
                    powerUpsEnabled ? "text-yellow-300" : "text-white/30",
                  )}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-black text-white">
                    {t("manager:quizz.powerUps")}
                  </span>
                  <span className="text-xs text-white/40">
                    {powerUpsEnabled
                      ? t("manager:launch.powerUps.on")
                      : t("manager:launch.powerUps.off")}
                  </span>
                </span>
                <Settings2 className="ml-auto size-4 shrink-0 text-white/25" />
              </button>
            )}
          </section>
        </div>

        {/* ── Lancement ── */}
        <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          >
            {t("common:cancel", "Annuler")}
          </button>
          <button
            type="button"
            onClick={onStart}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-base font-black text-white shadow-lg shadow-orange-500/40 transition-all hover:scale-[1.02] hover:bg-orange-400"
          >
            {isGuest ? (
              <>
                <PlayCircle className="size-5" />
                {t("manager:guest.testQuizz", "Tester le quiz")}
              </>
            ) : (
              <>
                <Play className="size-5 fill-current" />
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
