import { EVENTS } from "@rahoot/common/constants"
import type { Answer, Question } from "@rahoot/common/types/game"
import type { Socket } from "@rahoot/common/types/game/socket"
import Game from "@rahoot/socket/services/game"
import Registry from "@rahoot/socket/services/registry"
import { nanoid } from "nanoid"

export const withGame = (
  gameId: string | undefined,
  socket: Socket,
  callback: (_game: Game) => void,
): void => {
  if (!gameId) {
    socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

    return
  }

  const registry = Registry.getInstance()
  const game = registry.getGameById(gameId)

  if (!game) {
    socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

    return
  }

  callback(game)
}

// Variante de withGame réservée aux actions de pilotage (manager principal ou
// télécommande). En plus de vérifier l'existence de la partie, on exige que le
// socket appartienne à la room `manager-${gameId}` — la seule preuve fiable
// qu'il a été authentifié comme manager pour CETTE partie. Sans ce contrôle,
// n'importe quel joueur connaissant le gameId pouvait piloter/fermer la partie.
export const withManagerGame = (
  gameId: string | undefined,
  socket: Socket,
  callback: (_game: Game) => void,
): void => {
  if (!gameId) {
    socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

    return
  }

  if (!socket.rooms.has(`manager-${gameId}`)) {
    socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

    return
  }

  const registry = Registry.getInstance()
  const game = registry.getGameById(gameId)

  if (!game) {
    socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

    return
  }

  callback(game)
}

export const createInviteCode = (length = 6) => {
  let result = ""
  const characters = "0123456789"
  const charactersLength = characters.length

  for (let i = 0; i < length; i += 1) {
    const randomIndex = Math.floor(Math.random() * charactersLength)
    result += characters.charAt(randomIndex)
  }

  return result
}

export const normalizeFilename = (subject: string) => {
  const slug = subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/[^a-z0-9-]/gu, "")
    .slice(0, 10)

  const shortId = nanoid(8)

  return `${slug}-${shortId}`
}

export const timeToPoint = (startTime: number, secondes: number): number => {
  let points = 1000

  const actualTime = Date.now()
  const tempsPasseEnSecondes = (actualTime - startTime) / 1000

  points -= (1000 / secondes) * tempsPasseEnSecondes
  points = Math.max(0, points)

  return points
}

export const checkAnswer = (question: Question, answer: Answer): boolean => {
  switch (question.type) {
    case "mcq":
      return (
        answer.answerId !== undefined &&
        question.solutions.includes(answer.answerId)
      )

    case "true_false":
      return answer.answerId === question.solution

    case "open":
      return (
        answer.textAnswer !== undefined &&
        question.correctAnswers.some(
          (ca) =>
            ca.trim().toLowerCase() === answer.textAnswer!.trim().toLowerCase(),
        )
      )

    case "date":
      return (
        answer.numberAnswer !== undefined &&
        Math.abs(answer.numberAnswer - question.correctYear) <=
          question.tolerance
      )

    case "slider":
      return (
        answer.numberAnswer !== undefined &&
        Math.abs(answer.numberAnswer - question.correctValue) <=
          question.tolerance
      )

    case "puzzle":
      return (
        answer.orderAnswer !== undefined &&
        answer.orderAnswer.length === question.items.length &&
        answer.orderAnswer.every((v, i) => v === i)
      )

    case "drop_pin": {
      if (question.type !== "drop_pin") {
        return false
      }

      if (!answer.textAnswer) {
        return false
      }

      const parts = answer.textAnswer.split(":")

      if (parts.length !== 2) {
        return false
      }

      const px = parseFloat(parts[0])
      const py = parseFloat(parts[1])

      if (isNaN(px) || isNaN(py)) {
        return false
      }

      const correctZones = question.zones.filter((z) => z.isCorrect)

      if (correctZones.length === 0) {
        return true
      }

      const PROXIMITY_THRESHOLD = 20

      return correctZones.some((z) => {
        const distance = Math.sqrt((px - z.x) ** 2 + (py - z.y) ** 2)

        return distance <= PROXIMITY_THRESHOLD
      })
    }

    default:
      return false
  }
}
