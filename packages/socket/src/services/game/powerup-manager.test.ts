import type { Player } from "@rahoot/common/types/game"
import { POWER_UP_TYPE } from "@rahoot/common/types/powerup"
import { PowerUpManager } from "@rahoot/socket/services/game/powerup-manager"
import { beforeEach, describe, expect, it } from "vitest"

const buildPlayer = (overrides: Partial<Player>): Player => ({
  id: "p",
  clientId: "p",
  connected: true,
  username: "P",
  points: 0,
  streak: 0,
  goldCoins: 10000,
  ...overrides,
})

// Achète un power-up et renvoie son id (échoue le test si l'achat rate).
const buy = (
  mgr: PowerUpManager,
  player: Player,
  type: (typeof POWER_UP_TYPE)[keyof typeof POWER_UP_TYPE],
): string => {
  const res = mgr.buyPowerUp(player, type)

  expect(res.success).toBe(true)

  return res.powerUp!.id
}

describe("PowerUpManager", () => {
  let mgr = new PowerUpManager()

  beforeEach(() => {
    mgr = new PowerUpManager()
  })

  describe("buyPowerUp", () => {
    it("débite le prix (RARE = 400) et ajoute le power-up à l'inventaire", () => {
      const player = buildPlayer({ id: "a", goldCoins: 500 })

      const res = mgr.buyPowerUp(player, POWER_UP_TYPE.DOUBLE_POINTS)

      expect(res.success).toBe(true)
      expect(player.goldCoins).toBe(100)
      expect(mgr.getPlayerPowerUps("a")).toHaveLength(1)
    })

    it("refuse et ne débite rien si le solde est insuffisant", () => {
      const player = buildPlayer({ id: "a", goldCoins: 100 })

      const res = mgr.buyPowerUp(player, POWER_UP_TYPE.DOUBLE_POINTS)

      expect(res).toEqual({
        success: false,
        error: "errors:shop.notEnoughCoins",
      })
      expect(player.goldCoins).toBe(100)
      expect(mgr.getPlayerPowerUps("a")).toHaveLength(0)
    })

    it("refuse quand l'inventaire est plein (max 3)", () => {
      const player = buildPlayer({ id: "a", goldCoins: 10000 })

      buy(mgr, player, POWER_UP_TYPE.SHIELD)
      buy(mgr, player, POWER_UP_TYPE.SAFETY_NET)
      buy(mgr, player, POWER_UP_TYPE.SPARK)

      const res = mgr.buyPowerUp(player, POWER_UP_TYPE.SHIELD)

      expect(res).toEqual({
        success: false,
        error: "errors:shop.inventoryFull",
      })
      expect(mgr.getPlayerPowerUps("a")).toHaveLength(3)
    })
  })

  describe("applyPointModifiers", () => {
    it("DOUBLE_POINTS ×2 sur bonne réponse, consommé une seule fois", () => {
      const player = buildPlayer({ id: "a" })
      const id = buy(mgr, player, POWER_UP_TYPE.DOUBLE_POINTS)

      mgr.usePowerUp([player], "a", id)

      expect(mgr.applyPointModifiers("a", 100, true)).toBe(200)
      // Consommé : le bonus ne s'applique plus.
      expect(mgr.applyPointModifiers("a", 100, true)).toBe(100)
    })

    it("TRIPLE_POINTS ×3 l'emporte sur DOUBLE_POINTS", () => {
      const player = buildPlayer({ id: "a" })
      const idTriple = buy(mgr, player, POWER_UP_TYPE.TRIPLE_POINTS)
      const idDouble = buy(mgr, player, POWER_UP_TYPE.DOUBLE_POINTS)

      mgr.usePowerUp([player], "a", idTriple)
      mgr.usePowerUp([player], "a", idDouble)

      expect(mgr.applyPointModifiers("a", 100, true)).toBe(300)
    })

    it("SPARK ajoute +25 sur bonne réponse uniquement", () => {
      const player = buildPlayer({ id: "a" })
      const id = buy(mgr, player, POWER_UP_TYPE.SPARK)

      mgr.usePowerUp([player], "a", id)

      expect(mgr.applyPointModifiers("a", 100, false)).toBe(100)
    })

    it("SAFETY_NET garantit un plancher de 50 pts sur mauvaise réponse", () => {
      const player = buildPlayer({ id: "a" })
      const id = buy(mgr, player, POWER_UP_TYPE.SAFETY_NET)

      mgr.usePowerUp([player], "a", id)

      expect(mgr.applyPointModifiers("a", 0, false)).toBe(50)
    })

    it("aucun modificateur actif : les points de base sont inchangés", () => {
      expect(mgr.applyPointModifiers("inconnu", 123, true)).toBe(123)
    })
  })

  describe("usePowerUp — vol et défense", () => {
    it("STEAL_POINTS retire 200 pts au leader et les donne à l'activateur", () => {
      const a = buildPlayer({ id: "a", username: "A", points: 100 })
      const leader = buildPlayer({ id: "b", username: "B", points: 500 })
      const id = buy(mgr, a, POWER_UP_TYPE.STEAL_POINTS)

      const res = mgr.usePowerUp([a, leader], "a", id)

      expect(res.success).toBe(true)
      expect(leader.points).toBe(300)
      expect(a.points).toBe(300)
    })

    it("SHIELD bloque STEAL_POINTS et se consomme", () => {
      const a = buildPlayer({ id: "a", points: 100 })
      const leader = buildPlayer({ id: "b", points: 500 })
      const shieldId = buy(mgr, leader, POWER_UP_TYPE.SHIELD)
      const stealId = buy(mgr, a, POWER_UP_TYPE.STEAL_POINTS)

      mgr.usePowerUp([a, leader], "b", shieldId)
      const res = mgr.usePowerUp([a, leader], "a", stealId)

      expect(res).toMatchObject({ success: true, blockedBy: "b" })
      expect(leader.points).toBe(500)
      expect(a.points).toBe(100)
    })

    it("BOMB renvoyée à l'attaquant par un MIRROR de la cible", () => {
      const a = buildPlayer({ id: "a", points: 400 })
      const target = buildPlayer({ id: "b", points: 500 })
      const mirrorId = buy(mgr, target, POWER_UP_TYPE.MIRROR)
      const bombId = buy(mgr, a, POWER_UP_TYPE.BOMB)

      mgr.usePowerUp([a, target], "b", mirrorId)
      const res = mgr.usePowerUp([a, target], "a", bombId, ["b"])

      expect(res).toMatchObject({ success: true, mirroredTo: "a" })
      expect(a.points).toBe(250)
      expect(target.points).toBe(500)
    })

    it("POISONED_GIFT est bloqué par le bouclier de la cible", () => {
      const a = buildPlayer({ id: "a" })
      const target = buildPlayer({ id: "b", points: 300 })
      const shieldId = buy(mgr, target, POWER_UP_TYPE.SHIELD)
      const poisonId = buy(mgr, a, POWER_UP_TYPE.POISONED_GIFT)

      mgr.usePowerUp([a, target], "b", shieldId)
      const res = mgr.usePowerUp([a, target], "a", poisonId, ["b"])

      expect(res).toMatchObject({ success: true, blockedBy: "b" })
      // Non empoisonné : le scoring de la manche suivante reste entier.
      expect(mgr.applyPointModifiers("b", 100, true)).toBe(100)
    })

    it("SWAP échange les scores des deux joueurs", () => {
      const a = buildPlayer({ id: "a", points: 100 })
      const target = buildPlayer({ id: "b", points: 900 })
      const id = buy(mgr, a, POWER_UP_TYPE.SWAP)

      mgr.usePowerUp([a, target], "a", id, ["b"])

      expect(a.points).toBe(900)
      expect(target.points).toBe(100)
    })

    it("refuse un power-up à cible unique sans cible fournie", () => {
      const a = buildPlayer({ id: "a" })
      const target = buildPlayer({ id: "b", points: 300 })
      const id = buy(mgr, a, POWER_UP_TYPE.BOMB)

      const res = mgr.usePowerUp([a, target], "a", id)

      expect(res.success).toBe(false)
      // La cible ne perd rien.
      expect(target.points).toBe(300)
    })
  })

  describe("remap (survie à la reconnexion)", () => {
    it("déplace l'inventaire et les effets actifs de l'ancien vers le nouveau id", () => {
      const player = buildPlayer({ id: "old", goldCoins: 10000 })
      const doubleId = buy(mgr, player, POWER_UP_TYPE.DOUBLE_POINTS)

      buy(mgr, player, POWER_UP_TYPE.SHIELD)
      // Active DOUBLE_POINTS (passe de l'inventaire aux effets), SHIELD reste stocké.
      mgr.usePowerUp([player], "old", doubleId)

      mgr.remap("old", "new")

      expect(mgr.getPlayerPowerUps("old")).toHaveLength(0)
      expect(mgr.getPlayerPowerUps("new")).toHaveLength(1)
      // L'effet DOUBLE_POINTS suit vers le nouvel id.
      expect(mgr.applyPointModifiers("new", 100, true)).toBe(200)
      expect(mgr.applyPointModifiers("old", 100, true)).toBe(100)
    })
  })
})
