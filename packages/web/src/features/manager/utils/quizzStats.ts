import type { QuizzMeta } from "@rahoot/common/types/game"
import type { TFunction } from "i18next"

type QuizzStats = Pick<QuizzMeta, "questionCount" | "estimatedDurationSec">

// Cumul des statistiques d'une sélection de quiz (estimation d'une soirée).
export const sumQuizzStats = (quizzes: QuizzStats[]): Required<QuizzStats> =>
  quizzes.reduce<Required<QuizzStats>>(
    (acc, quiz) => ({
      questionCount: acc.questionCount + (quiz.questionCount || 0),
      estimatedDurationSec:
        acc.estimatedDurationSec + (quiz.estimatedDurationSec ?? 0),
    }),
    { questionCount: 0, estimatedDurationSec: 0 },
  )

// Durée arrondie à la minute, jamais « ~0 min » pour un quiz non vide.
export const formatEstimatedDuration = (t: TFunction, seconds: number) =>
  t("manager:quizz.estimatedDuration", {
    minutes: Math.max(1, Math.round(seconds / 60)),
  })

// Résumé « ~45 min · 42 questions » ; la durée est omise si inconnue.
export const formatQuizzStats = (t: TFunction, stats: QuizzStats) => {
  const parts: string[] = []

  if (stats.estimatedDurationSec && stats.estimatedDurationSec > 0) {
    parts.push(formatEstimatedDuration(t, stats.estimatedDurationSec))
  }

  parts.push(
    t("manager:quizz.questionCount", { count: stats.questionCount || 0 }),
  )

  return parts.join(" · ")
}
