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
import { motion } from "motion/react"

type Props = {
  data: CommonStatusDataMap["FINISHED"]
}

interface ThemeConfig {
  glow: string
  glowStyle: string
  bgGradient: string
  text: string
  border: string
  buttonGradient: string
}

const THEMES: Record<number, ThemeConfig> = {
  1: {
    glow: "bg-yellow-500/30",
    glowStyle:
      "shadow-[0px_-16px_24px_rgba(250,204,21,0.15)_inset,0_0_50px_rgba(250,204,21,0.25)]",
    bgGradient:
      "radial-gradient(at 88% 40%, #13111C 0px, transparent 85%), radial-gradient(at 49% 30%, #13111C 0px, transparent 85%), radial-gradient(at 14% 26%, #13111C 0px, transparent 85%), radial-gradient(at 0% 64%, #EAB308 0px, transparent 85%), radial-gradient(at 41% 94%, #FEF08A 0px, transparent 85%), radial-gradient(at 100% 99%, #F59E0B 0px, transparent 85%)",
    text: "text-yellow-400",
    border: "border-yellow-400/50",
    buttonGradient:
      "from-amber-500 to-yellow-400 shadow-yellow-500/20 text-black",
  },
  2: {
    glow: "bg-cyan-500/30",
    glowStyle:
      "shadow-[0px_-16px_24px_rgba(34,211,238,0.15)_inset,0_0_50px_rgba(34,211,238,0.2)]",
    bgGradient:
      "radial-gradient(at 88% 40%, #13111C 0px, transparent 85%), radial-gradient(at 49% 30%, #13111C 0px, transparent 85%), radial-gradient(at 14% 26%, #13111C 0px, transparent 85%), radial-gradient(at 0% 64%, #06B6D4 0px, transparent 85%), radial-gradient(at 41% 94%, #CFFAFE 0px, transparent 85%), radial-gradient(at 100% 99%, #3B82F6 0px, transparent 85%)",
    text: "text-cyan-400",
    border: "border-cyan-400/50",
    buttonGradient: "from-blue-600 to-cyan-400 shadow-cyan-500/20 text-white",
  },
  3: {
    glow: "bg-pink-500/30",
    glowStyle:
      "shadow-[0px_-16px_24px_rgba(244,63,94,0.15)_inset,0_0_50px_rgba(244,63,94,0.2)]",
    bgGradient:
      "radial-gradient(at 88% 40%, #13111C 0px, transparent 85%), radial-gradient(at 49% 30%, #13111C 0px, transparent 85%), radial-gradient(at 14% 26%, #13111C 0px, transparent 85%), radial-gradient(at 0% 64%, #EC4899 0px, transparent 85%), radial-gradient(at 41% 94%, #FCE7F3 0px, transparent 85%), radial-gradient(at 100% 99%, #D946EF 0px, transparent 85%)",
    text: "text-pink-400",
    border: "border-pink-500/50",
    buttonGradient: "from-pink-600 to-rose-400 shadow-pink-500/20 text-white",
  },
}

