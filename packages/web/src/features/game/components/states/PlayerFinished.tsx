import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useTranslation } from "react-i18next"
import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { LogOut, Share2 } from "lucide-react"
import {
  downloadCanvasAsPng,
  renderScorecardToCanvas,
} from "@rahoot/web/features/game/utils/podium-export"

type Props = {
  data: CommonStatusDataMap["FINISHED"]
}

const CARD_THEME: Record<number, { border: string; glow: string; text: string }> = {
  1: {
    border: "border-yellow-400/50",
    glow: "shadow-[0_0_50px_rgba(250,255,0,0.25)]",
    text: "text-yellow-300",
  },
  2: {
    border: "border-cyan-400/50",
    glow: "shadow-[0_0_50px_rgba(0,245,255,0.2)]",
    text: "text-cyan-300",
  },
  3: {
    border: "border-pink-500/50",
    glow: "shadow-[0_0_50px_rgba(255,0,229,0.2)]",
    text: "text-pink-400",
  },
}

const AVATAR_BORDER: Record<number, string> = {
  1: "border-yellow-400 ring-4 ring-yellow-400/50",
  2: "border-cyan-400 ring-4 ring-cyan-400/40",
  3: "border-pink-500 ring-4 ring-pink-500/40",
}

const WINNING_ANIMATION_STATES = ["waving"] as const
const WAITING_ANIMATION_STATES = ["waiting"] as const
const FAILED_ANIMATION_STATES = ["failed"] as const

const PlayerFinished = ({ data: { rank, subject, totalPlayers } }: Props) => {
  const { player } = usePlayerStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showQuit, setShowQuit] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowQuit(true), 2000)

    return () => clearTimeout(timer)
  }, [])

  const rankKeyMap: Record<number, string> = {
    1: "game:rank.1",
    2: "game:rank.2",
    3: "game:rank.3",
  }
  const rankKey =
    typeof rank === "number" ? (rankKeyMap[rank] ?? "game:rank.other") : null

  const isTopThree = typeof rank === "number" && rank <= 3
  const theme = (isTopThree && CARD_THEME[rank as number]) || {
    border: "border-white/10",
    glow: "shadow-[0_0_40px_rgba(255,255,255,0.05)]",
    text: "text-white",
  }

  const avatarBorder =
    (typeof rank === "number" && AVATAR_BORDER[rank]) || "border-white/30"

  const isLastPlace =
    typeof rank === "number" &&
    typeof totalPlayers === "number" &&
    totalPlayers > 1 &&
    rank === totalPlayers

  let animationStates:
    | typeof WINNING_ANIMATION_STATES
    | typeof FAILED_ANIMATION_STATES
    | typeof WAITING_ANIMATION_STATES = WAITING_ANIMATION_STATES

  if (isTopThree) {
    animationStates = WINNING_ANIMATION_STATES
  } else if (isLastPlace) {
    animationStates = FAILED_ANIMATION_STATES
  }

  const handleShare = async () => {
    if (isExporting || !player) {
      return
    }

    setIsExporting(true)

    try {
      const canvas = await renderScorecardToCanvas(
        player.username,
        player.avatar ?? player.username,
        player.points ?? 0,
        rank,
        totalPlayers,
        subject,
      )
      downloadCanvasAsPng(canvas, `scorecard-${player.username}`)
    } catch (error) {
      console.error("Échec de la génération de la carte de score:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const medalEmoji =
    typeof rank === "number" && rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : null

  return (
    <div className="relative flex h-full flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
      {/* Superbe Carte Collectible / Scorecard */}
      <div
        className={`anim-pop-in relative flex w-full max-w-sm flex-col items-center gap-5 rounded-[32px] border bg-slate-900/60 p-6 backdrop-blur-xl transition-all duration-500 ${theme.border} ${theme.glow}`}
      >
        {/* Pattern de grille subtil */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[30px] opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Badge d'en-tête */}
        <span className="relative z-10 rounded-full bg-white/5 px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-white/50 uppercase ring-1 ring-white/10">
          Rahoot Scorecard
        </span>

        {/* Titre du quiz */}
        <h2 className="relative z-10 text-center text-xl font-black text-white drop-shadow-md sm:text-2xl">
          {subject}
        </h2>

        {/* Avatar avec glow */}
        {player?.avatar && (
          <div className="relative flex items-center justify-center py-2">
            <GameAvatar
              seed={player.avatar}
              animated
              animationStates={animationStates}
              className={`relative z-10 h-28 w-28 rounded-full border-4 shadow-2xl transition-transform hover:scale-105 ${avatarBorder}`}
            />
            {/* Badge médaille */}
            {medalEmoji && (
              <span className="absolute -top-1 -right-1 z-20 text-3xl drop-shadow-md animate-bounce">
                {medalEmoji}
              </span>
            )}
          </div>
        )}

        {/* Nom du joueur */}
        <p className="relative z-10 text-center text-2xl font-black tracking-wide text-white uppercase">
          {player?.username}
        </p>

        {/* Grille de stats */}
        <div className="relative z-10 grid w-full grid-cols-2 gap-4 rounded-2xl bg-black/40 p-4 ring-1 ring-white/5">
          {/* Colonne classement */}
          <div className="flex flex-col items-center justify-center border-r border-white/10 pr-2 text-center">
            <span className="font-mono text-[9px] font-bold tracking-wider text-white/40 uppercase">
              Classement
            </span>
            <span className={`text-2xl font-black ${theme.text}`}>
              {rankKey !== null ? t(rankKey, { rank }) : "—"}
              {totalPlayers && rankKey !== null && (
                <span className="text-xs font-bold text-white/40">
                  {" "}
                  / {totalPlayers}
                </span>
              )}
            </span>
          </div>

          {/* Colonne score */}
          <div className="flex flex-col items-center justify-center pl-2 text-center">
            <span className="font-mono text-[9px] font-bold tracking-wider text-white/40 uppercase">
              Score
            </span>
            <span className="text-2xl font-black text-white">
              {(player?.points ?? 0).toLocaleString()}
              <span className="ml-1 text-xs font-bold text-white/55">pts</span>
            </span>
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex w-full max-w-sm flex-col gap-3">
        {player && (
          <button
            onClick={handleShare}
            disabled={isExporting}
            className="anim-slide-up flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-lg font-black text-white shadow-xl shadow-orange-500/10 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            style={{ animationDelay: "0.2s" }}
          >
            <Share2 size={22} className={isExporting ? "animate-pulse" : ""} />
            {isExporting
              ? t("game:scorecardExporting", "Génération…")
              : t("game:scorecardShare", "Télécharger ma carte")}
          </button>
        )}

        {showQuit && (
          <button
            onClick={() => {
              navigate({ to: "/", search: { pin: undefined } })
            }}
            className="anim-slide-up flex w-full items-center justify-center gap-3 rounded-2xl bg-white/10 py-3 text-base font-bold text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/20 active:scale-[0.98]"
            style={{ animationDelay: "0.4s" }}
          >
            <LogOut size={18} />
            {t("common:quit", "Quitter")}
          </button>
        )}
      </div>
    </div>
  )
}

export default PlayerFinished
