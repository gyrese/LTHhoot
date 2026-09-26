import {
  POWER_UP_TYPE,
  POWER_UP_RARITY,
  type PowerUpType,
  type PowerUpRarity,
} from "@rahoot/common/types/powerup"
import {
  Bomb,
  Crown,
  Flame,
  Gauge,
  Gift,
  LifeBuoy,
  type LucideIcon,
  RefreshCw,
  Repeat2,
  Shield,
  ShieldX,
  Shuffle,
  Skull,
  Snowflake,
  Sparkles,
  Star,
  Swords,
  Target,
  Zap,
} from "lucide-react"
import i18n from "@rahoot/web/i18n"

export interface PowerUpMetaUI {
  type: PowerUpType
  rarity: PowerUpRarity
  Icon: LucideIcon
  label: string
  description: string
  color: string
}

// Libellés et descriptions traduits (game:powerups.*). Exposés en getters
// pour conserver la forme des données (`meta.label`, `meta.description`) chez
// tous les consommateurs, y compris hors de l'écran de jeu : la langue
// courante est lue à chaque accès, les composants qui utilisent
// `useTranslation` se re-rendent au changement de langue.
const createMeta = (
  type: PowerUpType,
  rarity: PowerUpRarity,
  Icon: LucideIcon,
  color: string,
): PowerUpMetaUI => ({
  type,
  rarity,
  Icon,
  color,
  get label() {
    return i18n.t(`game:powerups.${type}.label`)
  },
  get description() {
    return i18n.t(`game:powerups.${type}.description`)
  },
})

// Couleurs par rareté
export const RARITY_STYLE: Record<
  PowerUpRarity,
  {
    bg: string
    border: string
    glow: string
    ring: string
    text: string
    label: string
  }
> = {
  COMMON: {
    bg: "bg-slate-800/70",
    border: "border-slate-400/40",
    glow: "shadow-slate-400/20",
    ring: "ring-slate-300/30",
    text: "text-slate-200",
    get label() {
      return i18n.t("game:powerups.rarity.COMMON")
    },
  },
  RARE: {
    bg: "bg-blue-900/70",
    border: "border-blue-400/60",
    glow: "shadow-blue-400/40",
    ring: "ring-blue-300/50",
    text: "text-blue-200",
    get label() {
      return i18n.t("game:powerups.rarity.RARE")
    },
  },
  LEGENDARY: {
    bg: "bg-gradient-to-br from-yellow-700/80 via-amber-600/80 to-yellow-800/80",
    border: "border-yellow-300/80",
    glow: "shadow-yellow-300/60",
    ring: "ring-yellow-200/70",
    text: "text-yellow-100",
    get label() {
      return i18n.t("game:powerups.rarity.LEGENDARY")
    },
  },
}

export const POWER_UP_META_UI: Record<PowerUpType, PowerUpMetaUI> = {
  // ── Commun (icônes provisoires Lucide) ──────────────────────────────────────
  [POWER_UP_TYPE.SHIELD]: createMeta(
    POWER_UP_TYPE.SHIELD,
    POWER_UP_RARITY.COMMON,
    Shield,
    "#94A3B8",
  ),
  [POWER_UP_TYPE.FREEZE]: createMeta(
    POWER_UP_TYPE.FREEZE,
    POWER_UP_RARITY.COMMON,
    Snowflake,
    "#94A3B8",
  ),
  [POWER_UP_TYPE.SAFETY_NET]: createMeta(
    POWER_UP_TYPE.SAFETY_NET,
    POWER_UP_RARITY.COMMON,
    LifeBuoy,
    "#94A3B8",
  ),
  [POWER_UP_TYPE.SCRAMBLE]: createMeta(
    POWER_UP_TYPE.SCRAMBLE,
    POWER_UP_RARITY.COMMON,
    Shuffle,
    "#94A3B8",
  ),
  [POWER_UP_TYPE.SPARK]: createMeta(
    POWER_UP_TYPE.SPARK,
    POWER_UP_RARITY.COMMON,
    Sparkles,
    "#94A3B8",
  ),
  [POWER_UP_TYPE.DIESEL]: createMeta(
    POWER_UP_TYPE.DIESEL,
    POWER_UP_RARITY.COMMON,
    Gauge,
    "#94A3B8",
  ),

  // ── Rare ────────────────────────────────────────────────────────────────────
  [POWER_UP_TYPE.DOUBLE_POINTS]: createMeta(
    POWER_UP_TYPE.DOUBLE_POINTS,
    POWER_UP_RARITY.RARE,
    Zap,
    "#60A5FA",
  ),
  [POWER_UP_TYPE.STEAL_POINTS]: createMeta(
    POWER_UP_TYPE.STEAL_POINTS,
    POWER_UP_RARITY.RARE,
    Swords,
    "#60A5FA",
  ),
  [POWER_UP_TYPE.BOMB]: createMeta(
    POWER_UP_TYPE.BOMB,
    POWER_UP_RARITY.RARE,
    Bomb,
    "#60A5FA",
  ),
  [POWER_UP_TYPE.SWAP]: createMeta(
    POWER_UP_TYPE.SWAP,
    POWER_UP_RARITY.RARE,
    RefreshCw,
    "#60A5FA",
  ),
  [POWER_UP_TYPE.SNIPER]: createMeta(
    POWER_UP_TYPE.SNIPER,
    POWER_UP_RARITY.RARE,
    Target,
    "#60A5FA",
  ),
  [POWER_UP_TYPE.MIRROR]: createMeta(
    POWER_UP_TYPE.MIRROR,
    POWER_UP_RARITY.RARE,
    Repeat2,
    "#60A5FA",
  ),
  [POWER_UP_TYPE.POISONED_GIFT]: createMeta(
    POWER_UP_TYPE.POISONED_GIFT,
    POWER_UP_RARITY.RARE,
    Gift,
    "#60A5FA",
  ),

  // ── Légendaire ──────────────────────────────────────────────────────────────
  [POWER_UP_TYPE.TRIPLE_POINTS]: createMeta(
    POWER_UP_TYPE.TRIPLE_POINTS,
    POWER_UP_RARITY.LEGENDARY,
    Star,
    "#FBBF24",
  ),
  [POWER_UP_TYPE.APOCALYPSE]: createMeta(
    POWER_UP_TYPE.APOCALYPSE,
    POWER_UP_RARITY.LEGENDARY,
    Skull,
    "#FBBF24",
  ),
  [POWER_UP_TYPE.MEGA_BOMB]: createMeta(
    POWER_UP_TYPE.MEGA_BOMB,
    POWER_UP_RARITY.LEGENDARY,
    Flame,
    "#FBBF24",
  ),
  [POWER_UP_TYPE.ROYAL_THEFT]: createMeta(
    POWER_UP_TYPE.ROYAL_THEFT,
    POWER_UP_RARITY.LEGENDARY,
    Crown,
    "#FBBF24",
  ),
}

// Fallback pour types non reconnus (anciens icônes Lucide manquants)
const FALLBACK_ICON = ShieldX

export const getPowerUpMeta = (type: PowerUpType): PowerUpMetaUI =>
  POWER_UP_META_UI[type] ?? {
    type,
    rarity: POWER_UP_RARITY.COMMON,
    Icon: FALLBACK_ICON,
    label: type,
    description: "",
    color: "#94A3B8",
  }
