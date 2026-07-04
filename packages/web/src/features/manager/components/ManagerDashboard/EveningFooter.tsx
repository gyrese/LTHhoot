import type { QuizzMeta } from "@rahoot/common/types/game"
import { Play, X, PartyPopper, Sparkles } from "lucide-react"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

type Props = {
  eveningQuizIds: string[]
  quizzList: QuizzMeta[]
  powerUpsEnabled: boolean
  onRemove: (_id: string) => void
  onStart: () => void
  onToggleOff: () => void
  onOpenPowerUpsConfig: () => void
}

const EveningFooter = ({
  eveningQuizIds,
  quizzList,
  powerUpsEnabled,
  onRemove,
  onStart,
  onToggleOff,
  onOpenPowerUpsConfig,
}: Props) => {
  const { t } = useTranslation()
  const canStart = eveningQuizIds.length >= 2

  const totalQuestions = quizzList
    .filter((q) => eveningQuizIds.includes(q.id))
    .reduce((acc, _q) => acc, 0)

  return (
    <footer className="relative z-10 flex h-20 shrink-0 items-center gap-3 border-t border-white/10 bg-black/30 px-4 backdrop-blur-md">
      {/* Badge mode soirée */}
      <button
        onClick={onToggleOff}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-500/20 px-3 py-2 text-sm font-bold text-orange-300 ring-1 ring-orange-500/40 transition-colors hover:bg-orange-500/30"
        title={t("manager:evening.disable", "Désactiver la soirée")}
      >
        <PartyPopper className="size-4" />
        {t("manager:evening.mode", "Mode Soirée")}
        <X className="size-3 opacity-60" />
      </button>

      {/* Liste des quiz sélectionnés */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
        {eveningQuizIds.length === 0 && (
          <p className="text-sm text-white/40">{t("manager:evening.selectTwo", "Sélectionne au moins 2 quiz…")}</p>
        )}
        {eveningQuizIds.map((id, index) => {
          const quiz = quizzList.find((q) => q.id === id)

          if (!quiz) {return null}

          return (
            <div
              key={id}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 pl-2 pr-1 py-1 text-xs font-medium text-white ring-1 ring-white/10"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white">
                {index + 1}
              </span>
              <span className="max-w-[120px] truncate">{quiz.subject}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => onRemove(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onRemove(id)
                  }
                }}
                className="rounded-full p-0.5 text-white/40 hover:bg-white/10 hover:text-white cursor-pointer select-none"
              >
                <X className="size-3" />
              </span>
            </div>
          )
        })}
      </div>

      {/* Infos + CTA */}
      <div className="flex shrink-0 items-center gap-3">
        {totalQuestions > 0 && (
          <p className="text-xs text-white/40">{eveningQuizIds.length} quiz</p>
        )}

        {/* Configure power-ups */}
        <button
          type="button"
          onClick={onOpenPowerUpsConfig}
          className={clsx(
            "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors select-none",
            powerUpsEnabled
              ? "bg-yellow-500/20 text-yellow-200 ring-1 ring-yellow-500/40 hover:bg-yellow-500/30"
              : "bg-white/5 text-white/40 ring-1 ring-white/10 hover:bg-white/10",
          )}
          title={t("manager:evening.powerUpsToggle", "Configurer les power-ups")}
        >
          <Sparkles className="size-3.5" />
          <span>{t("manager:evening.powerUps", "Power-ups")}</span>
        </button>

        <button
          onClick={onStart}
          disabled={!canStart}
          className={clsx(
            "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all",
            canStart
              ? "bg-orange-500 shadow-lg shadow-orange-500/30 hover:scale-105 hover:bg-orange-400"
              : "cursor-not-allowed bg-white/10 text-white/30",
          )}
        >
          <Play className="size-4 fill-current" />
          {t("manager:evening.start", "Démarrer la soirée")}
        </button>
      </div>
    </footer>
  )
}

export default EveningFooter
