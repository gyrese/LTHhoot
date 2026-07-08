import type { PodiumThemeId } from "@rahoot/common/types/game"
import { PODIUM_THEMES } from "@rahoot/common/constants"
import { motion } from "motion/react"
import { useMemo, type CSSProperties, type ReactNode } from "react"

// ─── Polices (maquettes .stitch : Anybody / Plus Jakarta Sans / Geist) ───────

export const DISPLAY_FONT = "'Anybody', 'Outfit', sans-serif"
export const BODY_FONT = "'Plus Jakarta Sans', 'Outfit', sans-serif"
export const LABEL_FONT = "'Geist', 'Outfit', sans-serif"

// ─── Tokens ──────────────────────────────────────────────────────────────────

export type PodiumRankTokens = {
  // Couleur pleine du rang : nom, numéral, bordures, glows.
  accent: string
  // Fond du socle.
  blockStyle: CSSProperties
}

export type PodiumThemeTokens = {
  id: PodiumThemeId
  titleStyle: CSSProperties
  subtitleStyle: CSSProperties
  // Fond : dégradé de base + image .stitch voilée + voile de lisibilité.
  baseGradient: string
  bgImage: string
  bgStyle: CSSProperties
  overlayGradient: string
  ambient: "stars" | "amber" | "manga" | "lab" | "comic"
  avatarShape: "hologram" | "fossil" | "burst" | "hex" | "crest"
  winnerLabel: string
  confetti: string[]
  blockRadiusClass: string
  ranks: Record<1 | 2 | 3, PodiumRankTokens>
}

// Socle "verre" partagé (espace / science) — teinté par l'accent du rang.
const glassBlock = (accent: string, strong = false): CSSProperties => ({
  background: strong
    ? `linear-gradient(180deg, ${accent}26 0%, rgba(255,255,255,0.05) 60%)`
    : "rgba(255,255,255,0.05)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderTop: `${strong ? 3 : 2}px solid ${accent}66`,
  boxShadow: `inset 0 0 20px ${accent}33`,
})

// Socle "pierre" (jurassic / héros).
const stoneBlock = (accent: string): CSSProperties => ({
  background: "linear-gradient(135deg, #353439 0%, #1b1b1f 100%)",
  borderTop: `4px solid ${accent}66`,
  boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
})

