import type { AwardType } from "@rahoot/common/types/game"
import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import {
  HAPTIC_PATTERNS,
  vibrate,
} from "@rahoot/web/features/game/utils/haptics"
import {
  downloadCanvasAsPng,
  renderPodiumToCanvas,
} from "@rahoot/web/features/game/utils/podium-export"
import useScreenSize from "@rahoot/web/hooks/useScreenSize"
import { MOTION_EASE } from "@rahoot/web/features/game/utils/motion"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { Download } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ReactConfetti from "react-confetti"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

type Props = {
  data: ManagerStatusDataMap["FINISHED"]
}

const AWARD_ICONS: Record<AwardType, string> = {
  fastest: "⚡",
  comeback: "📈",
  loser: "🐢",
  sniper: "🎯",
}

// Libellés traduits : game:awards.<type> (cf. locales game.json).
const AWARD_LABEL_KEYS: Record<AwardType, string> = {
  fastest: "game:awards.fastest",
  comeback: "game:awards.comeback",
  loser: "game:awards.loser",
  sniper: "game:awards.sniper",
}

const WINNING_ANIMATION_STATES = ["waving"] as const

// Keyframes CSS injectés une seule fois
const NEON_CSS = `
  @keyframes neon-glitch {
    0%, 88%, 100% { transform: translate(0); filter: none; }
    89% { transform: translate(-3px, 1px); filter: hue-rotate(90deg); }
    90% { transform: translate(3px, -1px); }
    91% { transform: translate(0); filter: none; }
  }
  @keyframes neon-glitch-2 {
    0%, 93%, 100% { clip-path: none; transform: translate(0); }
    94% { clip-path: inset(15% 0 40% 0); transform: translate(4px, 0); }
    95% { clip-path: inset(60% 0 10% 0); transform: translate(-4px, 0); }
    96% { clip-path: none; transform: translate(0); }
  }
  @keyframes cursor-blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  @keyframes neon-breathe {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  @keyframes scanline-sweep {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes star-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  /* Tremblement caméra pendant le roulement de tambour : silence les 70%
     premiers (suspense), puis secousse croissante juste avant le reveal. */
  @keyframes drumroll-shake {
    0% { transform: translate(0, 0); }
    70% { transform: translate(-1px, 0); }
    75% { transform: translate(1px, 0); }
    80% { transform: translate(-2px, 1px); }
    84% { transform: translate(2px, -1px); }
    88% { transform: translate(-3px, 1px); }
    91% { transform: translate(3px, -1px); }
    94% { transform: translate(-4px, 2px); }
    96% { transform: translate(4px, -2px); }
    98% { transform: translate(-5px, 2px); }
    100% { transform: translate(0, 0); }
  }
`

const usePodiumAnimation = (topLength: number) => {
  const [apparition, setApparition] = useState(0)
  const { isHost } = useGameConfig()
  const [sfxtThree] = useSound(SFX.PODIUM.THREE, { volume: 0.2 })
  const [sfxSecond] = useSound(SFX.PODIUM.SECOND, { volume: 0.2 })
  const [sfxRool, { stop: sfxRoolStop }] = useSound(SFX.PODIUM.SNEAR_ROOL, {
    volume: 0.2,
  })
  const [sfxFirst] = useSound(SFX.PODIUM.FIRST, { volume: 0.2 })

  useEffect(() => {
    if (!isHost) {
      return
    }

    const actions: Partial<Record<number, () => void>> = {
      4: () => {
        sfxRoolStop()
        sfxFirst()
      },
      3: sfxRool,
      2: sfxSecond,
      1: sfxtThree,
    }
    actions[apparition]?.()
  }, [apparition, sfxFirst, sfxSecond, sfxtThree, sfxRool, sfxRoolStop, isHost])

  useEffect(() => {
    if (topLength < 3) {
      setApparition(4)

      return () => {
        // Noop
      }
    }

    if (apparition >= 4) {
      return () => {
        // Noop
      }
    }

    const interval = setInterval(() => setApparition((v) => v + 1), 2500)

    return () => {
      clearInterval(interval)
    }
  }, [apparition, topLength])

  return apparition
}

const ScoreCounter = ({ target, show }: { target: number; show: boolean }) => {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    if (!show) {
      return
    }

    const duration = 1200
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setDisplayed(Math.round((1 - (1 - p) ** 3) * target))

      if (p < 1) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }, [show, target])

  return <>{displayed.toLocaleString()}</>
}

