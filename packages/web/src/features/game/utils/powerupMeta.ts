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

export interface PowerUpMetaUI {
  type: PowerUpType
  rarity: PowerUpRarity
  Icon: LucideIcon
  label: string
  description: string
  color: string
}

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
    label: "Commun",
  },
  RARE: {
    bg: "bg-blue-900/70",
    border: "border-blue-400/60",
    glow: "shadow-blue-400/40",
    ring: "ring-blue-300/50",
    text: "text-blue-200",
    label: "Rare",
  },
  LEGENDARY: {
    bg: "bg-gradient-to-br from-yellow-700/80 via-amber-600/80 to-yellow-800/80",
    border: "border-yellow-300/80",
    glow: "shadow-yellow-300/60",
    ring: "ring-yellow-200/70",
    text: "text-yellow-100",
    label: "Légendaire",
  },
}

export const POWER_UP_META_UI: Record<PowerUpType, PowerUpMetaUI> = {
  // ── Commun (icônes provisoires Lucide) ──────────────────────────────────────
  [POWER_UP_TYPE.SHIELD]: {
    type: POWER_UP_TYPE.SHIELD,
    rarity: POWER_UP_RARITY.COMMON,
    Icon: Shield,
    label: "Bouclier",
    description: "Bloque la prochaine attaque reçue",
    color: "#94A3B8",
  },
  [POWER_UP_TYPE.FREEZE]: {
    type: POWER_UP_TYPE.FREEZE,
    rarity: POWER_UP_RARITY.COMMON,
    Icon: Snowflake,
    label: "Gel du timer",
    description: "Bloque la saisie des adversaires pendant 3 s",
    color: "#94A3B8",
  },
  [POWER_UP_TYPE.SAFETY_NET]: {
    type: POWER_UP_TYPE.SAFETY_NET,
    rarity: POWER_UP_RARITY.COMMON,
    Icon: LifeBuoy,
    label: "Filet de sécurité",
    description: "+50 pts garantis même si faux",
    color: "#94A3B8",
  },
  [POWER_UP_TYPE.SCRAMBLE]: {
    type: POWER_UP_TYPE.SCRAMBLE,
    rarity: POWER_UP_RARITY.COMMON,
    Icon: Shuffle,
    label: "Embrouille",
    description: "Mélange l'ordre des réponses d'un adversaire",
    color: "#94A3B8",
  },
  [POWER_UP_TYPE.SPARK]: {
    type: POWER_UP_TYPE.SPARK,
    rarity: POWER_UP_RARITY.COMMON,
    Icon: Sparkles,
    label: "Étincelle",
    description: "+25 pts si bonne réponse à la prochaine question",
    color: "#94A3B8",
  },
  [POWER_UP_TYPE.DIESEL]: {
    type: POWER_UP_TYPE.DIESEL,
    rarity: POWER_UP_RARITY.COMMON,
    Icon: Gauge,
    label: "Diesel",
    description: "+500 pts si tu es le dernier à bien répondre",
    color: "#94A3B8",
  },

  // ── Rare ────────────────────────────────────────────────────────────────────
  [POWER_UP_TYPE.DOUBLE_POINTS]: {
    type: POWER_UP_TYPE.DOUBLE_POINTS,
    rarity: POWER_UP_RARITY.RARE,
    Icon: Zap,
    label: "Double Points",
    description: "×2 sur la prochaine question",
    color: "#60A5FA",
  },
  [POWER_UP_TYPE.STEAL_POINTS]: {
    type: POWER_UP_TYPE.STEAL_POINTS,
    rarity: POWER_UP_RARITY.RARE,
    Icon: Swords,
    label: "Vol de Points",
    description: "Vole 200 pts au leader",
    color: "#60A5FA",
  },
  [POWER_UP_TYPE.BOMB]: {
    type: POWER_UP_TYPE.BOMB,
    rarity: POWER_UP_RARITY.RARE,
    Icon: Bomb,
    label: "Bombe",
    description: "−150 pts à un joueur ciblé",
    color: "#60A5FA",
  },
  [POWER_UP_TYPE.SWAP]: {
    type: POWER_UP_TYPE.SWAP,
    rarity: POWER_UP_RARITY.RARE,
    Icon: RefreshCw,
    label: "Téléportation",
    description: "Échange ton score avec un adversaire",
    color: "#60A5FA",
  },
  [POWER_UP_TYPE.SNIPER]: {
    type: POWER_UP_TYPE.SNIPER,
    rarity: POWER_UP_RARITY.RARE,
    Icon: Target,
    label: "Sniper",
    description: "−100 pts précis sur 2 joueurs ciblés",
    color: "#60A5FA",
  },
  [POWER_UP_TYPE.MIRROR]: {
    type: POWER_UP_TYPE.MIRROR,
    rarity: POWER_UP_RARITY.RARE,
    Icon: Repeat2,
    label: "Miroir",
    description: "Renvoie la prochaine attaque à l'envoyeur",
    color: "#60A5FA",
  },
  [POWER_UP_TYPE.POISONED_GIFT]: {
    type: POWER_UP_TYPE.POISONED_GIFT,
    rarity: POWER_UP_RARITY.RARE,
    Icon: Gift,
    label: "Cadeau empoisonné",
    description:
      "Divise par 2 les points d'un adversaire à la prochaine question",
    color: "#60A5FA",
  },

  // ── Légendaire ──────────────────────────────────────────────────────────────
  [POWER_UP_TYPE.TRIPLE_POINTS]: {
    type: POWER_UP_TYPE.TRIPLE_POINTS,
    rarity: POWER_UP_RARITY.LEGENDARY,
    Icon: Star,
    label: "Triple Points",
    description: "×3 sur la prochaine question",
    color: "#FBBF24",
  },
  [POWER_UP_TYPE.APOCALYPSE]: {
    type: POWER_UP_TYPE.APOCALYPSE,
    rarity: POWER_UP_RARITY.LEGENDARY,
    Icon: Skull,
    label: "Apocalypse",
    description: "−300 pts à TOUS les adversaires",
    color: "#FBBF24",
  },
  [POWER_UP_TYPE.MEGA_BOMB]: {
    type: POWER_UP_TYPE.MEGA_BOMB,
    rarity: POWER_UP_RARITY.LEGENDARY,
    Icon: Flame,
    label: "Méga Bombe",
    description: "−500 pts, ignore le Bouclier",
    color: "#FBBF24",
  },
  [POWER_UP_TYPE.ROYAL_THEFT]: {
    type: POWER_UP_TYPE.ROYAL_THEFT,
    rarity: POWER_UP_RARITY.LEGENDARY,
    Icon: Crown,
    label: "Vol Royal",
    description: "Vole 50% des points du leader",
    color: "#FBBF24",
  },
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
