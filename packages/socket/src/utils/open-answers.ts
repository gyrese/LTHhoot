import type { Answer, Player } from "@rahoot/common/types/game"
import { normalizeAnswer } from "@rahoot/common/utils/normalize-answer"

export function buildOpenAnswersList(
  playersAnswers: Answer[],
  players: Player[],
  correctAnswers: string[],
): Array<{ text: string; playerName: string; isCorrect: boolean }> {
  return playersAnswers
    .filter((a) => Boolean(a.textAnswer))
    .map((a) => {
      const key = normalizeAnswer(a.textAnswer!)

      return {
        text: a.textAnswer!.trim(),
        playerName: players.find((p) => p.id === a.playerId)?.username ?? "?",
        isCorrect: correctAnswers.some((ca) => normalizeAnswer(ca) === key),
      }
    })
}
