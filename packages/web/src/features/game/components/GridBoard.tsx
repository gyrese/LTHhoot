import type { GridCell } from "@rahoot/common/types/game"
import clsx from "clsx"
import { Check } from "lucide-react"

type Props = {
  cells: GridCell[]
  cellsPerRow: number
  /** Case actuellement sélectionnée par le joueur (avant validation). */
  selectedIndex?: number | null
  /** Rend la grille cliquable (écran joueur). */
  onSelect?: (_index: number) => void
  disabled?: boolean
  /** Phase résultats : cases justes mises en avant, les autres estompées. */
  correctIndexes?: number[]
  /** Phase résultats : nombre de réponses par case. */
  counts?: Record<number, number>
  /**
   * Hauteur maximale (unité CSS) que la grille ne doit pas dépasser. Les cases
   * étant carrées, borner la hauteur passe par une largeur maximale déduite du
   * ratio colonnes/lignes — un simple `max-height` ne rétrécirait pas les cases.
   */
  fitHeight?: string
  className?: string
}

/**
 * Grille de propositions visuelles, partagée par l'écran hôte, l'écran joueur,
 * l'écran de résultats et les aperçus de l'éditeur. La disposition ne dépend que
 * de `cellsPerRow` : tout le monde voit exactement la même grille, du
 * vidéoprojecteur au mobile.
 */
const GridBoard = ({
  cells,
  cellsPerRow,
  selectedIndex,
  onSelect,
  disabled,
  correctIndexes,
  counts,
  fitHeight,
  className,
}: Props) => {
  const isResult = correctIndexes !== undefined
  const cols = Math.max(1, cellsPerRow)
  const rows = Math.max(1, Math.ceil(cells.length / cols))

  return (
    <div
      className={clsx("grid w-full gap-2 sm:gap-3", className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        maxWidth: fitHeight
          ? `calc(${fitHeight} * ${cols} / ${rows})`
          : undefined,
      }}
    >
      {cells.map((cell, index) => {
        const isSelected = selectedIndex === index
        const isCorrect = Boolean(correctIndexes?.includes(index))
        const interactive = Boolean(onSelect) && !disabled

        return (
          <button
            key={index}
            type="button"
            disabled={!interactive}
            onClick={() => onSelect?.(index)}
            className={clsx(
              "relative aspect-square overflow-hidden rounded-2xl border-2 bg-black/40 transition-all",
              // 44 px minimum : cible tactile confortable même en grille dense.
              "min-h-11 min-w-11",
              interactive && "cursor-pointer active:scale-95",
              isSelected && "border-orange-400 ring-4 ring-orange-400/40",
              !isSelected && isCorrect && "border-green-400",
              !isSelected && !isCorrect && "border-white/15",
              isResult && !isCorrect && "opacity-45 grayscale",
            )}
          >
            {cell.image ? (
              <img
                src={cell.image}
                alt={cell.label || `${index + 1}`}
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-black text-white/25">
                {index + 1}
              </span>
            )}

            {/* Voile orange + pastille : la seule bordure ne se voyait pas
                assez sur une image chargée, en plein jeu. */}
            {isSelected && (
              <>
                <span className="absolute inset-0 bg-orange-500/35" />
                <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg">
                  <Check className="size-4 stroke-3" />
                </span>
              </>
            )}

            <span className="absolute top-1 left-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-xs font-black text-white">
              {index + 1}
            </span>

            {isCorrect && (
              <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-green-500 text-white shadow-lg">
                <Check className="size-4 stroke-3" />
              </span>
            )}

            {counts && (
              <span
                className={clsx(
                  // Remonté au-dessus du bandeau de libellé, qui masquerait
                  // sinon le compteur.
                  "absolute right-1 rounded-full bg-black/75 px-2 py-0.5 text-xs font-bold text-white tabular-nums",
                  cell.label ? "bottom-8" : "bottom-1",
                )}
              >
                {counts[index] ?? 0}
              </span>
            )}

            {cell.label && (
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-1 text-center text-xs font-bold text-white backdrop-blur-sm">
                {cell.label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default GridBoard
