// Répartition automatique des cases d'une question « grille ». L'hôte ne
// choisit qu'un NOMBRE de cases : la mise en page est déduite ici, une seule
// fois, et stockée dans la question (`cellsPerRow`) pour que l'écran de
// présentation, le mobile des joueurs et l'écran de résultats affichent
// exactement la même grille.

export const MIN_GRID_CELLS = 2
export const MAX_GRID_CELLS = 24
export const DEFAULT_GRID_CELLS = 6

// Au-delà de 6 colonnes, les cases deviennent illisibles sur un mobile.
const MAX_COLS = 6

/**
 * Vise le carré (racine carrée du nombre de cases) et élargit d'une colonne
 * quand cela remplit exactement la dernière ligne : 8 cases donnent ainsi 4×2
 * plutôt que 3+3+2.
 */
export const balancedColumns = (count: number): number => {
  const ideal = Math.min(MAX_COLS, Math.max(1, Math.ceil(Math.sqrt(count))))

  if (
    count % ideal !== 0 &&
    ideal + 1 <= MAX_COLS &&
    count % (ideal + 1) === 0
  ) {
    return ideal + 1
  }

  return ideal
}