const RANK = {
  1: {
    neon: "#FAFF00",
    dim: "#FAFF0030",
    label: "01",
    h: "62%",
    avatarSize: 96,
  },
  2: {
    neon: "#00F5FF",
    dim: "#00F5FF30",
    label: "02",
    h: "46%",
    avatarSize: 76,
  },
  3: {
    neon: "#FF00E5",
    dim: "#FF00E530",
    label: "03",
    h: "32%",
    avatarSize: 68,
  },
} as const

const neonShadow = (c: string, intensity = 1) =>
  `0 0 ${6 * intensity}px ${c}, 0 0 ${20 * intensity}px ${c}, 0 0 ${40 * intensity}px ${c}80`

// Étoile SVG pixel-art
const PixelStar = ({ color, size = 14 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill={color} aria-hidden>
    <rect x="4" y="0" width="2" height="2" />
    <rect x="2" y="2" width="6" height="2" />
    <rect x="0" y="4" width="10" height="2" />
    <rect x="2" y="6" width="6" height="2" />
    <rect x="0" y="2" width="2" height="6" />
    <rect x="8" y="2" width="2" height="6" />
  </svg>
)

// Couronne pixel-art — tombe avec rebond juste avant le badge VAINQUEUR
const PixelCrown = ({ color, size = 22 }: { color: string; size?: number }) => (
  <svg
    width={size}
    height={size * 0.75}
    viewBox="0 0 16 12"
    fill={color}
    aria-hidden
  >
    <rect x="1" y="7" width="14" height="4" />
    <rect x="1" y="2" width="2" height="5" />
    <rect x="7" y="0" width="2" height="7" />
    <rect x="13" y="2" width="2" height="5" />
    <rect x="3" y="4" width="2" height="3" />
    <rect x="11" y="4" width="2" height="3" />
  </svg>
)

// Faisceau spot qui s'allume au moment précis du reveal d'un rang
const RankSpotlight = ({
  color,
  active,
}: {
  color: string
  active: boolean
}) => (
  <AnimatePresence>
    {active && (
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: [0, 0.9, 0.3], scaleY: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="pointer-events-none absolute inset-x-0 top-0 z-0 origin-top"
        style={{
          height: "140%",
          background: `linear-gradient(180deg, ${color}55 0%, ${color}15 40%, transparent 70%)`,
        }}
      />
    )}
  </AnimatePresence>
)

// Flash blanc au reveal 1er
const RevealFlash = ({ trigger }: { trigger: boolean }) => {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!trigger) {
      return () => {
        // Noop
      }
    }

    setVisible(true)
    const t = setTimeout(() => setVisible(false), 500)

    return () => {
      clearTimeout(t)
    }
  }, [trigger])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.7, 0] }}
          transition={{ duration: 0.5, times: [0, 0.08, 0.3, 1] }}
          className="pointer-events-none absolute inset-0 z-50"
          style={{ backgroundColor: "#FAFF00" }}
        />
      )}
    </AnimatePresence>
  )
}

// Rayons néon depuis le bas au reveal final
const NeonRays = ({ active }: { active: boolean }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: [0, 0.35, 0.15] }}
            transition={{ duration: 0.9, delay: i * 0.045, ease: "easeOut" }}
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{
              width: 1.5,
              height: "88%",
              transformOrigin: "bottom center",
              transform: `translateX(-50%) rotate(${(i - 6.5) * 12}deg)`,
              background:
                "linear-gradient(to top, #FAFF00CC 0%, transparent 100%)",
            }}
          />
        ))}
      </motion.div>
    )}
  </AnimatePresence>
)

// Pixels décoratifs dans les coins
const CornerPixels = ({ color }: { color: string }) => (
  <>
    <div
      className="absolute top-0 left-0 h-3 w-3"
      style={{ background: color, boxShadow: neonShadow(color) }}
    />
    <div
      className="absolute top-0 right-0 h-3 w-3"
      style={{ background: color, boxShadow: neonShadow(color) }}
    />
    <div
      className="absolute top-3 left-0 h-1 w-3"
      style={{ background: color, opacity: 0.5 }}
    />
    <div
      className="absolute top-3 right-0 h-1 w-3"
      style={{ background: color, opacity: 0.5 }}
    />
  </>
)

