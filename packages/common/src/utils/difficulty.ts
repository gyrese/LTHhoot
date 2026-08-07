import type { QuestionDifficulty } from "@rahoot/common/types/game"

// Ordre canonique : sert aussi à présenter un lot en montée de difficulté.
export const DIFFICULTY_ORDER: QuestionDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
]

export type DifficultySlice = {
  difficulty: QuestionDifficulty
  count: number
}

/**
 * Répartit `count` questions équitablement entre les niveaux demandés.
 * Le reste de la division va aux niveaux les plus faciles (10 questions sur
 * easy+expert → 5/5 ; sur easy+medium+expert → 4/3/3).
 *
 * Partagé : le serveur en fait une consigne de prompt, la modale l'affiche en
 * aperçu. Les deux doivent annoncer la même répartition.
 */
export const distributeDifficulties = (
  count: number,
  difficulties: readonly QuestionDifficulty[],
): DifficultySlice[] => {
  const selected = DIFFICULTY_ORDER.filter((d) => difficulties.includes(d))

  if (selected.length === 0) {
    return [{ difficulty: "medium", count }]
  }

  const base = Math.floor(count / selected.length)
  let remainder = count % selected.length

  return selected
    .map((difficulty) => {
      const extra = remainder > 0 ? 1 : 0
      remainder -= extra

      return { difficulty, count: base + extra }
    })
    .filter((slice) => slice.count > 0)
}