export const PODIUM_THEME_TOKENS: Record<PodiumThemeId, PodiumThemeTokens> = {
  espace: {
    id: "espace",
    titleStyle: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "-0.02em",
      color: "#ffffff",
      textShadow: "0 0 15px rgba(0,238,252,0.5)",
    },
    subtitleStyle: { color: "#7df4ff", fontFamily: BODY_FONT },
    baseGradient:
      "radial-gradient(ellipse at 50% 20%, #1c1030 0%, #131317 55%, #0e0e12 100%)",
    bgImage: "/podium/espace.jpg",
    bgStyle: { opacity: 0.55 },
    overlayGradient:
      "linear-gradient(to top, #131317 0%, transparent 40%, rgba(19,19,23,0.5) 100%)",
    ambient: "stars",
    avatarShape: "hologram",
    winnerLabel: "Champion",
    confetti: ["#f1c100", "#00eefc", "#ffffff", "#ffc3c5"],
    blockRadiusClass: "rounded-t-xl",
    ranks: {
      1: { accent: "#f1c100", blockStyle: glassBlock("#f1c100", true) },
      2: { accent: "#00eefc", blockStyle: glassBlock("#00eefc") },
      3: { accent: "#ffc3c5", blockStyle: glassBlock("#ffc3c5") },
    },
  },
  jurassic: {
    id: "jurassic",
    titleStyle: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 900,
      textTransform: "uppercase",
      color: "#ffcc00",
      textShadow: "0 0 15px rgba(255,204,0,0.4)",
    },
    subtitleStyle: { color: "#d2c5ab", fontFamily: BODY_FONT },
    baseGradient:
      "radial-gradient(ellipse at 50% 100%, #1c1a0e 0%, #131317 60%, #0e0e12 100%)",
    bgImage: "/podium/jurassic.jpg",
    bgStyle: { opacity: 0.4, transform: "scale(1.1)" },
    overlayGradient:
      "linear-gradient(to bottom, transparent 0%, rgba(19,19,23,0.6) 60%, #131317 100%)",
    ambient: "amber",
    avatarShape: "fossil",
    winnerLabel: "Champion",
    confetti: ["#ffcc00", "#ffedc3", "#7df4ff", "#9a9078"],
    blockRadiusClass: "rounded-t-xl",
    ranks: {
      1: { accent: "#ffcc00", blockStyle: stoneBlock("#ffcc00") },
      2: { accent: "#7df4ff", blockStyle: stoneBlock("#7df4ff") },
      3: { accent: "#ffb3b5", blockStyle: stoneBlock("#ffb3b5") },
    },
  },
  manga: {
    id: "manga",
    titleStyle: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 900,
      fontStyle: "italic",
      textTransform: "uppercase",
      letterSpacing: "-0.04em",
      color: "#ffedc3",
      textShadow: "4px 4px 0px rgba(0,0,0,1)",
    },
    subtitleStyle: { color: "#ffedc3", fontFamily: BODY_FONT },
    baseGradient: "linear-gradient(180deg, #1b1b1f 0%, #131317 100%)",
    bgImage: "/podium/manga.jpg",
    bgStyle: { opacity: 0.35, filter: "grayscale(1) contrast(1.25)" },
    overlayGradient:
      "linear-gradient(to top, #131317 0%, transparent 45%, rgba(19,19,23,0.5) 100%)",
    ambient: "manga",
    avatarShape: "burst",
    winnerLabel: "WIN !",
    confetti: ["#ffcc00", "#00eefc", "#ffc3c5", "#000000"],
    blockRadiusClass: "",
    ranks: {
      1: {
        accent: "#ffcc00",
        blockStyle: {
          background: "#353439",
          border: "4px solid #000000",
          borderBottom: "none",
        },
      },
      2: {
        accent: "#00eefc",
        blockStyle: {
          background: "#2a2a2e",
          border: "4px solid #000000",
          borderBottom: "none",
        },
      },
      3: {
        accent: "#ffc3c5",
        blockStyle: {
          background: "#2a2a2e",
          border: "4px solid #000000",
          borderBottom: "none",
        },
      },
    },
  },
  science: {
    id: "science",
    titleStyle: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "-0.03em",
      color: "#ffedc3",
      textShadow: "0 0 20px rgba(255,237,195,0.4)",
    },
    subtitleStyle: { color: "#7df4ff", fontFamily: BODY_FONT },
    baseGradient:
      "radial-gradient(circle at 50% 40%, #23232a 0%, #131317 60%, #0e0e12 100%)",
    bgImage: "/podium/science.jpg",
    bgStyle: { opacity: 0.3 },
    overlayGradient:
      "linear-gradient(to top, #131317 0%, transparent 50%, rgba(19,19,23,0.4) 100%)",
    ambient: "lab",
    avatarShape: "hex",
    winnerLabel: "Nouveau record",
    confetti: ["#ffedc3", "#00eefc", "#00dbe9", "#ffffff"],
    blockRadiusClass: "rounded-t-xl",
    ranks: {
      1: { accent: "#ffedc3", blockStyle: glassBlock("#ffedc3", true) },
      2: { accent: "#00eefc", blockStyle: glassBlock("#00eefc") },
      3: { accent: "#00dbe9", blockStyle: glassBlock("#00dbe9") },
    },
  },
  heros: {
    id: "heros",
    titleStyle: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 900,
      fontStyle: "italic",
      textTransform: "uppercase",
      color: "#ffcc00",
      textShadow: "0 0 15px rgba(255,204,0,0.5)",
    },
    subtitleStyle: { color: "#d3fbff", fontFamily: BODY_FONT },
    baseGradient:
      "linear-gradient(180deg, #16203a 0%, #131317 55%, #0e0e12 100%)",
    bgImage: "/podium/heros.jpg",
    bgStyle: { opacity: 0.4 },
    overlayGradient:
      "linear-gradient(180deg, rgba(19,19,23,0) 0%, rgba(19,19,23,0.8) 70%, #131317 100%)",
    ambient: "comic",
    avatarShape: "crest",
    winnerLabel: "Champion",
    confetti: ["#ffcc00", "#00eefc", "#ffb4ab", "#ffffff"],
    blockRadiusClass: "",
    ranks: {
      1: { accent: "#ffcc00", blockStyle: stoneBlock("#ffcc00") },
      2: { accent: "#00eefc", blockStyle: stoneBlock("#00eefc") },
      3: { accent: "#ffb3b5", blockStyle: stoneBlock("#ffb3b5") },
    },
  },
}

