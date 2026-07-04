import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { Swords } from "lucide-react"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["SHOW_TIE_BREAK_SPECTATE"]
}

const TieBreakSpectate = ({ data: { duelPlayerNames } }: Props) => {
  const { t } = useTranslation()
  const { cooldown } = useQuestionStore()

  return (
    <section className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4">
      <Swords className="anim-pop-in size-16 text-orange-400" />

      <h2 className="anim-slide-up text-center text-3xl font-black text-white drop-shadow-lg md:text-4xl">
        {t("game:tieBreak.title", "Duel de départage !")}
      </h2>

      <p className="anim-slide-up text-center text-xl font-bold text-white/80">
        {duelPlayerNames.join(" vs ")}
      </p>

      {/* Compte à rebours du duel (events GAME.COOLDOWN déjà diffusés) */}
      {typeof cooldown === "number" && cooldown > 0 && (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-2xl font-black text-white ring-2 ring-orange-500/60 tabular-nums backdrop-blur-sm"
          aria-live="polite"
        >
          {cooldown}
        </div>
      )}

      <p className="anim-slide-up text-center text-sm text-white/50">
        {t("game:tieBreak.spectateHint", "Le classement final se joue maintenant…")}
      </p>
    </section>
  )
}

export default TieBreakSpectate
