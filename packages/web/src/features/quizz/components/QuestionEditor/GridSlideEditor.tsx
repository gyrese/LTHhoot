import type {
  GridCell,
  GridQuestion,
  QuestionLayoutBox,
} from "@rahoot/common/types/game"
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
} from "@rahoot/web/features/game/utils/question-layout"
import MediaSearchModal from "@rahoot/web/features/quizz/components/MediaSearchModal"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { balancedColumns } from "@rahoot/web/features/quizz/utils/grid"
import { uploadImageToServer } from "@rahoot/web/features/quizz/utils/upload"
import clsx from "clsx"
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useState, type DragEvent } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"

// ─── Grille éditée directement sur la diapositive ─────────────────────────────
// Calque posé dans le repère 1920×1080 (comme le titre et les cases QCM) : la
// grille occupe la plus grande zone libre au-dessus ou au-dessous du titre et
// ses cases carrées sont dimensionnées pour y tenir entièrement — plus de
// débordement ni de chevauchement, quel que soit le nombre de cases. Chaque
// case porte ses propres contrôles (image, bonne réponse, libellé, retrait).

// Marges en unités slide. Le haut reste sous le HUD de l'écran hôte.
const HUD_TOP = 100
const EDGE = 24
const SIDE = 32
const GAP = 16

type Zone = { x: number; y: number; width: number; height: number }

// Plus grande bande horizontale libre autour du titre.
const freeZone = (title: QuestionLayoutBox): Zone => {
  const below = {
    top: title.y + title.height + EDGE,
    bottom: SLIDE_HEIGHT - EDGE,
  }
  const above = { top: HUD_TOP, bottom: title.y - EDGE }
  const band =
    below.bottom - below.top >= above.bottom - above.top ? below : above

  return {
    x: SIDE,
    y: band.top,
    width: SLIDE_WIDTH - SIDE * 2,
    height: Math.max(0, band.bottom - band.top),
  }
}

