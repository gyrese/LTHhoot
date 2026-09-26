import { IconTrophy } from "@rahoot/web/features/game/components/remote/RemoteControl.icons"
import {
  type EveningInterlude,
  RANK_MEDALS,
} from "@rahoot/web/features/game/components/remote/RemoteControl.types"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

// ─── Interstitiel de soirée ───────────────────────────────────────────────────

export function EveningPanel({
  interlude,
}: {
  interlude: NonNullable<EveningInterlude>
}) {
  const { t } = useTranslation()
  const { quizIndex, totalQuizzes, subject, leaderboard } = interlude

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="py-2 text-center">
        <p className="text-xs font-bold tracking-widest text-orange-300 uppercase">
          {t("game:evening.quizComplete")}
        </p>
        <h2 className="mt-1 text-xl font-black text-white">{subject}</h2>
        <p className="mt-1 text-sm text-white/40">
          {t("game:evening.progress", {
            current: quizIndex + 1,
            total: totalQuizzes,
          })}
        </p>
        <div className="mx-auto mt-3 h-1.5 w-full max-w-xs rounded-full bg-orange-500/30">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-500"
            style={{ width: `${((quizIndex + 1) / totalQuizzes) * 100}%` }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
          <IconTrophy className="h-4 w-4 text-white/40" />
          <p className="text-xs font-semibold tracking-wider text-white/40 uppercase">
            {t("game:evening.cumulativeRanking")}
          </p>
        </div>
        <div className="divide-y divide-white/5">
          {leaderboard.slice(0, 8).map((player) => (
            <div
              key={player.id}
              className={clsx(
                "flex items-center gap-3 px-4 py-3",
                player.rank === 1 && "border-l-4 border-orange-500",
              )}
            >
              <span className="w-7 text-center text-base">
                {RANK_MEDALS[player.rank - 1] ?? `${player.rank}.`}
              </span>
              <span className="flex-1 truncate text-sm font-semibold text-white">
                {player.username}
              </span>
              <span className="text-sm font-bold text-white tabular-nums">
                {player.points.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
