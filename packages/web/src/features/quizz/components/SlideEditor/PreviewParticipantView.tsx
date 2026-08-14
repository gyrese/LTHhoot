import type { QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
} from "@rahoot/web/features/game/utils/constants"
import {
  DateAnswer,
  OpenAnswerPlaceholder,
  SliderAnswer,
} from "@rahoot/web/features/game/components/AnswersDisplay"
import {
  PuzzleAnswer,
  DropPinAnswer,
  GridAnswer,
} from "@rahoot/web/features/game/components/states/AnswerInputs"
import type { GridCell } from "@rahoot/common/types/game"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

// Taille de conception fixe façon téléphone, réduite via transform pour tenir
// dans la colonne (même approche que PreviewPresenterView).
const DESIGN_W = 360
const DESIGN_H = 640

type Props = {
  question: QuestionWithId
}

// Grille de tuiles colorées icône seule : ce que voit le joueur sur mobile
// pour les QCM / vrai-faux.
const AnswerTiles = ({ count }: { count: number }) => (
  <div className="grid flex-1 grid-cols-2 gap-1.5">
    {Array.from({ length: count }, (_, i) => {
      const Icon = ANSWERS_ICONS[i]

      if (!Icon) {
        return null
      }

      return (
        <div
          key={i}
          className={clsx(
            "shadow-inset flex items-center justify-center rounded",
            i === 0 && count === 2 && "bg-red-500",
            i === 1 && count === 2 && "bg-blue-500",
            count !== 2 && ANSWERS_COLORS[i],
          )}
        >
          <Icon className="h-12 w-12 text-white" />
        </div>
      )
    })}
  </div>
)

const ParticipantBody = ({ question }: Props) => {
  const {
    type,
    answers,
    min,
    max,
    minYear,
    maxYear,
    items,
    pinImage,
    cells,
    cellsPerRow,
  } = question as QuestionWithId & {
    answers?: string[]
    min?: number
    max?: number
    minYear?: number
    maxYear?: number
    items?: string[]
    pinImage?: string
    cells?: GridCell[]
    cellsPerRow?: number
  }

  if (type === "mcq" && answers) {
    return <AnswerTiles count={Math.min(answers.length, 4)} />
  }

  if (type === "true_false") {
    return <AnswerTiles count={2} />
  }

  if (type === "open" || type === "image_sequence") {
    return (
      <div className="flex flex-1 items-center">
        <OpenAnswerPlaceholder />
      </div>
    )
  }

  if (type === "date") {
    return (
      <div className="flex flex-1 items-center">
        <DateAnswer
          minYear={minYear}
          maxYear={maxYear}
          onNumberAnswer={() => undefined}
        />
      </div>
    )
  }

  if (type === "slider") {
    return (
      <div className="flex flex-1 items-center">
        <SliderAnswer
          min={min ?? 0}
          max={max ?? 100}
          onNumberAnswer={() => undefined}
        />
      </div>
    )
  }

  if (type === "puzzle" && items) {
    return (
      <div className="flex flex-1 items-center">
        <PuzzleAnswer items={items} onOrderAnswer={() => undefined} />
      </div>
    )
  }

  if (type === "drop_pin" && pinImage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <DropPinAnswer pinImage={pinImage} onTextAnswer={() => undefined} />
      </div>
    )
  }

  if (type === "grid" && cells && cells.length > 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <GridAnswer
          cells={cells}
          cellsPerRow={cellsPerRow ?? 3}
          onAnswer={() => undefined}
        />
      </div>
    )
  }

  // Slide titre : aucune interaction côté joueur
  return <div className="flex-1" />
}

const PreviewParticipantView = ({ question }: Props) => {
  const { t } = useTranslation()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = wrapperRef.current

    if (!el) {
      return undefined
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScale(entry.contentRect.width / DESIGN_W)
      }
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden rounded-xl bg-black shadow-2xl"
      style={{ aspectRatio: `${DESIGN_W} / ${DESIGN_H}` }}
    >
      <div
        key={question.id}
        className="pointer-events-none absolute top-0 left-0 flex flex-col gap-3 bg-gradient-to-b from-[#1e1b4b] to-[#0f172a] p-3 text-white"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Header façon manette joueur : nb de joueurs + mode */}
        <div className="flex items-center justify-between">
          <span className="flex size-7 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
            1
          </span>
          <span className="rounded-full bg-white/90 px-4 py-1 text-sm font-bold text-gray-800">
            {t("quizz:previewQuizPill", "Quiz")}
          </span>
          <span className="size-7" />
        </div>

        <ParticipantBody question={question} />
      </div>
    </div>
  )
}

export default PreviewParticipantView
