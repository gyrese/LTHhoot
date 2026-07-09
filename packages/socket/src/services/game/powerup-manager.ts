import {
  POWER_UP_TYPE,
  POWER_UPS_BY_RARITY,
  POWER_UP_CATALOG,
  getPowerUpPrice,
  type PowerUp,
  type PowerUpType,
  type PowerUpRarity,
} from "@rahoot/common/types/powerup"
import type { Player } from "@rahoot/common/types/game"
import { nanoid } from "nanoid"

const MAX_POWER_UPS = 3

export interface ActiveEffects {
  // ×2 prochaine question
  doublePoints: Set<string>
  // ×3 prochaine question
  triplePoints: Set<string>
  // Bloque prochaine attaque ciblée (sauf MEGA_BOMB)
  shields: Set<string>
  // +50 pts minimum à la prochaine question
  safetyNets: Set<string>
  // +25 pts si bonne réponse à la prochaine question
  sparks: Set<string>
  // Réponses mélangées (affichage joueur)
  scrambled: Set<string>
  // Renvoie la prochaine attaque à l'envoyeur
  mirrors: Set<string>
  // Timer +3s à la prochaine question
  frozen: Set<string>
  // Points divisés par 2 à la prochaine question (cadeau empoisonné)
  poisoned: Set<string>
}

export interface EarnedPowerUp {
  playerId: string
  powerUp: PowerUp
}

export interface PowerUpUseResult {
  success: boolean
  type?: PowerUpType
  affectedPlayers?: { id: string; username: string; pointsDelta: number }[]
  blockedBy?: string
  mirroredTo?: string
}

const pick = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

const randomFromRarity = (rarity: PowerUpRarity): PowerUpType =>
  pick(POWER_UPS_BY_RARITY[rarity])

const consumeFromSet = (set: Set<string>, playerId: string): boolean => {
  if (!set.has(playerId)) {
    return false
  }

  set.delete(playerId)

  return true
}

const emptyEffects = (): ActiveEffects => ({
  doublePoints: new Set(),
  triplePoints: new Set(),
  shields: new Set(),
  safetyNets: new Set(),
  sparks: new Set(),
  scrambled: new Set(),
  mirrors: new Set(),
  frozen: new Set(),
  poisoned: new Set(),
})

export class PowerUpManager {
  private playerPowerUps = new Map<string, PowerUp[]>()
  private activeEffects: ActiveEffects = emptyEffects()
  private consecutiveWinsByPlayer = new Map<string, number>()

  // ── Inventaire ────────────────────────────────────────────────────────────

  getPlayerPowerUps(playerId: string): PowerUp[] {
    return this.playerPowerUps.get(playerId) ?? []
  }

  private addPowerUp(playerId: string, type: PowerUpType): PowerUp | null {
    const current = this.playerPowerUps.get(playerId) ?? []
    const next = [...current]

    if (next.length >= MAX_POWER_UPS) {
      next.shift()
    }

    const powerUp: PowerUp = { id: nanoid(8), type, earnedAt: Date.now() }
    next.push(powerUp)
    this.playerPowerUps.set(playerId, next)

    return powerUp
  }

  private removePowerUp(playerId: string, powerUpId: string): boolean {
    const current = this.playerPowerUps.get(playerId) ?? []
    const filtered = current.filter((p) => p.id !== powerUpId)

    if (filtered.length === current.length) {
      return false
    }

    this.playerPowerUps.set(playerId, filtered)

    return true
  }

  // ── Attribution ───────────────────────────────────────────────────────────

  /** Cadeau aléatoire commun à l'arrivée d'un joueur. */
  grantStartGift(playerId: string): EarnedPowerUp | null {
    const type = randomFromRarity("COMMON")
    const powerUp = this.addPowerUp(playerId, type)

    return powerUp ? { playerId, powerUp } : null
  }

