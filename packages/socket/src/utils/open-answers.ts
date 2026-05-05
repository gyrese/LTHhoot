import type { Answer, Player } from "@rahoot/common/types/game"

export function buildOpenAnswersList(
  playersAnswers: Answer[],
  players: Player[],
  correctAnswers: string[],
): Array<{ text: string; playerName: string; isCorrect: boolean }> {
  return playersAnswers
    .filter((a) => Boolean(a.textAnswer))
    .map((a) => {
      const key = a.textAnswer!.trim().toLowerCase()

      return {
        text: a.textAnswer!.trim(),
        playerName: players.find((p) => p.id === a.playerId)?.username ?? "?",
        isCorrect: correctAnswers.some((ca) => ca.trim().toLowerCase() === key),
      }
    })
}