const GridSlideEditor = ({
  question,
  titleBox,
}: {
  question: GridQuestion
  titleBox: QuestionLayoutBox
}) => {
  const { currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  // Case dont on choisit l'image (modale ouverte), case survolée par un
  // fichier glissé, case en cours d'upload.
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  const cells = question.cells ?? []
  const correctIndexes = question.correctIndexes ?? []
  const cols = Math.max(
    1,
    question.cellsPerRow || balancedColumns(cells.length),
  )
  const rows = Math.max(1, Math.ceil(cells.length / cols))

  const zone = freeZone(titleBox)
  const cell = Math.max(
    0,
    Math.min(
      (zone.width - GAP * (cols - 1)) / cols,
      (zone.height - GAP * (rows - 1)) / rows,
    ),
  )
  const gridW = cell * cols + GAP * (cols - 1)
  const gridH = cell * rows + GAP * (rows - 1)
  // Contrôles proportionnels à la case : lisibles en 2 cases comme en 24.
  const control = Math.min(56, Math.max(32, cell * 0.17))
  const labelFont = Math.min(26, Math.max(16, cell * 0.09))

  const patchCell = (index: number, patch: Partial<GridCell>) => {
    updateQuestion(currentIndex, {
      cells: cells.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    })
  }

  // Au moins une bonne case : une grille sans bonne réponse serait ingagnable.
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

  // Dépôt d'un fichier image sur une case : upload puis affectation.
  const handleDrop = async (index: number, e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverIndex(null)
    const file = e.dataTransfer.files?.[0]

    if (!file?.type.startsWith("image/")) {
      return
    }

    setUploadingIndex(index)

    try {
      patchCell(index, { image: await uploadImageToServer(file) })
    } catch {
      // L'échec a déjà été notifié par uploadImageToServer.
    } finally {
      setUploadingIndex(null)
    }
  }

  return (
    <>
      <div
        className="pointer-events-none absolute grid"
        style={{
          left: zone.x + (zone.width - gridW) / 2,
          top: zone.y + (zone.height - gridH) / 2,
          width: gridW,
          height: gridH,
          gap: GAP,
          gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
          gridAutoRows: cell,
        }}
      >
        {cells.map((c, index) => {
          const isCorrect = correctIndexes.includes(index)
          const isDragOver = dragOverIndex === index

          return (
            <div
              key={index}
              className={clsx(
                "group pointer-events-auto relative overflow-hidden rounded-2xl border-4 bg-black/50 transition-[border-color,box-shadow]",
                isCorrect &&
                  "border-green-500 shadow-[0_0_28px_rgba(34,197,94,0.45)]",
                !isCorrect && isDragOver && "border-primary",
                !isCorrect &&
                  !isDragOver &&
                  "border-white/15 hover:border-white/40",
              )}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDragOverIndex(index)
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => void handleDrop(index, e)}
            >
              {/* Zone image : clic = choisir / remplacer l'image */}
              <button
                type="button"
                onClick={() => setPickingIndex(index)}
                title={t("quizz:grid.pickImage")}
                aria-label={t("quizz:grid.pickImage")}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40 transition-colors hover:text-white/80"
              >
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.label || `${index + 1}`}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus
                    style={{ width: cell * 0.28, height: cell * 0.28 }}
                  />
                )}
              </button>

              {isDragOver && (
                <span className="bg-primary/25 pointer-events-none absolute inset-0" />
              )}

              {uploadingIndex === index && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
                  <Loader2
                    className="animate-spin"
                    style={{ width: control, height: control }}
                  />
                </span>
              )}

              {/* Numéro de la case */}
              <span
                className="pointer-events-none absolute flex items-center justify-center rounded-full bg-black/70 font-black text-white"
                style={{
                  top: 8,
                  left: 8,
                  width: control,
                  height: control,
                  fontSize: control * 0.45,
                }}
              >
                {index + 1}
              </span>

              {/* Bonne réponse */}
              <button
                type="button"
                onClick={() => toggleCorrect(index)}
                aria-pressed={isCorrect}
                title={t("quizz:markCorrect", "Marquer comme correcte")}
                aria-label={t("quizz:markCorrect", "Marquer comme correcte")}
                className={clsx(
                  "absolute flex items-center justify-center rounded-full border-white shadow-lg transition-colors",
                  isCorrect
                    ? "bg-green-500 text-white"
                    : "bg-black/50 text-white/40 hover:bg-black/70 hover:text-white",
                )}
                style={{
                  top: 8,
                  right: 8,
                  width: control,
                  height: control,
                  borderWidth: isCorrect ? 0 : 3,
                }}
              >
                <Check className="size-3/5" strokeWidth={3.5} />
              </button>

              {/* Retrait de l'image (au survol) */}
              {c.image && (
                <button
                  type="button"
                  onClick={() => patchCell(index, { image: "" })}
                  title={t("quizz:grid.removeImage")}
                  aria-label={t("quizz:grid.removeImage")}
                  className="absolute flex items-center justify-center rounded-full bg-black/70 text-red-400 opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-red-500 hover:text-white"
                  style={{
                    top: 16 + control,
                    right: 8,
                    width: control,
                    height: control,
                  }}
                >
                  <Trash2 className="size-1/2" />
                </button>
              )}

              {/* Libellé : bandeau du bas, comme sur l'écran de jeu. Masqué
                  tant qu'il est vide et que la case n'est pas survolée. */}
              <input
                type="text"
                value={c.label ?? ""}
                onChange={(e) => patchCell(index, { label: e.target.value })}
                placeholder={t("quizz:grid.labelPlaceholder")}
                className={clsx(
                  "absolute inset-x-0 bottom-0 bg-black/70 text-center font-bold text-white backdrop-blur-sm outline-none placeholder:font-medium placeholder:text-white/50 focus:bg-black/85",
                  !c.label &&
                    "opacity-0 group-hover:opacity-100 focus:opacity-100",
                )}
                style={{
                  fontSize: labelFont,
                  padding: `${labelFont * 0.4}px ${labelFont * 0.5}px`,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Portail : le calque est transformé (zoom), une modale `fixed` à
          l'intérieur serait positionnée relativement à lui. */}
      {createPortal(
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
        />,
        document.body,
      )}
    </>
  )
}

export default GridSlideEditor