  /** Évaluation post-question : combos ×3 (commun) et ×6 (rare). */
  evaluateRoundEarnings(streaks: Map<string, number>): EarnedPowerUp[] {
    const earned: EarnedPowerUp[] = []

    for (const [playerId, streak] of streaks) {
      if (streak === 3) {
        const powerUp = this.addPowerUp(playerId, randomFromRarity("COMMON"))

        if (powerUp) {
          earned.push({ playerId, powerUp })
        }
      }

      if (streak === 6) {
        const powerUp = this.addPowerUp(playerId, randomFromRarity("RARE"))

        if (powerUp) {
          earned.push({ playerId, powerUp })
        }
      }
    }

    return earned
  }

  /**
   * Évaluation fin de quiz :
   * - Victoire de quiz → rare
   * - Quiz sans faute (toutes bonnes) → légendaire
   * - 2 victoires d'affilée → légendaire
   */
  evaluateQuizEndEarnings(
    winnerId: string | null,
    perfectPlayerIds: string[],
    allPlayerIds: string[],
  ): EarnedPowerUp[] {
    const earned: EarnedPowerUp[] = []

    if (winnerId) {
      const powerUp = this.addPowerUp(winnerId, randomFromRarity("RARE"))

      if (powerUp) {
        earned.push({ playerId: winnerId, powerUp })
      }

      const prevWins = this.consecutiveWinsByPlayer.get(winnerId) ?? 0
      const newWins = prevWins + 1
      this.consecutiveWinsByPlayer.set(winnerId, newWins)

      if (newWins >= 2) {
        const legendary = this.addPowerUp(
          winnerId,
          randomFromRarity("LEGENDARY"),
        )

        if (legendary) {
          earned.push({ playerId: winnerId, powerUp: legendary })
        }
      }

      // Reset des autres joueurs (ils n'ont pas gagné ce quiz)
      for (const id of allPlayerIds) {
        if (id !== winnerId) {
          this.consecutiveWinsByPlayer.set(id, 0)
        }
      }
    }

    for (const playerId of perfectPlayerIds) {
      const powerUp = this.addPowerUp(playerId, randomFromRarity("LEGENDARY"))

      if (powerUp) {
        earned.push({ playerId, powerUp })
      }
    }

    return earned
  }

  // ── Boutique ──────────────────────────────────────────────────────────────

  /**
   * Achat d'un power-up contre des pièces d'or. Le solde vit sur `player.goldCoins`
   * (persiste à la reconnexion via l'objet Player). Refuse si inventaire plein
   * ou solde insuffisant.
   */
  buyPowerUp(
    player: Player,
    type: PowerUpType,
  ): { success: boolean; error?: string; powerUp?: PowerUp } {
    const current = this.playerPowerUps.get(player.id) ?? []

    if (current.length >= MAX_POWER_UPS) {
      return { success: false, error: "errors:shop.inventoryFull" }
    }

    const price = getPowerUpPrice(type)
    const balance = player.goldCoins ?? 0

    if (balance < price) {
      return { success: false, error: "errors:shop.notEnoughCoins" }
    }

    player.goldCoins = balance - price
    const powerUp = this.addPowerUp(player.id, type)

    if (!powerUp) {
      // Ne devrait pas arriver (capacité déjà vérifiée) — on rembourse par sûreté.
      player.goldCoins = balance

      return { success: false, error: "errors:shop.inventoryFull" }
    }

    return { success: true, powerUp }
  }

  // ── Activation d'un power-up ──────────────────────────────────────────────

  usePowerUp(
    players: Player[],
    activatorId: string,
    powerUpId: string,
    targetIds?: string[],
  ): PowerUpUseResult {
    const inventory = this.playerPowerUps.get(activatorId) ?? []
    const powerUp = inventory.find((p) => p.id === powerUpId)

    if (!powerUp) {
      return { success: false }
    }

    const activator = players.find((p) => p.id === activatorId)

    if (!activator) {
      return { success: false }
    }

    const meta = POWER_UP_CATALOG[powerUp.type]
    const targets = (targetIds ?? [])
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is Player => Boolean(p))

    // Vérification ciblage
    if (meta.target === "ONE_OPPONENT" && targets.length !== 1) {
      return { success: false }
    }

