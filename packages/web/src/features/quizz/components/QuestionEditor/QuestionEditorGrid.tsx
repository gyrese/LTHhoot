import type { GridCell, GridQuestion } from "@rahoot/common/types/game"
import MediaSearchModal from "@rahoot/web/features/quizz/components/MediaSearchModal"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  balancedColumns,
  MAX_GRID_CELLS,
  MIN_GRID_CELLS,
} from "@rahoot/web/features/quizz/utils/grid"
import { uploadImageToServer } from "@rahoot/web/features/quizz/utils/upload"
import clsx from "clsx"
import { Check, ImagePlus, Loader2, Minus, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

type GridWithId = GridQuestion & { id: string }

const emptyCell = (): GridCell => ({ image: "" })

const QuestionEditorGrid = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as GridWithId

  const cells = q.cells ?? []
  const correctIndexes = q.correctIndexes ?? []
  const cellsPerRow = q.cellsPerRow || balancedColumns(cells.length)
  const rows = Math.max(1, Math.ceil(cells.length / cellsPerRow))

  // Index de la case dont on est en train de choisir l'image (modale ouverte).
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

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

  const patchCell = (index: number, patch: Partial<GridCell>) => {
    updateQuestion(currentIndex, {
      cells: cells.map((cell, i) =>
        i === index ? { ...cell, ...patch } : cell,
      ),
    })
  }

  // Dépôt d'un fichier image directement sur une case : upload puis
  // affectation à cette case.
  const handleDropOnCell = async (index: number, file: File) => {
    setDragOverIndex(null)
    setUploadingIndex(index)

    try {
      const url = await uploadImageToServer(file)
      patchCell(index, { image: url })
    } catch {
      // L'échec a déjà été notifié par uploadImageToServer.
    } finally {
      setUploadingIndex(null)
    }
  }

  const toggleCorrect = (index: number) => {
    const isCorrect = correctIndexes.includes(index)

    if (isCorrect && correctIndexes.length <= 1) {
      return
    }

    updateQuestion(currentIndex, {
      correctIndexes: isCorrect
        ? correctIndexes.filter((i) => i !== index)
        : [...correctIndexes, index].sort((a, b) => a - b),
    })
  }

  return (
    <div className="z-10 flex flex-col gap-3">
      {/* Nombre de cases */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="bg-surface/90 text-ink-muted rounded-lg px-2.5 py-1 text-sm font-semibold shadow-sm backdrop-blur-sm">
          {t("quizz:grid.countLabel")}
        </span>

        <div className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setCount(cells.length - 1)}
            disabled={cells.length <= MIN_GRID_CELLS}
            className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
            title={t("quizz:grid.removeCell")}
          >
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center text-sm font-black text-white tabular-nums">
            {cells.length}
          </span>
          <button
            type="button"
            onClick={() => setCount(cells.length + 1)}
            disabled={cells.length >= MAX_GRID_CELLS}
            className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
            title={t("quizz:grid.addCell")}
          >
            <Plus className="size-4" />
          </button>
        </div>

        <span className="rounded-lg bg-black/40 px-2.5 py-1 text-xs font-semibold text-white/50 backdrop-blur-sm">
          {cellsPerRow} × {rows}
        </span>

        <span className="text-xs text-white/45">{t("quizz:grid.hint")}</span>
      </div>

      {/* Grille de cases */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${cellsPerRow}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell, index) => {
          const isCorrect = correctIndexes.includes(index)

          return (
            <div
              key={index}
              className={clsx(
                "flex flex-col gap-1.5 rounded-xl border-2 bg-black/40 p-2 backdrop-blur-sm transition-colors",
                isCorrect
                  ? "border-green-500 shadow-[0_0_18px_rgba(34,197,94,0.35)]"
                  : "border-white/10",
              )}
            >
              <button
                type="button"
                onClick={() => setPickingIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverIndex(index)
                }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]

                  if (file?.type.startsWith("image/")) {
                    void handleDropOnCell(index, file)
                  } else {
                    setDragOverIndex(null)
                  }
                }}
                className={clsx(
                  "group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-black/40 transition-colors",
                  dragOverIndex === index
                    ? "border-primary bg-primary/10"
                    : "border-white/15",
                )}
                title={t("quizz:grid.pickImage")}
              >
                {cell.image ? (
                  <img
                    src={cell.image}
                    alt={cell.label || `${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus className="size-6 text-white/35 transition-colors group-hover:text-white/70" />
                )}

                {uploadingIndex === index && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
                    <Loader2 className="size-5 animate-spin" />
                  </span>
                )}

                <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-[10px] font-black text-white">
                  {index + 1}
                </span>
              </button>

              <input
                type="text"
                value={cell.label ?? ""}
                onChange={(e) => patchCell(index, { label: e.target.value })}
                placeholder={t("quizz:grid.labelPlaceholder")}
                className="w-full rounded-md bg-white/10 px-2 py-1 text-xs text-white outline-none focus:bg-white/15"
              />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleCorrect(index)}
                  className={clsx(
                    "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors",
                    isCorrect
                      ? "bg-green-500/25 text-green-300"
                      : "bg-white/5 text-white/40 hover:bg-white/10",
                  )}
                >
                  <Check className="size-3" />
                  {isCorrect ? t("quizz:grid.correct") : t("quizz:grid.mark")}
                </button>

                {cell.image && (
                  <button
                    type="button"
                    onClick={() => patchCell(index, { image: "" })}
                    className="rounded-md p-1 text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title={t("quizz:grid.removeImage")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <MediaSearchModal
        open={pickingIndex !== null}
        onClose={() => setPickingIndex(null)}
        onSelect={(url) => {
          if (pickingIndex !== null) {
            patchCell(pickingIndex, { image: url })
          }

          setPickingIndex(null)
        }}
        allowedTypes={["image"]}
      />
    </div>
  )
}

export default QuestionEditorGrid
