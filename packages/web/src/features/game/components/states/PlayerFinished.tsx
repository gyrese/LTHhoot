import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["FINISHED"]
}

const AVATAR_BORDER: Record<number, string> = {
  1: "border-yellow-400 ring-4 ring-yellow-400/50 anim-glow",
  2: "border-slate-300 ring-4 ring-slate-300/40",
  3: "border-orange-400 ring-4 ring-orange-400/40",
}

const RANK_COLOR: Record<number, string> = {
  1: "text-yellow-300",
  2: "text-slate-200",
  3: "text-orange-300",
}

const WINNING_ANIMATION_STATES = ["waving"] as const
const WAITING_ANIMATION_STATES = ["waiting"] as const
const FAILED_ANIMATION_STATES = ["failed"] as const

const PlayerFinished = ({ data: { rank, subject, totalPlayers } }: Props) => {
  const { player } = usePlayerStore()
  const { t } = useTranslation()

  const rankKeyMap: Record<number, string> = {
    1: "game:rank.1",
    2: "game:rank.2",
    3: "game:rank.3",
  }
  const rankKey =
    typeof rank === "number" ? (rankKeyMap[rank] ?? "game:rank.other") : null

  const avatarBorder = (typeof rank === "number" && AVATAR_BORDER[rank]) || "border-white/50"
  const rankColor = (typeof rank === "number" && RANK_COLOR[rank]) || "text-white"
  const isTopThree = typeof rank === "number" && rank <= 3
  const isLastPlace =
    typeof rank === "number" &&
    typeof totalPlayers === "number" &&
    totalPlayers > 1 &&
    rank === totalPlayers
  const animationStates = isTopThree
    ? WINNING_ANIMATION_STATES
    : isLastPlace
      ? FAILED_ANIMATION_STATES
      : WAITING_ANIMATION_STATES

  return (
    <div className="relative flex h-full flex-1 flex-col items-center justify-center gap-5 px-5">
      {/* Titre du quiz */}
      <p className="anim-slide-up text-center text-2xl font-bold text-white/80 drop-shadow-lg sm:text-3xl">
        {subject}
      </p>

      {/* Avatar + halo selon rang */}
      {player?.avatar && (
        <GameAvatar
          seed={player.avatar}
          animated
          animationStates={animationStates}
          className={`anim-pop-in h-28 w-28 rounded-full border-4 shadow-2xl ${avatarBorder}`}
        />
      )}

      {/* Pseudo */}
      <p className="anim-slide-up text-center text-xl font-bold text-white drop-shadow">
        {player?.username}
      </p>

      {/* Classement — grande taille, couleur selon rang */}
      <p
        className={`anim-pop-in text-center text-4xl font-black drop-shadow-lg sm:text-5xl ${rankColor}`}
        style={{ animationDelay: "0.15s" }}
      >
        {rankKey !== null ? t(rankKey, { rank }) : "—"}
      </p>

      {/* Score total */}
      <div
        className="anim-slide-up rounded-2xl bg-black/50 px-8 py-3 ring-1 ring-white/10 backdrop-blur-sm"
        style={{ animationDelay: "0.3s" }}
      >
        <p className="text-center text-3xl font-black text-white">
          {player?.points ?? 0}
          <span className="ml-1 text-lg font-bold text-white/60">pts</span>
        </p>
      </div>
    </div>
  )
}

export default PlayerFinished
