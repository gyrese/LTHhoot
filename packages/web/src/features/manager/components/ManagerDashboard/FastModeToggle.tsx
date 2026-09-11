import {
  FAST_MODE_INTENSITY,
  type FastModeIntensity,
} from "@rahoot/common/types/fast-mode"
import clsx from "clsx"
import { Zap } from "lucide-react"
import { useTranslation } from "react-i18next"

type Props = {
  fastMode: boolean
  intensity: FastModeIntensity
  onToggle: () => void
  onIntensityChange: (_intensity: FastModeIntensity) => void
}

// Ordre d'affichage = ordre croissant de pression. Les libellés viennent de
// l'i18n ; la clé sert aussi de `title` (description longue).
const INTENSITIES: { value: FastModeIntensity; key: string }[] = [
  { value: FAST_MODE_INTENSITY.SMOOTH, key: "smooth" },
  { value: FAST_MODE_INTENSITY.NERVOUS, key: "nervous" },
  { value: FAST_MODE_INTENSITY.HURRY_UP, key: "hurryUp" },
]

/**
 * Interrupteur du mode rapide + choix d'intensité.
 *
 * Les intensités n'apparaissent qu'une fois le mode actif : hors mode rapide
 * elles ne veulent rien dire, et les afficher en permanence encombrerait une
 * barre d'actions déjà dense.
 */
const FastModeToggle = ({
  fastMode,
  intensity,
  onToggle,
  onIntensityChange,
}: Props) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={fastMode}
        className={clsx(
          "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors select-none",
          fastMode
            ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40 hover:bg-orange-500/30"
            : "bg-white/5 text-white/40 ring-1 ring-white/10 hover:bg-white/10",
        )}
        title={t("manager:fastMode.hint")}
      >
        <Zap className="size-3.5" />
        <span>{t("manager:fastMode.label")}</span>
      </button>

      {fastMode && (
        <div
          className="flex items-center gap-0.5 rounded-xl bg-black/30 p-0.5 ring-1 ring-white/10"
          role="group"
          aria-label={t("manager:fastMode.intensityLabel")}
        >
          {INTENSITIES.map(({ value, key }) => (
            <button
              key={value}
              type="button"
              onClick={() => onIntensityChange(value)}
              aria-pressed={intensity === value}
              className={clsx(
                "cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors select-none",
                intensity === value
                  ? "bg-orange-500/30 text-orange-100"
                  : "text-white/40 hover:bg-white/10 hover:text-white/70",
              )}
              title={t(`manager:fastMode.intensity.${key}.hint`)}
            >
              {t(`manager:fastMode.intensity.${key}.label`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default FastModeToggle
