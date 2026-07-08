import type { AwardType } from "@rahoot/common/types/game"
import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
import {
  BODY_FONT,
  DISPLAY_FONT,
  LABEL_FONT,
  PODIUM_CSS,
  PODIUM_THEME_TOKENS,
  ThemeAmbient,
  ThemeAvatarFrame,
  pickRandomPodiumTheme,
  type PodiumThemeTokens,
} from "@rahoot/web/features/game/components/states/podium/themes"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import {
  HAPTIC_PATTERNS,
  vibrate,
} from "@rahoot/web/features/game/utils/haptics"
import { MOTION_EASE } from "@rahoot/web/features/game/utils/motion"
import useScreenSize from "@rahoot/web/hooks/useScreenSize"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"
import ReactConfetti from "react-confetti"
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

// Proportions du podium (hauteur socle / taille avatar) par rang.
const RANK_LAYOUT = {
  1: { h: "64%", avatarSize: 108 },
  2: { h: "48%", avatarSize: 86 },
  3: { h: "35%", avatarSize: 78 },
} as const

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

// Badge vainqueur : skewé façon case de BD pour manga, pilule accent sinon.
const WinnerBadge = ({ theme }: { theme: PodiumThemeTokens }) => {
  const badgeAccent = theme.ranks[1].accent

  if (theme.id === "manga") {
    return (
      <div
        className="skew-x-12 px-5 py-1"
        style={{
          background: badgeAccent,
          border: "3px solid #000000",
          boxShadow: "6px 6px 0px rgba(0,0,0,1)",
        }}
      >
        <span
          className="text-sm font-black uppercase italic"
          style={{ fontFamily: DISPLAY_FONT, color: "#131317" }}
        >
          {theme.winnerLabel}
        </span>
      </div>
    )
  }

  return (
    <div
      className="rounded-full px-5 py-1"
      style={{
        background: badgeAccent,
        boxShadow: `0 0 20px ${badgeAccent}80`,
      }}
    >
      <span
        className="text-xs font-bold tracking-[0.2em] uppercase"
        style={{ fontFamily: LABEL_FONT, color: "#131317" }}
      >
        {theme.winnerLabel}
      </span>
    </div>
  )
}

// Étoile dorée au-dessus du vainqueur (remplace le trophée générique).
const WinnerStar = ({ color }: { color: string }) => (
  <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M12 2 L14.6 8.6 L21.6 9.2 L16.3 13.8 L18 20.8 L12 17 L6 20.8 L7.7 13.8 L2.4 9.2 L9.4 8.6 Z"
      fill={color}
      style={{ filter: `drop-shadow(0 0 8px ${color})` }}
    />
  </svg>
)

// Faisceau lumineux qui s'allume au moment précis du reveal d'un rang.
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
        animate={{ opacity: [0, 0.8, 0.3], scaleY: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="pointer-events-none absolute inset-x-0 top-0 z-0 origin-top"
        style={{
          height: "140%",
          background: `linear-gradient(180deg, ${color}45 0%, ${color}12 40%, transparent 70%)`,
        }}
      />
    )}
  </AnimatePresence>
)

// Flash au reveal du gagnant, façon flash d'appareil photo.
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
          animate={{ opacity: [0, 1, 0.6, 0] }}
          transition={{ duration: 0.5, times: [0, 0.08, 0.3, 1] }}
          className="pointer-events-none absolute inset-0 z-50"
          style={{ backgroundColor: "#FFF3D6" }}
        />
      )}
    </AnimatePresence>
  )
}

// Rayons colorés depuis le bas au reveal final, teintés du thème.
const ThemeRays = ({ active, color }: { active: boolean; color: string }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: [0, 0.3, 0.12] }}
            transition={{ duration: 0.9, delay: i * 0.06, ease: "easeOut" }}
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{
              width: 2,
              height: "85%",
              transformOrigin: "bottom center",
              transform: `translateX(-50%) rotate(${(i - 4.5) * 14}deg)`,
              background: `linear-gradient(to top, ${color}b3 0%, transparent 100%)`,
            }}
          />
        ))}
      </motion.div>
    )}
  </AnimatePresence>
)

