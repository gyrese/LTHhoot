import logoImg from "@rahoot/web/assets/logo.png"
import { twMerge } from "tailwind-merge"

export type LoaderProps = {
  className?: string
  /** Force show or hide the central mascot logo (auto-detected if size is small) */
  showLogo?: boolean
  /** Custom logo source image URL */
  logoSrc?: string
  /** Optional loading label under the loader */
  text?: string
}

/**
 * Modern High-End Glowing Loader
 * Features:
 * - Floating owl mascot in center (if enlarged / standalone)
 * - Tapered golden light arc with intense neon radial glow
 * - Shimmering floating magic dust particles around the ring
 */
const Loader = ({
  className,
  showLogo,
  logoSrc = logoImg,
  text,
}: LoaderProps) => {
  // If user passes small utility classes like h-4, h-5, h-6, h-8, w-4, w-5, w-6, w-8 and didn't specify showLogo,
  // default to compact mode (no mascot) for inline buttons/badges.
  const isCompactClass =
    typeof className === "string" &&
    /\b(h-[3-9]|w-[3-9]|h-10|w-10|h-11|w-11|size-[3-9]|size-10)\b/u.test(
      className,
    )

  const renderLogo = showLogo ?? !isCompactClass

  // Compact inline spinner for buttons & badges
  if (!renderLogo) {
    return (
      <div
        className={twMerge(
          "relative inline-flex aspect-square h-8 w-8 items-center justify-center select-none",
          className,
        )}
      >
        <svg
          className="h-full w-full animate-spin text-amber-500"
          viewBox="0 0 100 100"
          fill="none"
        >
          <defs>
            <linearGradient
              id="compactGrad"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FFF3B0" stopOpacity="1" />
              <stop offset="40%" stopColor="#F59E0B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
            </linearGradient>
            <filter
              id="compactGlow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Subtle bg ring */}
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="rgba(245, 158, 11, 0.15)"
            strokeWidth="8"
          />
          {/* Main glowing arc */}
          <path
            d="M 50,12 A 38,38 0 0,1 88,50"
            stroke="url(#compactGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            filter="url(#compactGlow)"
          />
        </svg>
      </div>
    )
  }

  // Full Hero / Mascot Loader
  return (
    <div
      className={twMerge(
        "flex flex-col items-center justify-center gap-4 select-none",
        className,
      )}
    >
      <div className="relative flex h-48 w-48 max-w-full items-center justify-center">
        {/* Ambient background glow */}
        <div
          className="pointer-events-none absolute inset-2 animate-pulse rounded-full opacity-60 blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(217, 119, 6, 0.1) 60%, transparent 80%)",
          }}
        />

        {/* Floating Mascot in Center */}
        <div className="relative z-10 flex h-28 w-28 animate-[loaderFloat_3s_ease-in-out_infinite] items-center justify-center">
          <img
            src={logoSrc}
            alt="Mascot"
            className="h-full w-auto object-contain drop-shadow-[0_10px_20px_rgba(245,158,11,0.35)]"
          />
        </div>

        {/* Orbiting Golden Ring & Magic Dust */}
        <svg
          className="absolute inset-0 h-full w-full animate-[loaderRotate_2.8s_linear_infinite]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <defs>
            {/* Gradient head-to-tail for the glowing light ring */}
            <linearGradient
              id="owlRingGrad"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="15%" stopColor="#FFE066" stopOpacity="1" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.85" />
              <stop offset="85%" stopColor="#D97706" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
            </linearGradient>

            {/* Neon Drop Shadow Glow */}
            <filter
              id="owlGlowFilter"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="5" result="blur1" />
              <feGaussianBlur stdDeviation="10" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Faint static background track */}
          <circle
            cx="100"
            cy="100"
            r="82"
            stroke="rgba(245, 158, 11, 0.12)"
            strokeWidth="3.5"
          />

          {/* Main Tapered Glowing Arc */}
          <path
            d="M 100,18 A 82,82 0 1,1 25,135"
            stroke="url(#owlRingGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#owlGlowFilter)"
          />

          {/* Glowing head tip accent */}
          <circle
            cx="100"
            cy="18"
            r="4.5"
            fill="#FFFFFF"
            filter="drop-shadow(0 0 6px #FFE066)"
          />
        </svg>

        {/* Orbiting Magic Sparkle Particles */}
        <div className="pointer-events-none absolute inset-0 animate-[loaderRotate_5s_linear_infinite_reverse]">
          {[
            { angle: 15, radius: 82, size: 4, delay: 0 },
            { angle: 45, radius: 86, size: 2.5, delay: 0.3 },
            { angle: 90, radius: 78, size: 3.5, delay: 0.7 },
            { angle: 135, radius: 84, size: 3, delay: 1.1 },
            { angle: 170, radius: 80, size: 4.5, delay: 0.5 },
            { angle: 210, radius: 85, size: 2, delay: 1.4 },
            { angle: 250, radius: 79, size: 3.5, delay: 0.9 },
            { angle: 290, radius: 83, size: 3, delay: 0.2 },
            { angle: 330, radius: 87, size: 2.5, delay: 1.6 },
          ].map((pt, idx) => {
            const rad = (pt.angle * Math.PI) / 180
            const x = 50 + (pt.radius / 200) * 100 * Math.cos(rad)
            const y = 50 + (pt.radius / 200) * 100 * Math.sin(rad)

            return (
              <span
                key={idx}
                className="absolute animate-pulse rounded-full bg-amber-200 shadow-[0_0_8px_#f59e0b]"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${pt.size}px`,
                  height: `${pt.size}px`,
                  transform: "translate(-50%, -50%)",
                  animationDelay: `${pt.delay}s`,
                }}
              />
            )
          })}
        </div>
      </div>

      {text && (
        <p className="animate-pulse text-center text-sm font-semibold tracking-wide text-amber-200/90 drop-shadow-md">
          {text}
        </p>
      )}

      {/* Keyframe Styles */}
      <style>{`
        @keyframes loaderRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes loaderFloat {
          0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); }
          50% { transform: translateY(-7px) scale(1.04) rotate(1deg); }
        }
      `}</style>
    </div>
  )
}

export default Loader
