export const POWER_UP_TYPE = {
  // ── Commun ──────────────────────────────────────────────────────────────
  SHIELD: "SHIELD",
  FREEZE: "FREEZE",
  SAFETY_NET: "SAFETY_NET",
  SCRAMBLE: "SCRAMBLE",
  SPARK: "SPARK",

  // ── Rare ────────────────────────────────────────────────────────────────
  DOUBLE_POINTS: "DOUBLE_POINTS",
  STEAL_POINTS: "STEAL_POINTS",
  BOMB: "BOMB",
  SWAP: "SWAP",
  SNIPER: "SNIPER",
  MIRROR: "MIRROR",
  POISONED_GIFT: "POISONED_GIFT",

  // ── Légendaire ──────────────────────────────────────────────────────────
  TRIPLE_POINTS: "TRIPLE_POINTS",
  APOCALYPSE: "APOCALYPSE",
  MEGA_BOMB: "MEGA_BOMB",
  ROYAL_THEFT: "ROYAL_THEFT",
} as const

export type PowerUpType = (typeof POWER_UP_TYPE)[keyof typeof POWER_UP_TYPE]

export const POWER_UP_RARITY = {
  COMMON: "COMMON",
  RARE: "RARE",
  LEGENDARY: "LEGENDARY",
} as const

export type PowerUpRarity =
  (typeof POWER_UP_RARITY)[keyof typeof POWER_UP_RARITY]

export const POWER_UP_TARGET = {
  SELF: "SELF",
  ONE_OPPONENT: "ONE_OPPONENT",
  TWO_OPPONENTS: "TWO_OPPONENTS",
  ALL_OPPONENTS: "ALL_OPPONENTS",
  LEADER_AUTO: "LEADER_AUTO",
} as const

export type PowerUpTarget =
  (typeof POWER_UP_TARGET)[keyof typeof POWER_UP_TARGET]

export interface PowerUpMeta {
  type: PowerUpType
  rarity: PowerUpRarity
  target: PowerUpTarget
}

export const POWER_UP_CATALOG: Record<PowerUpType, PowerUpMeta> = {
  // Commun
  SHIELD: { type: "SHIELD", rarity: "COMMON", target: "SELF" },
  FREEZE: { type: "FREEZE", rarity: "COMMON", target: "ALL_OPPONENTS" },
  SAFETY_NET: { type: "SAFETY_NET", rarity: "COMMON", target: "SELF" },
  SCRAMBLE: { type: "SCRAMBLE", rarity: "COMMON", target: "ONE_OPPONENT" },
  SPARK: { type: "SPARK", rarity: "COMMON", target: "SELF" },

  // Rare
  DOUBLE_POINTS: { type: "DOUBLE_POINTS", rarity: "RARE", target: "SELF" },
  STEAL_POINTS: { type: "STEAL_POINTS", rarity: "RARE", target: "LEADER_AUTO" },
  BOMB: { type: "BOMB", rarity: "RARE", target: "ONE_OPPONENT" },
  SWAP: { type: "SWAP", rarity: "RARE", target: "ONE_OPPONENT" },
  SNIPER: { type: "SNIPER", rarity: "RARE", target: "TWO_OPPONENTS" },
  MIRROR: { type: "MIRROR", rarity: "RARE", target: "SELF" },
  POISONED_GIFT: {
    type: "POISONED_GIFT",
    rarity: "RARE",
    target: "ONE_OPPONENT",
  },

  // Légendaire
  TRIPLE_POINTS: { type: "TRIPLE_POINTS", rarity: "LEGENDARY", target: "SELF" },
  APOCALYPSE: {
    type: "APOCALYPSE",
    rarity: "LEGENDARY",
    target: "ALL_OPPONENTS",
  },
  MEGA_BOMB: { type: "MEGA_BOMB", rarity: "LEGENDARY", target: "ONE_OPPONENT" },
  ROYAL_THEFT: {
    type: "ROYAL_THEFT",
    rarity: "LEGENDARY",
    target: "LEADER_AUTO",
  },
}

export const POWER_UPS_BY_RARITY: Record<PowerUpRarity, PowerUpType[]> = {
  COMMON: Object.values(POWER_UP_CATALOG)
    .filter((m) => m.rarity === "COMMON")
    .map((m) => m.type),
  RARE: Object.values(POWER_UP_CATALOG)
    .filter((m) => m.rarity === "RARE")
    .map((m) => m.type),
  LEGENDARY: Object.values(POWER_UP_CATALOG)
    .filter((m) => m.rarity === "LEGENDARY")
    .map((m) => m.type),
}

export interface PowerUp {
  id: string
  type: PowerUpType
  earnedAt: number
}

// ─── Boutique (pièces d'or) ──────────────────────────────────────────────────
// La boutique REMPLACE le gain aléatoire de power-ups : on gagne des pièces aux
// bonnes réponses et on achète ses power-ups. Active uniquement quand les
// power-ups sont activés pour la partie.
export const SHOP = {
  // Solde de départ à l'arrivée d'un joueur
  STARTING_COINS: 200,
  // Pièces gagnées par bonne réponse (montant fixe, indépendant de la vitesse)
  COINS_PER_CORRECT: 50,
  // Bonus toutes les STREAK_LENGTH bonnes réponses d'affilée
  STREAK_LENGTH: 5,
  STREAK_BONUS: 200,
  // Bonus de fin de quiz (mode soirée)
  QUIZ_WIN_BONUS: 500,
  PERFECT_BONUS: 1000,
  // Prix d'achat par rareté
  PRICE_BY_RARITY: {
    COMMON: 150,
    RARE: 400,
    LEGENDARY: 800,
  } as Record<PowerUpRarity, number>,
} as const

export const getPowerUpPrice = (type: PowerUpType): number =>
  SHOP.PRICE_BY_RARITY[POWER_UP_CATALOG[type].rarity]

export interface PowerUpEffect {
  type: PowerUpType
  activatedBy: string
  activatedByUsername?: string
  affectedPlayers: { id: string; username: string; pointsDelta: number }[]
  blockedBy?: string
  blockedByUsername?: string
  mirrored?: boolean
}