// Tirage client de secours si un ancien serveur n'envoie pas le thème.
export const pickRandomPodiumTheme = (): PodiumThemeId =>
  PODIUM_THEMES[Math.floor(Math.random() * PODIUM_THEMES.length)]!

// ─── Keyframes injectés une seule fois ───────────────────────────────────────

export const PODIUM_CSS = `
  @keyframes podium-twinkle {
    from { opacity: 0.15; transform: scale(1); }
    to { opacity: 0.9; transform: scale(1.5); }
  }
  @keyframes podium-rotate-glow {
    0% { transform: rotate(0deg) scale(1); opacity: 0.8; }
    50% { transform: rotate(180deg) scale(1.05); opacity: 1; }
    100% { transform: rotate(360deg) scale(1); opacity: 0.8; }
  }
  @keyframes podium-speed-dots {
    0% { transform: scale(1); opacity: 0.12; }
    50% { transform: scale(1.08); opacity: 0.2; }
    100% { transform: scale(1); opacity: 0.12; }
  }
  /* Punch d'atterrissage du socle quand il atteint sa hauteur finale. */
  @keyframes podium-punch {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  /* Tremblement caméra pendant le roulement de tambour : silence les 70%
     premiers (suspense), puis secousse croissante juste avant le reveal. */
  @keyframes podium-drumroll-shake {
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

// ─── Couches d'ambiance ──────────────────────────────────────────────────────

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// Particules qui montent lentement (jurassic / science / héros).
const RisingParticles = ({
  colors,
  count = 10,
}: {
  colors: string[]
  count?: number
}) => {
  const particles = useMemo(
    () =>
      range(count).map((i) => ({
        x: Math.random() * 100,
        delay: Math.random() * 4,
        duration: 6 + Math.random() * 4,
        size: 2 + Math.random() * 3,
        color: colors[i % colors.length]!,
      })),
    [colors, count],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: "-4%",
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 6px ${p.color}`,
          }}
          animate={{ y: [0, -700], opacity: [0, 0.7, 0.7, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
            times: [0, 0.1, 0.85, 1],
          }}
        />
      ))}
    </div>
  )
}