const PodiumPlace = ({
  player,
  rank,
  show,
  apparition,
}: {
  player: { username: string; avatar?: string; points: number }
  rank: 1 | 2 | 3
  show: boolean
  apparition: number
}) => {
  const cfg = RANK[rank]
  const isFirst = rank === 1
  const isFinal = apparition >= 4
  const shadow = neonShadow(cfg.neon)
  const shadowStrong = neonShadow(cfg.neon, 2)
  const [punch, setPunch] = useState(false)

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-end">
      <RankSpotlight color={cfg.neon} active={show} />

      {/* Zone flottante */}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 22,
              delay: isFirst ? 0.25 : 0,
            }}
            className="flex flex-col items-center gap-2 pb-2"
          >
            {/* Couronne + badge VAINQUEUR 1er uniquement */}
            {isFirst && (
              <AnimatePresence>
                {isFinal && (
                  <motion.div
                    key="winner-badge"
                    className="flex flex-col items-center gap-1.5"
                  >
                    <motion.div
                      initial={{ y: -60, opacity: 0, rotate: -10 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 11,
                      }}
                    >
                      <PixelCrown color={cfg.neon} />
                    </motion.div>
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 14,
                        delay: 0.18,
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <PixelStar color={cfg.neon} />
                      <span
                        className="text-xs font-black tracking-[0.35em] uppercase"
                        style={{
                          fontFamily: "monospace",
                          color: cfg.neon,
                          textShadow: shadow,
                          animation: "neon-breathe 1.2s ease-in-out infinite",
                        }}
                      >
                        VAINQUEUR
                      </span>
                      <PixelStar color={cfg.neon} />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Avatar — cadre néon sharp */}
            <motion.div
              animate={{
                boxShadow:
                  isFinal && isFirst ? [shadow, shadowStrong, shadow] : shadow,
              }}
              transition={{
                repeat: Infinity,
                duration: 1.6,
                ease: "easeInOut",
              }}
              className="relative overflow-hidden"
              style={{
                width: cfg.avatarSize,
                height: cfg.avatarSize,
                border: `3px solid ${cfg.neon}`,
              }}
            >
              <GameAvatar
                seed={player.avatar || player.username}
                animated
                animationStates={WINNING_ANIMATION_STATES}
                className="h-full w-full"
              />
              {/* Scanline interne subtile */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px)",
                }}
              />
            </motion.div>

            {/* Nom */}
            <p
              className="max-w-[90%] truncate text-center font-black uppercase"
              style={{
                fontFamily: "monospace",
                fontSize: isFirst ? 17 : 13,
                color: "#FFFFFF",
                textShadow: `0 0 8px ${cfg.neon}80, 0 0 20px ${cfg.dim}`,
                letterSpacing: "0.12em",
              }}
            >
              {player.username}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bloc podium néon — le wrapper externe fait un léger "punch" scale
          quand le bloc atteint sa hauteur finale (impact d'atterrissage) */}
      <motion.div
        animate={punch ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full"
      >
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: show ? cfg.h : 0 }}
          transition={{
            type: "spring",
            stiffness: 55,
            damping: 16,
            delay: isFirst ? 0.45 : 0,
          }}
          onAnimationComplete={() => {
            if (!show) {
              return
            }

            setPunch(true)
            setTimeout(() => setPunch(false), 300)
          }}
          className="relative w-full overflow-hidden"
          style={{
            borderTop: `2px solid ${cfg.neon}`,
            borderLeft: `2px solid ${cfg.neon}`,
            borderRight: `2px solid ${cfg.neon}`,
            boxShadow: shadow,
            background: `linear-gradient(180deg, ${cfg.dim} 0%, transparent 60%)`,
          }}
        >
          <CornerPixels color={cfg.neon} />

          {/* Contenu intérieur */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pt-4">
            {/* Score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.2 }}
              transition={{
                type: "spring",
                stiffness: 180,
                delay: isFirst ? 0.75 : 0.2,
              }}
              className="text-center"
            >
              <div
                className="leading-none font-black tabular-nums"
                style={{
                  fontFamily: "monospace",
                  fontSize: isFirst ? 28 : 20,
                  color: cfg.neon,
                  textShadow: shadow,
                }}
              >
                <ScoreCounter target={player.points} show={show} />
              </div>
              <div
                className="tracking-[0.35em] uppercase"
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: cfg.neon,
                  opacity: 0.6,
                  textShadow: shadow,
                }}
              >
                PTS
              </div>
            </motion.div>

            {/* Rang en watermark */}
            <div
              className="font-black select-none"
              style={{
                fontFamily: "monospace",
                fontSize: isFirst ? 52 : 40,
                color: cfg.neon,
                opacity: 0.1,
                lineHeight: 1,
                marginTop: 4,
              }}
            >
              {cfg.label}
            </div>
          </div>

          {/* Ligne scan déco */}
          <div
            className="absolute inset-x-0 h-px"
            style={{
              top: "30%",
              background: `linear-gradient(to right, transparent, ${cfg.neon}60, transparent)`,
            }}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}

// Rang qui vient d'être révélé à chaque palier d'apparition (avant le 1er,
// réservé au grand final apparition=4) — sert au mini burst de confettis.
const APPARITION_RANK: Partial<Record<number, 1 | 2 | 3>> = { 1: 3, 2: 2 }

const Podium = ({ data: { subject, top, awards } }: Props) => {
  const apparition = usePodiumAnimation(top.length)
  const { salonImage } = useManagerStore()
  const { isHost, isEveningFinale } = useGameConfig()
  const { player } = usePlayerStore()
  const { width, height } = useScreenSize()
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const isFinal = apparition >= 4
  const [isExporting, setIsExporting] = useState(false)

  // Mini burst de confettis localisé à l'annonce du 3e puis du 2e — le 1er est
  // réservé au grand confetti final (isFinal) pour garder le suspense monter.
  const [burst, setBurst] = useState<{ rank: 1 | 2 | 3; id: number } | null>(
    null,
  )
  const burstIdRef = useRef(0)

  useEffect(() => {
    const rank = APPARITION_RANK[apparition]

    if (!rank) {
      return () => {
        // Noop
      }
    }

    burstIdRef.current += 1
    setBurst({ rank, id: burstIdRef.current })
    const t2 = setTimeout(() => setBurst(null), 1200)

    return () => clearTimeout(t2)
  }, [apparition])

  const handleExport = async () => {
    if (isExporting) {
      return
    }

    setIsExporting(true)

    try {
      const canvas = await renderPodiumToCanvas(top, subject)
      downloadCanvasAsPng(canvas, `podium-${subject}`)
    } catch (error) {
      console.error("Échec de l'export du podium:", error)
    } finally {
      setIsExporting(false)
    }
  }

  // Vibration côté joueur au moment précis où c'est LUI qui est révélé sur le
  // podium (rang 3 à apparition=1, rang 2 à apparition=2, rang 1 à apparition=4
  // — cf. les seuils `show={apparition >= n}` de chaque PodiumPlace ci-dessous).
  useEffect(() => {
    if (isHost || !player) {
      return
    }

    const REVEALED_RANK_BY_APPARITION: Record<number, number> = {
      1: 3,
      2: 2,
      4: 1,
    }
    const revealedRank = REVEALED_RANK_BY_APPARITION[apparition]

    if (!revealedRank) {
      return
    }

    if (top[revealedRank - 1]?.username === player.username) {
      vibrate(HAPTIC_PATTERNS.DUEL_WIN)
    }
  }, [apparition, isHost, player, top])

  useEffect(() => {
    if (document.getElementById("podium-neon-css")) {
      return () => {
        // Noop
      }
    }

    const el = document.createElement("style")
    el.id = "podium-neon-css"
    el.textContent = NEON_CSS
    document.head.appendChild(el)

    return () => {
      el.remove()
    }
  }, [])

  return (
    <motion.div
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.9, ease: MOTION_EASE.out }}
      className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden"
      style={{ backgroundColor: "#000000" }}
    >
      {/* Tremblement caméra pendant le roulement de tambour (apparition=3) —
          isolé sur un noeud à part pour ne jamais entrer en conflit avec le
          scale framer du conteneur parent. Désactivé en reduced-motion. */}
      <div
        className="flex h-full w-full flex-col items-center justify-between"
        style={
          apparition === 3 && !reducedMotion
            ? { animation: "drumroll-shake 2.4s ease-in-out 1" }
            : undefined
        }
      >
        {/* Image salon / couverture en fond */}
        {salonImage && (
          <>
            <div
              className="absolute inset-0 scale-105 bg-cover bg-center blur-sm"
              style={{ backgroundImage: `url(${salonImage})`, opacity: 0.18 }}
            />
            {/* Overlay sombre pour conserver la lisibilité du podium néon */}
            <div className="absolute inset-0 bg-black/60" />
          </>
        )}

        {/* Grille de fond */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Scanlines */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 3px)",
          }}
        />

        {/* Export image du podium (hôte uniquement, une fois le podium révélé) */}
        {isHost && isFinal && (
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="absolute top-3 right-32 z-30 flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-bold text-white/70 backdrop-blur-sm transition-colors hover:border-orange-500/30 hover:text-orange-300 disabled:opacity-50"
          >
            <Download className="size-4" />
            {isExporting
              ? t("game:podiumExporting", "Export…")
              : t("game:podiumShare", "Partager")}
          </button>
        )}

        {/* Flash reveal 1er */}
        <RevealFlash trigger={isFinal} />

        {/* Rayons néon dorés */}
        <NeonRays active={isFinal} />

        {/* Confettis néon */}
        {isFinal && (
          <ReactConfetti
            width={width}
            height={height}
            className="pointer-events-none z-50"
            colors={[
              "#FAFF00",
              "#00F5FF",
              "#FF00E5",
              "#FFFFFF",
              "#FF6600",
              "#00FF88",
            ]}
            numberOfPieces={320}
            recycle={false}
            initialVelocityY={18}
            gravity={0.15}
          />
        )}

        {/* Mini confetti localisé à l'annonce du 3e / 2e — construit la montée
          en excitation avant le grand confetti final du gagnant */}
        {burst && (
          <ReactConfetti
            key={burst.id}
            width={width}
            height={height}
            className="pointer-events-none z-40"
            colors={[RANK[burst.rank].neon, "#FFFFFF"]}
            numberOfPieces={50}
            recycle={false}
            initialVelocityY={14}
            gravity={0.25}
            confettiSource={{
              x: burst.rank === 3 ? width * 0.66 : 0,
              y: height * 0.75,
              w: width * 0.33,
              h: 10,
            }}
          />
        )}

        {/* Header */}
        <div className="relative z-20 flex w-full flex-col items-center gap-2 pt-6 md:pt-8">
          {/* Ligne décorative */}
          <div className="flex w-full max-w-lg items-center gap-3 px-6">
            <div
              className="h-px flex-1"
              style={{
                background: "linear-gradient(to right, transparent, #FAFF00CC)",
              }}
            />
            <PixelStar color="#FAFF00" size={10} />
            <span
              className="text-xs tracking-[0.5em] uppercase"
              style={{
                fontFamily: "monospace",
                color: "#FAFF00",
                opacity: 0.5,
                textShadow: neonShadow("#FAFF00"),
                animation: "neon-breathe 2s ease-in-out infinite",
              }}
            >
              {isEveningFinale ? "SOIRÉE TERMINÉE" : "GAME OVER"}
            </span>
            <PixelStar color="#FAFF00" size={10} />
            <div
              className="h-px flex-1"
              style={{
                background: "linear-gradient(to left, transparent, #FAFF00CC)",
              }}
            />
          </div>

          {/* Titre avec glitch */}
          <h2
            className="text-center font-black text-white uppercase"
            style={{
              fontFamily: "monospace",
              fontSize: "clamp(1.4rem, 4.5vw, 2.8rem)",
              letterSpacing: "0.06em",
              textShadow: "0 0 12px rgba(255,255,255,0.35)",
              animation: "neon-glitch 7s infinite, neon-glitch-2 8s infinite",
            }}
          >
            {subject}
          </h2>

          {/* Sous-titre clignotant */}
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "#FAFF00",
              opacity: 0.45,
              letterSpacing: "0.45em",
              textTransform: "uppercase",
              textShadow: neonShadow("#FAFF00"),
            }}
          >
            {isEveningFinale ? "CLASSEMENT DE LA SOIRÉE" : "CLASSEMENT FINAL"}
            <span style={{ animation: "cursor-blink 1s step-end infinite" }}>
              █
            </span>
          </p>
        </div>

        {/* Grille podium */}
        <div className="relative z-20 flex w-full max-w-3xl flex-1 items-end px-2 pb-0">
          <div className="grid h-full w-full grid-cols-3 items-end gap-1 md:gap-2">
            {top[1] ? (
              <PodiumPlace
                player={top[1]}
                rank={2}
                show={apparition >= 2}
                apparition={apparition}
              />
            ) : (
              <div />
            )}

            <PodiumPlace
              player={top[0]}
              rank={1}
              show={apparition >= 3}
              apparition={apparition}
            />

            {top[2] ? (
              <PodiumPlace
                player={top[2]}
                rank={3}
                show={apparition >= 1}
                apparition={apparition}
              />
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Récap "Wrapped" — awards de fin de soirée */}
        {isEveningFinale && isFinal && awards && awards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="relative z-20 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 px-4 pb-6"
          >
            {awards.map((award) => (
              <div
                key={award.type}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md"
              >
                <span className="text-lg">{AWARD_ICONS[award.type]}</span>
                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] tracking-widest text-white/40 uppercase"
                    style={{ fontFamily: "monospace" }}
                  >
                    {t(AWARD_LABEL_KEYS[award.type])}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {award.playerName}
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export default Podium