const PodiumPlace = ({
  player,
  rank,
  show,
  apparition,
  theme,
  reducedMotion,
}: {
  player: { username: string; avatar?: string; points: number }
  rank: 1 | 2 | 3
  show: boolean
  apparition: number
  theme: PodiumThemeTokens
  reducedMotion: boolean
}) => {
  const layout = RANK_LAYOUT[rank]
  const tokens = theme.ranks[rank]
  const isFirst = rank === 1
  const isFinal = apparition >= 4
  const [punch, setPunch] = useState(false)

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-end">
      <RankSpotlight color={tokens.accent} active={show} />

      {/* Zone flottante : badge vainqueur, avatar, nom */}
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
            {isFirst && (
              <AnimatePresence>
                {isFinal && (
                  <motion.div
                    key="winner-badge"
                    className="flex flex-col items-center gap-2"
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
                      <WinnerStar color={tokens.accent} />
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
                    >
                      <WinnerBadge theme={theme} />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Avatar dans le cadre du thème */}
            <ThemeAvatarFrame
              theme={theme}
              accent={tokens.accent}
              size={layout.avatarSize}
              rank={rank}
              isWinner={isFirst && isFinal}
              reducedMotion={reducedMotion}
            >
              <GameAvatar
                seed={player.avatar || player.username}
                animated
                animationStates={WINNING_ANIMATION_STATES}
                className="h-full w-full"
              />
            </ThemeAvatarFrame>

            {/* Nom */}
            <p
              className="max-w-[90%] truncate text-center font-bold"
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: isFirst ? 19 : 15,
                color: tokens.accent,
                textShadow:
                  theme.id === "manga"
                    ? "2px 2px 0px rgba(0,0,0,1)"
                    : `0 2px 10px rgba(0,0,0,0.6), 0 0 14px ${tokens.accent}40`,
              }}
            >
              {player.username}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Socle podium — enfant DIRECT de la colonne (hauteur définie via
          h-full) : la hauteur en % ne se résout pas sous un wrapper en
          hauteur auto. Le "punch" d'atterrissage est une animation CSS
          (transform) sur le même noeud : aucune collision avec framer,
          qui n'anime ici que la hauteur. */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: show ? layout.h : 0 }}
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
        className={`relative w-full overflow-hidden ${theme.blockRadiusClass}`}
        style={{
          ...tokens.blockStyle,
          transformOrigin: "bottom center",
          animation: punch ? "podium-punch 0.3s ease-out" : undefined,
          // Blason à épaules coupées pour le thème héros.
          ...(theme.id === "heros"
            ? {
                clipPath:
                  "polygon(5% 0%, 95% 0%, 100% 12%, 100% 100%, 0% 100%, 0% 12%)",
              }
            : {}),
        }}
      >
        {/* Texture mousse (jurassic) */}
        {theme.id === "jurassic" && (
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(34,197,94,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(21,128,61,0.2) 0%, transparent 50%)",
            }}
          />
        )}

        {/* Rayures diagonales sur le socle du vainqueur (manga) */}
        {theme.id === "manga" && isFirst && (
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              background: `repeating-linear-gradient(45deg, ${tokens.accent}, ${tokens.accent} 10px, #000 10px, #000 20px)`,
            }}
          />
        )}

        {/* Halo montant depuis la base (vainqueur, hors manga) */}
        {isFirst && theme.id !== "manga" && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${tokens.accent}26 0%, transparent 60%)`,
            }}
          />
        )}

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
                fontFamily: DISPLAY_FONT,
                fontSize: isFirst ? 26 : 19,
                color: tokens.accent,
                textShadow:
                  theme.id === "manga"
                    ? "2px 2px 0px rgba(0,0,0,1)"
                    : `0 0 12px ${tokens.accent}66`,
              }}
            >
              <ScoreCounter target={player.points} show={show} />
            </div>
            <div
              className="tracking-[0.3em] uppercase"
              style={{
                fontFamily: LABEL_FONT,
                fontSize: 9,
                color: tokens.accent,
                opacity: 0.65,
              }}
            >
              pts
            </div>
          </motion.div>

          {/* Numéral du rang en watermark */}
          <div
            className="font-black select-none"
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: isFirst ? 52 : 40,
              color: tokens.accent,
              opacity: 0.14,
              lineHeight: 1,
              marginTop: 4,
            }}
          >
            {rank}
          </div>
        </div>

        {/* Liseré bas accent (manga) / barre d'énergie (science) */}
        {theme.id === "manga" && (
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ height: isFirst ? 10 : 6, background: tokens.accent }}
          />
        )}
        {theme.id === "science" && (
          <div className="absolute inset-x-3 bottom-3 h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: show ? `${{ 1: 100, 2: 70, 3: 50 }[rank]}%` : 0,
              }}
              transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
              className="h-full"
              style={{
                background: tokens.accent,
                boxShadow: `0 0 10px ${tokens.accent}`,
              }}
            />
          </div>
        )}
      </motion.div>
    </div>
  )
}

// Rang qui vient d'être révélé à chaque palier d'apparition (avant le 1er,
// réservé au grand final apparition=4) — sert au mini burst de confettis.
const APPARITION_RANK: Partial<Record<number, 1 | 2 | 3>> = { 1: 3, 2: 2 }

const Podium = ({ data: { subject, top, awards, podiumTheme } }: Props) => {
  const apparition = usePodiumAnimation(top.length)
  const { isHost, isEveningFinale } = useGameConfig()
  const { player } = usePlayerStore()
  const { width, height } = useScreenSize()
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion() ?? false
  const isFinal = apparition >= 4

  // Thème résolu côté serveur ; tirage local de secours si absent (ancien
  // serveur). useMemo : le tirage ne doit pas changer entre deux renders.
  const theme = useMemo(
    () => PODIUM_THEME_TOKENS[podiumTheme ?? pickRandomPodiumTheme()],
    [podiumTheme],
  )

  let subtitle = "Et maintenant, le classement final..."

  if (isFinal) {
    subtitle = isEveningFinale
      ? "Le grand vainqueur de la soirée"
      : "Et le vainqueur est..."
  }

  // Mini burst de confettis localisé à l'annonce du 3e puis du 2e — le
  // 1er est réservé au grand confetti final (isFinal) pour garder le suspense.
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
    if (document.getElementById("podium-theme-css")) {
      return () => {
        // Noop
      }
    }

    const el = document.createElement("style")
    el.id = "podium-theme-css"
    el.textContent = PODIUM_CSS
    document.head.appendChild(el)

    return () => {
      el.remove()
    }
  }, [])

  const winnerAccent = theme.ranks[1].accent

  return (
    <motion.div
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.9, ease: MOTION_EASE.out }}
      className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden"
    >
      {/* Tremblement caméra pendant le roulement de tambour (apparition=3) —
          isolé sur un noeud à part pour ne jamais entrer en conflit avec le
          scale framer du conteneur parent. Désactivé en reduced-motion. */}
      <div
        className="flex h-full w-full flex-col items-center justify-between"
        style={
          apparition === 3 && !reducedMotion
            ? { animation: "podium-drumroll-shake 2.4s ease-in-out 1" }
            : undefined
        }
      >
        {/* Dégradé de base du thème */}
        <div
          className="absolute inset-0"
          style={{ background: theme.baseGradient }}
        />

        {/* Image d'ambiance .stitch, voilée */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${theme.bgImage})`,
            ...theme.bgStyle,
          }}
        />

        {/* Voile de lisibilité */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: theme.overlayGradient }}
        />

        {/* Vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.6) 100%)",
          }}
        />

        {/* Ambiance animée du thème (étoiles, particules, trames...) */}
        <ThemeAmbient theme={theme} reducedMotion={reducedMotion} />

        {/* Flash reveal 1er */}
        <RevealFlash trigger={isFinal} />

        {/* Rayons colorés du reveal final */}
        <ThemeRays active={isFinal} color={winnerAccent} />

        {/* Confettis aux couleurs du thème */}
        {isFinal && (
          <ReactConfetti
            width={width}
            height={height}
            className="pointer-events-none z-50"
            colors={theme.confetti}
            numberOfPieces={200}
            recycle={false}
            initialVelocityY={14}
            gravity={0.12}
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
            colors={[theme.ranks[burst.rank].accent, "#FFFFFF"]}
            numberOfPieces={40}
            recycle={false}
            initialVelocityY={12}
            gravity={0.22}
            confettiSource={{
              x: burst.rank === 3 ? width * 0.66 : 0,
              y: height * 0.75,
              w: width * 0.33,
              h: 10,
            }}
          />
        )}

        {/* Header — aucune mention de thème ; seule la finale de soirée
            affiche un libellé contextuel au-dessus du titre. */}
        <div className="relative z-20 flex w-full flex-col items-center gap-3 pt-6 md:pt-8">
          {isEveningFinale && (
            <div className="flex items-center gap-3">
              <div
                className="h-px w-16"
                style={{
                  background: `linear-gradient(to right, transparent, ${winnerAccent})`,
                }}
              />
              <div
                className="h-1.5 w-1.5 rotate-45"
                style={{ background: winnerAccent }}
              />
              <span
                className="text-[11px] tracking-[0.4em] uppercase"
                style={{
                  color: winnerAccent,
                  fontFamily: LABEL_FONT,
                  opacity: 0.9,
                }}
              >
                Grande finale de la soirée
              </span>
              <div
                className="h-1.5 w-1.5 rotate-45"
                style={{ background: winnerAccent }}
              />
              <div
                className="h-px w-16"
                style={{
                  background: `linear-gradient(to left, transparent, ${winnerAccent})`,
                }}
              />
            </div>
          )}

          {/* Titre — sujet du quiz stylé par le thème */}
          <h2
            className="px-4 text-center"
            style={{
              ...theme.titleStyle,
              fontSize: "clamp(1.6rem, 4.8vw, 3rem)",
              lineHeight: 1.1,
            }}
          >
            {subject}
          </h2>

          {/* Sous-titre suspense */}
          <p
            className="text-sm tracking-wide italic"
            style={theme.subtitleStyle}
          >
            {subtitle}
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
                theme={theme}
                reducedMotion={reducedMotion}
              />
            ) : (
              <div />
            )}

            <PodiumPlace
              player={top[0]}
              rank={1}
              show={apparition >= 3}
              apparition={apparition}
              theme={theme}
              reducedMotion={reducedMotion}
            />

            {top[2] ? (
              <PodiumPlace
                player={top[2]}
                rank={3}
                show={apparition >= 1}
                apparition={apparition}
                theme={theme}
                reducedMotion={reducedMotion}
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
                className="flex items-center gap-2 rounded-xl border px-3 py-2 backdrop-blur-md"
                style={{
                  borderColor: `${winnerAccent}40`,
                  background: "rgba(0,0,0,0.5)",
                }}
              >
                <span className="text-lg">{AWARD_ICONS[award.type]}</span>
                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] tracking-widest uppercase"
                    style={{
                      fontFamily: LABEL_FONT,
                      color: `${winnerAccent}99`,
                    }}
                  >
                    {t(AWARD_LABEL_KEYS[award.type])}
                  </span>
                  <span
                    className="text-sm font-bold text-white"
                    style={{ fontFamily: BODY_FONT }}
                  >
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