const DEFAULT_THEME: ThemeConfig = {
  glow: "bg-violet-600/25",
  glowStyle:
    "shadow-[0px_-16px_24px_rgba(124,58,237,0.1)_inset,0_0_40px_rgba(124,58,237,0.15)]",
  bgGradient:
    "radial-gradient(at 88% 40%, #13111C 0px, transparent 85%), radial-gradient(at 49% 30%, #13111C 0px, transparent 85%), radial-gradient(at 14% 26%, #13111C 0px, transparent 85%), radial-gradient(at 0% 64%, #7C3AED 0px, transparent 85%), radial-gradient(at 41% 94%, #D8B4FE 0px, transparent 85%), radial-gradient(at 100% 99%, #F472B6 0px, transparent 85%)",
  text: "text-violet-400",
  border: "border-violet-500/30",
  buttonGradient:
    "from-violet-600 to-fuchsia-400 shadow-violet-500/20 text-white",
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
  const theme = (isTopThree && THEMES[rank as number]) || DEFAULT_THEME

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
      const canvas = await renderScorecardToCanvas({
        username: player.username ?? "Joueur",
        avatar: player.avatar ?? player.username ?? "Joueur",
        points: player.points ?? 0,
        rank: rank ?? null,
        totalPlayers: totalPlayers ?? null,
        subject,
      })
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
      {/* Superbe Carte Collectible / Scorecard Style Jeu Vidéo */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="relative"
      >
        {/* Glow Effect */}
        <motion.div
          className={`absolute -inset-6 -z-20 rounded-3xl blur-3xl ${theme.glow}`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.9, 0.5],
          }}
          transition={{
            repeat: Infinity,
            duration: 6,
            ease: "easeInOut",
          }}
        />

        {/* Card Body */}
        <div
          className={`anim-pop-in relative flex w-full max-w-sm flex-col items-center gap-6 rounded-[32px] border ${theme.border} overflow-hidden bg-[#13111C] p-6 text-white shadow-[0px_-16px_24px_rgba(255,255,255,0.10)_inset] backdrop-blur-xl transition-all duration-500`}
        >
          {/* Border Effect */}
          <motion.div
            className="absolute inset-0 -z-10 rounded-[32px]"
            animate={{ rotate: [0, 360] }}
            transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
            style={{
              backgroundImage: theme.bgGradient,
            }}
          />

          {/* Pattern de grille subtil */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[30px] opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Badge d'en-tête (Branding L'Apéro Quiz & Les Toiles Noires) */}
          <div className="relative z-10 flex flex-col items-center gap-1 text-center font-mono text-[11px] font-bold tracking-widest uppercase">
            <span className="rounded-full bg-orange-500/10 px-3 py-1 text-orange-400 ring-1 ring-orange-500/30">
              L'Apéro Quiz
            </span>
            <span className="mt-1 text-[9px] text-white/40">
              Les Toiles Noires
            </span>
          </div>

          {/* Titre du quiz */}
          <h2 className="relative z-10 text-center text-xl font-black text-white drop-shadow-md sm:text-2xl">
            {subject}
          </h2>

          <hr className="relative z-10 w-full border-gray-800" />

          {/* Avatar avec glow */}
          {player?.avatar && (
            <div className="relative z-10 flex items-center justify-center py-2">
              <GameAvatar
                seed={player.avatar}
                animated
                animationStates={animationStates}
                className={`relative z-10 h-28 w-28 rounded-full border-4 shadow-2xl transition-transform hover:scale-105 ${avatarBorder}`}
              />
              {/* Badge médaille */}
              {medalEmoji && (
                <span className="absolute -top-1 -right-1 z-20 animate-bounce text-3xl drop-shadow-md">
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
          <div className="relative z-10 grid w-full grid-cols-2 gap-4 rounded-2xl bg-black/50 p-4 shadow-inner ring-1 ring-white/5">
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
                <span className="ml-1 text-xs font-bold text-white/55">
                  pts
                </span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Boutons d'action */}
      <div className="flex w-full max-w-sm flex-col gap-3">
        {player && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleShare}
            disabled={isExporting}
            className={`anim-slide-up flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-t ${theme.buttonGradient} cursor-pointer py-4 text-lg font-black shadow-xl transition-all hover:brightness-110 disabled:opacity-50`}
            style={{ animationDelay: "0.2s" }}
          >
            <Share2 size={22} className={isExporting ? "animate-pulse" : ""} />
            {isExporting
              ? t("game:scorecardExporting", "Génération…")
              : t("game:scorecardShare", "Télécharger ma carte")}
          </motion.button>
        )}

        {showQuit && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              navigate({ to: "/", search: { pin: undefined } })
            }}
            className="anim-slide-up flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-white/5 py-3 text-base font-bold text-white/80 shadow-inner ring-1 ring-white/10 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
            style={{ animationDelay: "0.4s" }}
          >
            <LogOut size={18} />
            {t("common:quit", "Quitter")}
          </motion.button>
        )}
      </div>
    </div>
  )
}

export default PlayerFinished