// Étoiles scintillantes (espace).
const Starfield = () => {
  const stars = useMemo(
    () =>
      range(70).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: 1 + Math.random() * 3,
        delay: Math.random() * 5,
      })),
    [],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute h-0.5 w-0.5 rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            animation: `podium-twinkle ${s.duration}s ${s.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  )
}

// Trame manga : points halftone pulsés + vitesse.
const MangaLayer = () => (
  <div
    className="pointer-events-none absolute inset-0"
    style={{
      backgroundImage:
        "radial-gradient(circle, transparent 20%, #000 20%, #000 21%, transparent 21%, transparent 30%, #000 30%, #000 31%, transparent 31%)",
      backgroundSize: "10px 10px",
      animation: "podium-speed-dots 0.9s infinite linear",
    }}
  />
)

// Grille "blueprint" du labo (science).
const LabGrid = () => (
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.07]"
    style={{
      backgroundImage:
        "linear-gradient(#00eefc 1px, transparent 1px), linear-gradient(90deg, #00eefc 1px, transparent 1px)",
      backgroundSize: "48px 48px",
    }}
  />
)

// Halftone comics + projecteurs de la ville (héros).
const ComicLayer = () => (
  <>
    <div
      className="pointer-events-none absolute inset-0 opacity-50 mix-blend-soft-light"
      style={{
        backgroundImage: "radial-gradient(#ffffff22 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    />
    <div
      className="pointer-events-none absolute inset-0 opacity-20"
      style={{
        background:
          "conic-gradient(from 200deg at 20% 100%, transparent 82deg, rgba(0,238,252,0.35) 90deg, transparent 98deg), conic-gradient(from 160deg at 80% 100%, transparent 82deg, rgba(255,204,0,0.3) 90deg, transparent 98deg)",
      }}
    />
  </>
)

export const ThemeAmbient = ({
  theme,
  reducedMotion,
}: {
  theme: PodiumThemeTokens
  reducedMotion: boolean
}) => {
  switch (theme.ambient) {
    case "stars":
      return reducedMotion ? null : <Starfield />

    case "amber":
      return reducedMotion ? null : (
        <RisingParticles colors={["#ffcc00", "#ffedc3"]} count={12} />
      )

    case "manga":
      return reducedMotion ? null : <MangaLayer />

    case "lab":
      return (
        <>
          <LabGrid />
          {!reducedMotion && (
            <RisingParticles colors={["#00eefc", "#00dbe9"]} count={8} />
          )}
        </>
      )

    case "comic":
      return (
        <>
          <ComicLayer />
          {!reducedMotion && (
            <RisingParticles
              colors={["#ffcc00", "#00eefc", "#ffb4ab"]}
              count={10}
            />
          )}
        </>
      )

    default:
      return null
  }
}

// ─── Cadres d'avatar ─────────────────────────────────────────────────────────

const FOSSIL_CLIP =
  "polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)"
const HEX_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)"
const CREST_CLIP =
  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
const IMPACT_STAR_CLIP =
  "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"

// Enveloppe l'avatar du joueur dans le cadre du thème (halo hologramme,
// fossile, explosion manga, hexagone labo, blason héros).
export const ThemeAvatarFrame = ({
  theme,
  accent,
  size,
  rank,
  isWinner,
  reducedMotion,
  children,
}: {
  theme: PodiumThemeTokens
  accent: string
  size: number
  rank: 1 | 2 | 3
  isWinner: boolean
  reducedMotion: boolean
  children: ReactNode
}) => {
  switch (theme.avatarShape) {
    case "hologram":
      return (
        <div className="relative" style={{ width: size, height: size }}>
          <div
            className="pointer-events-none absolute rounded-full"
            style={{
              inset: -4,
              border: `2px solid ${accent}`,
              boxShadow: `0 0 15px ${accent}`,
              animation: reducedMotion
                ? undefined
                : "podium-rotate-glow 4s linear infinite",
            }}
          />
          <div
            className="h-full w-full overflow-hidden rounded-full"
            style={{
              border: `3px solid ${accent}`,
              boxShadow: isWinner ? `0 0 30px ${accent}` : undefined,
            }}
          >
            {children}
          </div>
        </div>
      )

    case "fossil":
      return (
        <div
          style={{
            width: size,
            height: size,
            padding: 6,
            clipPath: FOSSIL_CLIP,
            background: "linear-gradient(135deg, #4e4632 0%, #353439 100%)",
            boxShadow: `0 0 ${isWinner ? 40 : 20}px ${accent}66`,
          }}
        >
          <div
            className="h-full w-full overflow-hidden"
            style={{ clipPath: FOSSIL_CLIP }}
          >
            {children}
          </div>
        </div>
      )

    case "burst":
      return (
        <div className="relative" style={{ width: size, height: size }}>
          <div
            className={`pointer-events-none absolute ${reducedMotion ? "" : "animate-pulse"}`}
            style={{
              inset: -size * 0.18,
              clipPath: IMPACT_STAR_CLIP,
              background: accent,
              opacity: isWinner ? 0.6 : 0.4,
            }}
          />
          <div
            className="relative h-full w-full overflow-hidden rounded-full"
            style={{
              border: "4px solid #000000",
              boxShadow: `0 0 0 4px ${accent}80${isWinner ? `, 0 0 50px ${accent}66` : ""}`,
            }}
          >
            {children}
          </div>
          {/* Badge de rang façon case de BD */}
          <div
            className="absolute -right-2 -bottom-2 rotate-12 px-2"
            style={{
              background: "#000000",
              border: `2px solid ${accent}`,
              color: accent,
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize: size * 0.22,
            }}
          >
            {rank}
          </div>
        </div>
      )

    case "hex":
      return (
        <div
          style={{
            width: size,
            height: size,
            padding: 4,
            clipPath: HEX_CLIP,
            background: `${accent}4d`,
            filter: isWinner ? `drop-shadow(0 0 20px ${accent}66)` : undefined,
          }}
        >
          <div
            className="h-full w-full overflow-hidden"
            style={{
              clipPath: HEX_CLIP,
              border: `2px solid ${accent}`,
              background: "#353439",
            }}
          >
            {children}
          </div>
        </div>
      )

    case "crest":
      return (
        <div
          style={{
            width: size,
            height: size,
            padding: 4,
            clipPath: CREST_CLIP,
            background: `linear-gradient(45deg, ${accent}, #131317)`,
            filter: `drop-shadow(0 0 ${isWinner ? 30 : 12}px ${accent}66)`,
          }}
        >
          <div
            className="h-full w-full overflow-hidden"
            style={{ clipPath: CREST_CLIP, background: "#2a2a2e" }}
          >
            {children}
          </div>
        </div>
      )

    default:
      return <>{children}</>
  }
}
