import type { GridCell, GridQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  balancedColumns,
  MAX_GRID_CELLS,
  MIN_GRID_CELLS,
} from "@rahoot/web/features/quizz/utils/grid"
import { Info, Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

type GridWithId = GridQuestion & { id: string }

const emptyCell = (): GridCell => ({ image: "" })

// Barre d'outils de la grille (coin haut-gauche, comme celle du QCM). Les
// cases elles-mêmes sont éditées sur la diapositive (GridSlideEditor).
const QuestionEditorGrid = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as GridWithId

  const cells = q.cells ?? []
  const correctIndexes = q.correctIndexes ?? []
  const cellsPerRow = q.cellsPerRow || balancedColumns(cells.length)
  const rows = Math.max(1, Math.ceil(cells.length / cellsPerRow))

  // Le nombre de colonnes n'est pas réglable : il est recalculé à chaque
  // changement du nombre de cases pour garder une grille équilibrée.
  const setCount = (count: number) => {
    const next = Math.min(MAX_GRID_CELLS, Math.max(MIN_GRID_CELLS, count))
    const nextCells = Array.from(
      { length: next },
      (_, i) => cells[i] ?? emptyCell(),
    )
    const nextCorrect = correctIndexes.filter((i) => i < next)

    updateQuestion(currentIndex, {
      cells: nextCells,
      cellsPerRow: balancedColumns(next),
      // Une grille sans case correcte ne serait jamais gagnable : on retombe
      // sur la première case si le retrait a fait disparaître les bonnes.
      correctIndexes: nextCorrect.length > 0 ? nextCorrect : [0],
    })
  }

  return (
    <div className="flex items-center gap-1 rounded-xl bg-black/50 py-1 pr-1 pl-3 shadow-sm backdrop-blur-md">
      <span className="text-xs font-semibold text-white/70">
        {t("quizz:grid.countLabel")}
      </span>

      <button
        type="button"
        onClick={() => setCount(cells.length - 1)}
        disabled={cells.length <= MIN_GRID_CELLS}
        className="ml-1 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
        title={t("quizz:grid.removeCell")}
      >
        <Minus className="size-4" />
      </button>
      <span className="w-7 text-center text-sm font-black text-white tabular-nums">
        {cells.length}
      </span>
      <button
        type="button"
        onClick={() => setCount(cells.length + 1)}
        disabled={cells.length >= MAX_GRID_CELLS}
        className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
        title={t("quizz:grid.addCell")}
      >
        <Plus className="size-4" />
      </button>

      <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/60 tabular-nums">
        {cellsPerRow} × {rows}
      </span>

      <span
        className="rounded-lg p-1.5 text-white/50 hover:text-white"
        title={t("quizz:grid.hint")}
        aria-label={t("quizz:grid.hint")}
      >
        <Info className="size-4" />
      </span>
    </div>
  )
}

export default QuestionEditorGrid
