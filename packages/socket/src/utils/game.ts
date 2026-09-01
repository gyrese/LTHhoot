import {
  EVENTS,
  PODIUM_THEME_NEUTRAL,
  PODIUM_THEMES,
} from "@rahoot/common/constants"
import type {
  Answer,
  Award,
  GameResult,
  Player,
  PodiumThemeId,
  PodiumThemeSetting,
  Question,
} from "@rahoot/common/types/game"
import type { Socket } from "@rahoot/common/types/game/socket"
import { isPointInZone } from "@rahoot/common/utils/drop-pin"
import { isSameAnswer } from "@rahoot/common/utils/normalize-answer"
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

// Barème d'une bonne réponse : valeur pleine (réponse instantanée) qui décroît
// linéairement jusqu'à 0 à l'expiration du temps imparti. C'est aussi la valeur
// fixe attribuée en mode sans rapidité.
export const MAX_ANSWER_POINTS = 1000

export const timeToPoint = (startTime: number, secondes: number): number => {
  let points = MAX_ANSWER_POINTS

  const actualTime = Date.now()
  const tempsPasseEnSecondes = (actualTime - startTime) / 1000

  points -= (MAX_ANSWER_POINTS / secondes) * tempsPasseEnSecondes
  points = Math.max(0, points)

  return points
}

// Points attribués à une réponse selon le mode de la partie. En mode sans
// rapidité, toute bonne réponse vaut le barème plein : les égalités qui en
// découlent sont tranchées par la mort subite en fin de partie.
export const answerPoints = (
  startTime: number,
  secondes: number,
  noSpeedMode: boolean,
): number =>
  noSpeedMode ? MAX_ANSWER_POINTS : timeToPoint(startTime, secondes)

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
        question.correctAnswers.some((ca) =>
          isSameAnswer(ca, answer.textAnswer!),
        )
      )

    case "image_sequence":
      return (
        answer.textAnswer !== undefined &&
        question.correctAnswers.some((ca) =>
          isSameAnswer(ca, answer.textAnswer!),
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

    // Grille : `answerId` est l'index de la case tapée. Plusieurs cases peuvent
    // être justes — une seule suffit.
    case "grid":
      return (
        answer.answerId !== undefined &&
        question.correctIndexes.includes(answer.answerId)
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

      // La forme dessinée dans l'éditeur EST la zone qui compte les points
      // (rectangle, ellipse ou tracé libre). Les zones héritées, sans forme,
      // gardent leur rayon de tolérance.
      return correctZones.some((z) => isPointInZone(z, px, py))
    }

    default:
      return false
  }
}

// Détecte une égalité de points qui affecte le PODIUM du classement final
// (déjà trié décroissant) : premier groupe d'ex-æquo dont la tête est dans le
// top 3, membres au-delà du rang 3 inclus (une égalité 3e/4e dispute la place
// sur le podium). Retourne les clientIds (stables, contrairement aux ids
// socket) des joueurs ex-æquo, ou `null` si le podium n'est pas contesté.
export const detectTopTie = (leaderboard: Player[]): string[] | null => {
  const podiumSize = Math.min(3, leaderboard.length)

  for (let start = 0; start < podiumSize; ) {
    const { points } = leaderboard[start]!
    let end = start + 1

    while (end < leaderboard.length && leaderboard[end]!.points === points) {
      end += 1
    }

    if (end - start >= 2) {
      return leaderboard.slice(start, end).map((p) => p.clientId)
    }

    start = end
  }

  return null
}

// Résout le thème visuel du podium, UNE fois côté serveur pour que hôte et
// joueurs voient le même : thème précis si réglé, tirage au sort parmi les
// univers si "random", sinon (absent ou valeur retirée du catalogue) le
// défaut "neutre" — podium sobre sur l'image de couverture du quiz.
export const resolvePodiumTheme = (
  setting?: PodiumThemeSetting,
): PodiumThemeId => {
  if (setting === "random") {
    return PODIUM_THEMES[Math.floor(Math.random() * PODIUM_THEMES.length)]!
  }

  if (setting && (PODIUM_THEMES as readonly string[]).includes(setting)) {
    return setting as PodiumThemeId
  }

  return PODIUM_THEME_NEUTRAL
}

// Nombre minimum de réponses pour être éligible à l'award "sniper" (évite
// qu'un joueur n'ayant répondu qu'une fois gagne par défaut).
const MIN_ANSWERS_FOR_SNIPER = 3

// Awards de fin de soirée ("Wrapped"), calculés sur l'ensemble des quiz joués.
// `comeback` est une heuristique APPROXIMATIVE (delta entre le rang au
// premier quiz et le rang final cumulé, sans tenir compte des quiz
// intermédiaires) — assumée, pas un calcul exact de progression.
const hasValue = <T>(v: T | null | undefined): v is T =>
  v !== null && v !== undefined

export const calculateAwards = (
  results: GameResult[],
  finalLeaderboard: Player[],
): Award[] => {
  const awards: Award[] = []

  let fastestPlayerName: string | null = null
  let fastestTimeMs = Number.POSITIVE_INFINITY

  const answerStats = new Map<string, { correct: number; total: number }>()

  const allAnswers = results.flatMap((result) =>
    result.questions.flatMap((question) => question.playerAnswers),
  )

  for (const pa of allAnswers) {
    const hasAnswered =
      hasValue(pa.answerId) ||
      hasValue(pa.textAnswer) ||
      hasValue(pa.numberAnswer) ||
      hasValue(pa.orderAnswer)

    if (!hasAnswered) {
      continue
    }

    const stats = answerStats.get(pa.playerName) ?? { correct: 0, total: 0 }
    stats.total += 1

    if (pa.points > 0) {
      stats.correct += 1

      if (hasValue(pa.timeMs) && pa.timeMs < fastestTimeMs) {
        fastestTimeMs = pa.timeMs
        fastestPlayerName = pa.playerName
      }
    }

    answerStats.set(pa.playerName, stats)
  }

  if (fastestPlayerName) {
    awards.push({
      type: "fastest",
      playerName: fastestPlayerName,
      value: fastestTimeMs,
    })
  }

  let sniperName: string | null = null
  let sniperRatio = 0

  for (const [playerName, stats] of answerStats) {
    if (stats.total < MIN_ANSWERS_FOR_SNIPER) {
      continue
    }

    const ratio = stats.correct / stats.total

    if (ratio > sniperRatio) {
      sniperRatio = ratio
      sniperName = playerName
    }
  }

  if (sniperName) {
    awards.push({
      type: "sniper",
      playerName: sniperName,
      value: Math.round(sniperRatio * 100),
    })
  }

  // Pas de "perdant" décerné pour une partie solo.
  if (finalLeaderboard.length >= 2) {
    const loser = finalLeaderboard[finalLeaderboard.length - 1]!
    awards.push({ type: "loser", playerName: loser.username })
  }

  const [firstQuiz] = results

  if (firstQuiz) {
    let comebackName: string | null = null
    let comebackScore = 0

    finalLeaderboard.forEach((player, index) => {
      const finalRank = index + 1
      const firstQuizPlayer = firstQuiz.players.find(
        (p) => p.username === player.username,
      )

      if (!firstQuizPlayer) {
        return
      }

      const score = firstQuizPlayer.rank - finalRank

      if (score > comebackScore) {
        comebackScore = score
        comebackName = player.username
      }
    })

    if (comebackName) {
      awards.push({
        type: "comeback",
        playerName: comebackName,
        value: comebackScore,
      })
    }
  }

  return awards
}