    if (meta.target === "TWO_OPPONENTS" && targets.length !== 2) {
      return { success: false }
    }

    this.removePowerUp(activatorId, powerUpId)

    switch (powerUp.type) {
      // ── Self (effets différés / actifs) ─────────────────────────────────────
      case POWER_UP_TYPE.SHIELD: {
        this.activeEffects.shields.add(activatorId)

        return { success: true, type: powerUp.type, affectedPlayers: [] }
      }

      case POWER_UP_TYPE.SAFETY_NET: {
        this.activeEffects.safetyNets.add(activatorId)

        return { success: true, type: powerUp.type, affectedPlayers: [] }
      }

      case POWER_UP_TYPE.SPARK: {
        this.activeEffects.sparks.add(activatorId)

        return { success: true, type: powerUp.type, affectedPlayers: [] }
      }

      case POWER_UP_TYPE.MIRROR: {
        this.activeEffects.mirrors.add(activatorId)

        return { success: true, type: powerUp.type, affectedPlayers: [] }
      }

      case POWER_UP_TYPE.DOUBLE_POINTS: {
        this.activeEffects.doublePoints.add(activatorId)

        return { success: true, type: powerUp.type, affectedPlayers: [] }
      }

      case POWER_UP_TYPE.TRIPLE_POINTS: {
        this.activeEffects.triplePoints.add(activatorId)

        return { success: true, type: powerUp.type, affectedPlayers: [] }
      }

      // ── All opponents ────────────────────────────────────────────────────────
      case POWER_UP_TYPE.FREEZE: {
        const others = players.filter((p) => p.id !== activatorId)

        for (const p of others) {
          this.activeEffects.frozen.add(p.id)
        }

        return {
          success: true,
          type: powerUp.type,
          affectedPlayers: others.map((p) => ({
            id: p.id,
            username: p.username,
            pointsDelta: 0,
          })),
        }
      }

      case POWER_UP_TYPE.APOCALYPSE: {
        const others = players.filter((p) => p.id !== activatorId)
        const affected: {
          id: string
          username: string
          pointsDelta: number
        }[] = []

        for (const target of others) {
          if (this.activeEffects.shields.has(target.id)) {
            this.activeEffects.shields.delete(target.id)

            continue
          }

          const amount = Math.min(300, target.points)
          target.points -= amount
          affected.push({
            id: target.id,
            username: target.username,
            pointsDelta: -amount,
          })
        }

        return { success: true, type: powerUp.type, affectedPlayers: affected }
      }

      // ── Leader auto ──────────────────────────────────────────────────────────
      case POWER_UP_TYPE.STEAL_POINTS: {
        const [leader] = [...players]
          .filter((p) => p.id !== activatorId)
          .sort((a, b) => b.points - a.points)

        if (!leader) {
          return { success: false }
        }

        if (this.activeEffects.shields.has(leader.id)) {
          this.activeEffects.shields.delete(leader.id)

          return { success: true, type: powerUp.type, blockedBy: leader.id }
        }

        const amount = Math.min(200, leader.points)
        leader.points -= amount
        activator.points += amount

        return {
          success: true,
          type: powerUp.type,
          affectedPlayers: [
            { id: leader.id, username: leader.username, pointsDelta: -amount },
            {
              id: activator.id,
              username: activator.username,
              pointsDelta: amount,
            },
          ],
        }
      }

      case POWER_UP_TYPE.ROYAL_THEFT: {
        const [leader] = [...players]
          .filter((p) => p.id !== activatorId)
          .sort((a, b) => b.points - a.points)

        if (!leader) {
          return { success: false }
        }

        if (this.activeEffects.shields.has(leader.id)) {
          this.activeEffects.shields.delete(leader.id)

          return { success: true, type: powerUp.type, blockedBy: leader.id }
        }

        const amount = Math.floor(leader.points * 0.5)
        leader.points -= amount
        activator.points += amount

        return {
          success: true,
          type: powerUp.type,
          affectedPlayers: [
            { id: leader.id, username: leader.username, pointsDelta: -amount },
            {
              id: activator.id,
              username: activator.username,
              pointsDelta: amount,
            },
          ],
        }
      }

      // ── One opponent ─────────────────────────────────────────────────────────
      case POWER_UP_TYPE.BOMB: {
        const [target] = targets

        if (this.activeEffects.mirrors.has(target.id)) {
          this.activeEffects.mirrors.delete(target.id)
          const amount = Math.min(150, activator.points)
          activator.points -= amount

          return {
            success: true,
            type: powerUp.type,
            mirroredTo: activator.id,
            affectedPlayers: [
              {
                id: activator.id,
                username: activator.username,
                pointsDelta: -amount,
              },
            ],
          }
        }

        if (this.activeEffects.shields.has(target.id)) {
          this.activeEffects.shields.delete(target.id)

          return { success: true, type: powerUp.type, blockedBy: target.id }
        }

        const amount = Math.min(150, target.points)
        target.points -= amount

        return {
          success: true,
          type: powerUp.type,
          affectedPlayers: [
            { id: target.id, username: target.username, pointsDelta: -amount },
          ],
        }
      }

      case POWER_UP_TYPE.MEGA_BOMB: {
        const [target] = targets

        // MEGA_BOMB ignore Bouclier mais pas Miroir
        if (this.activeEffects.mirrors.has(target.id)) {
          this.activeEffects.mirrors.delete(target.id)
          const amount = Math.min(500, activator.points)
          activator.points -= amount

          return {
            success: true,
            type: powerUp.type,
            mirroredTo: activator.id,
            affectedPlayers: [
              {
                id: activator.id,
                username: activator.username,
                pointsDelta: -amount,
              },
            ],
          }
        }

        const amount = Math.min(500, target.points)
        target.points -= amount

        return {
          success: true,
          type: powerUp.type,
          affectedPlayers: [
            { id: target.id, username: target.username, pointsDelta: -amount },
          ],
        }
      }

      case POWER_UP_TYPE.SWAP: {
        const [target] = targets

        if (this.activeEffects.shields.has(target.id)) {
          this.activeEffects.shields.delete(target.id)

          return { success: true, type: powerUp.type, blockedBy: target.id }
        }

        const activatorPoints = activator.points
        const targetPoints = target.points
        const deltaForActivator = targetPoints - activatorPoints
        const deltaForTarget = activatorPoints - targetPoints
        activator.points = targetPoints
        target.points = activatorPoints

        return {
          success: true,
          type: powerUp.type,
          affectedPlayers: [
            {
              id: activator.id,
              username: activator.username,
              pointsDelta: deltaForActivator,
            },
            {
              id: target.id,
              username: target.username,
              pointsDelta: deltaForTarget,
            },
          ],
        }
      }

      case POWER_UP_TYPE.SCRAMBLE: {
        const [target] = targets
        this.activeEffects.scrambled.add(target.id)

        return {
          success: true,
          type: powerUp.type,
          affectedPlayers: [
            { id: target.id, username: target.username, pointsDelta: 0 },
          ],
        }
      }

      case POWER_UP_TYPE.POISONED_GIFT: {
        const [target] = targets

        // Le bouclier protège de l'empoisonnement.
        if (this.activeEffects.shields.has(target.id)) {
          this.activeEffects.shields.delete(target.id)

          return { success: true, type: powerUp.type, blockedBy: target.id }
        }

        // Empoisonne la cible : ses points seront divisés par 2 à la prochaine
        // question (consommé au scoring dans applyPointModifiers).
        this.activeEffects.poisoned.add(target.id)

        return {
          success: true,
          type: powerUp.type,
          affectedPlayers: [
            { id: target.id, username: target.username, pointsDelta: 0 },
          ],
        }
      }

      // ── Two opponents ────────────────────────────────────────────────────────
      case POWER_UP_TYPE.SNIPER: {
        const affected: {
          id: string
          username: string
          pointsDelta: number
        }[] = []

        for (const target of targets) {
          if (this.activeEffects.shields.has(target.id)) {
            this.activeEffects.shields.delete(target.id)

            continue
          }

          const amount = Math.min(100, target.points)
          target.points -= amount
          affected.push({
            id: target.id,
            username: target.username,
            pointsDelta: -amount,
          })
        }

        return { success: true, type: powerUp.type, affectedPlayers: affected }
      }

      default:
        return { success: false }
    }
  }

  // ── Consommation des effets actifs (à appeler depuis RoundManager) ────────

  /** Applique tous les modificateurs de points actifs pour ce joueur. */
  applyPointModifiers(
    playerId: string,
    basePoints: number,
    isCorrect: boolean,
  ): number {
    let points = basePoints

    if (
      isCorrect &&
      consumeFromSet(this.activeEffects.triplePoints, playerId)
    ) {
      points *= 3
    } else if (
      isCorrect &&
      consumeFromSet(this.activeEffects.doublePoints, playerId)
    ) {
      points *= 2
    }

    if (isCorrect && consumeFromSet(this.activeEffects.sparks, playerId)) {
      points += 25
    }

    if (consumeFromSet(this.activeEffects.safetyNets, playerId)) {
      if (!isCorrect) {
        points = Math.max(points, 50)
      }
    }

    // Cadeau empoisonné : points de la manche divisés par 2.
    if (consumeFromSet(this.activeEffects.poisoned, playerId)) {
      points = Math.floor(points / 2)
    }

    return points
  }

  hasScrambled(playerId: string): boolean {
    return this.activeEffects.scrambled.has(playerId)
  }

  hasFrozen(playerId: string): boolean {
    return this.activeEffects.frozen.has(playerId)
  }

  consumeScrambled(playerId: string): boolean {
    return consumeFromSet(this.activeEffects.scrambled, playerId)
  }

  consumeFrozen(playerId: string): boolean {
    return consumeFromSet(this.activeEffects.frozen, playerId)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private effectSets(): Set<string>[] {
    return [
      this.activeEffects.doublePoints,
      this.activeEffects.triplePoints,
      this.activeEffects.shields,
      this.activeEffects.safetyNets,
      this.activeEffects.sparks,
      this.activeEffects.scrambled,
      this.activeEffects.mirrors,
      this.activeEffects.frozen,
      this.activeEffects.poisoned,
    ]
  }

  /**
   * Remappe l'inventaire et les effets actifs d'un joueur vers son nouveau socket
   * id à la reconnexion. Sans ce remap, un joueur qui achète des power-ups puis
   * subit un blip réseau les perdait (tout est indexé par socket id, or `player.id`
   * change à la reconnexion). Les pièces, elles, vivent sur l'objet Player et
   * survivent déjà.
   */
  remap(oldId: string, newId: string) {
    if (oldId === newId) {
      return
    }

    const inventory = this.playerPowerUps.get(oldId)

    if (inventory) {
      this.playerPowerUps.delete(oldId)
      this.playerPowerUps.set(newId, inventory)
    }

    const wins = this.consecutiveWinsByPlayer.get(oldId)

    if (wins !== undefined) {
      this.consecutiveWinsByPlayer.delete(oldId)
      this.consecutiveWinsByPlayer.set(newId, wins)
    }

    for (const set of this.effectSets()) {
      if (set.has(oldId)) {
        set.delete(oldId)
        set.add(newId)
      }
    }
  }

  removePlayer(playerId: string) {
    this.playerPowerUps.delete(playerId)

    for (const set of this.effectSets()) {
      set.delete(playerId)
    }

    this.consecutiveWinsByPlayer.delete(playerId)
  }

  /** Reset entre quiz d'une soirée (inventaire et effets, mais conserve les wins). */
  resetBetweenQuizzes() {
    this.playerPowerUps.clear()
    this.activeEffects = emptyEffects()
  }

  /** Reset complet (nouvelle partie). */
  reset() {
    this.playerPowerUps.clear()
    this.activeEffects = emptyEffects()
    this.consecutiveWinsByPlayer.clear()
  }
}
