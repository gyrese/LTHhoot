import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import { HAPTIC_PATTERNS, vibrate } from "@rahoot/web/features/game/utils/haptics"
import useScreenSize from "@rahoot/web/hooks/useScreenSize"
import { motion, AnimatePresence } from "motion/react"
import { useEffect, useState } from "react"
import ReactConfetti from "react-confetti"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
import useSound from "use-sound"

type Props = {
  data: ManagerStatusDataMap["FINISHED"]
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
`

const usePodiumAnimation = (topLength: number) => {
  const [apparition, setApparition] = useState(0)
  const { isHost } = useGameConfig()
  const [sfxtThree] = useSound(SFX.PODIUM.THREE, { volume: 0.2 })
  const [sfxSecond] = useSound(SFX.PODIUM.SECOND, { volume: 0.2 })
  const [sfxRool, { stop: sfxRoolStop }] = useSound(SFX.PODIUM.SNEAR_ROOL, { volume: 0.2 })
  const [sfxFirst] = useSound(SFX.PODIUM.FIRST, { volume: 0.2 })

  useEffect(() => {
    if (!isHost) {return}

    const actions: Partial<Record<number, () => void>> = {
      4: () => { sfxRoolStop(); sfxFirst() },
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
    if (!show) {return}

    const duration = 1200
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setDisplayed(Math.round((1 - (1 - p)**3) * target))

      if (p < 1) {requestAnimationFrame(tick)}
    }
    requestAnimationFrame(tick)
  }, [show, target])

  
return <>{displayed.toLocaleString()}</>
}

const RANK = {
  1: { neon: "#FAFF00", dim: "#FAFF0030", label: "01", h: "62%", avatarSize: 96 },
  2: { neon: "#00F5FF", dim: "#00F5FF30", label: "02", h: "46%", avatarSize: 76 },
  3: { neon: "#FF00E5", dim: "#FF00E530", label: "03", h: "32%", avatarSize: 68 },
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
              background: "linear-gradient(to top, #FAFF00CC 0%, transparent 100%)",
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
    <div className="absolute top-0 left-0 w-3 h-3" style={{ background: color, boxShadow: neonShadow(color) }} />
    <div className="absolute top-0 right-0 w-3 h-3" style={{ background: color, boxShadow: neonShadow(color) }} />
    <div className="absolute top-3 left-0 w-3 h-1" style={{ background: color, opacity: 0.5 }} />
    <div className="absolute top-3 right-0 w-3 h-1" style={{ background: color, opacity: 0.5 }} />
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

  return (
    <div className="flex h-full w-full flex-col items-center justify-end">
      {/* Zone flottante */}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 22, delay: isFirst ? 0.25 : 0 }}
            className="flex flex-col items-center gap-2 pb-2"
          >
            {/* Badge VAINQUEUR 1er uniquement */}
            {isFirst && (
              <AnimatePresence>
                {isFinal && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 350, damping: 14 }}
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
                )}
              </AnimatePresence>
            )}

            {/* Avatar — cadre néon sharp */}
            <motion.div
              animate={{
                boxShadow: isFinal && isFirst
                  ? [shadow, shadowStrong, shadow]
                  : shadow,
              }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
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
                  background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px)",
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

      {/* Bloc podium néon */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: show ? cfg.h : 0 }}
        transition={{ type: "spring", stiffness: 55, damping: 16, delay: isFirst ? 0.45 : 0 }}
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
            transition={{ type: "spring", stiffness: 180, delay: isFirst ? 0.75 : 0.2 }}
            className="text-center"
          >
            <div
              className="font-black tabular-nums leading-none"
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
            className="select-none font-black"
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
    </div>
  )
}

const Podium = ({ data: { subject, top } }: Props) => {
  const apparition = usePodiumAnimation(top.length)
  const { salonImage } = useManagerStore()
  const { isHost, isEveningFinale } = useGameConfig()
  const { player } = usePlayerStore()
  const { width, height } = useScreenSize()
  const isFinal = apparition >= 4

  // Vibration côté joueur au moment précis où c'est LUI qui est révélé sur le
  // podium (rang 3 à apparition=1, rang 2 à apparition=2, rang 1 à apparition=4
  // — cf. les seuils `show={apparition >= n}` de chaque PodiumPlace ci-dessous).
  useEffect(() => {
    if (isHost || !player) {
      return
    }

    const revealedRank = apparition === 1 ? 3 : apparition === 2 ? 2 : apparition === 4 ? 1 : null

    if (revealedRank === null) {
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
    <div
      className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden"
      style={{ backgroundColor: "#000000" }}
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
          colors={["#FAFF00", "#00F5FF", "#FF00E5", "#FFFFFF", "#FF6600", "#00FF88"]}
          numberOfPieces={320}
          recycle={false}
          initialVelocityY={18}
          gravity={0.15}
        />
      )}

      {/* Header */}
      <div className="relative z-20 flex w-full flex-col items-center gap-2 pt-6 md:pt-8">
        {/* Ligne décorative */}
        <div className="flex w-full max-w-lg items-center gap-3 px-6">
          <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, #FAFF00CC)" }} />
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
          <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, #FAFF00CC)" }} />
        </div>

        {/* Titre avec glitch */}
        <h2
          className="text-center font-black uppercase text-white"
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
          <span style={{ animation: "cursor-blink 1s step-end infinite" }}>█</span>
        </p>
      </div>

      {/* Grille podium */}
      <div className="relative z-20 flex w-full max-w-3xl flex-1 items-end px-2 pb-0">
        <div className="grid h-full w-full grid-cols-3 items-end gap-1 md:gap-2">
          {top[1] ? (
            <PodiumPlace player={top[1]} rank={2} show={apparition >= 2} apparition={apparition} />
          ) : <div />}

          <PodiumPlace player={top[0]} rank={1} show={apparition >= 3} apparition={apparition} />

          {top[2] ? (
            <PodiumPlace player={top[2]} rank={3} show={apparition >= 1} apparition={apparition} />
          ) : <div />}
        </div>
      </div>
    </div>
  )
}

export default Podium
