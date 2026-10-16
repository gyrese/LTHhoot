import type { QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  DateAnswer,
  McqAnswers,
  OpenAnswer,
  SliderAnswer,
  TrueFalseAnswers,
} from "@rahoot/web/features/game/components/AnswersDisplay"
import {
  PuzzleAnswer,
  DropPinAnswer,
  GridAnswer,
} from "@rahoot/web/features/game/components/states/AnswerInputs"
import type { GridCell } from "@rahoot/common/types/game"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import PreviewCorrection, { type PreviewPhase } from "./PreviewCorrection"
import { QuestionContent } from "@rahoot/web/features/game/components/states/Question"
import SlideCanvas from "./SlideCanvas"
import BackgroundRevealer from "@rahoot/web/features/game/components/BackgroundRevealer"
import ImageSequenceReveal from "@rahoot/web/features/game/components/states/ImageSequenceReveal"

// Taille de conception fixe façon téléphone, réduite via transform pour tenir
// dans la colonne (même approche que PreviewPresenterView).
const DESIGN_W = 360
const DESIGN_H = 640

type Props = {
  question: QuestionWithId
  phase?: PreviewPhase
}

const ParticipantBody = ({ question, phase = "answers" }: Props) => {
  if (phase === "question" || question.type === "title") {
    return <QuestionContent data={question} preview />
  }
  if (phase === "correction") {
    return <PreviewCorrection question={question} />
  }
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
    pickCount,
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
    pickCount?: number
  }

  if (type === "mcq" && answers) {
    return (
      <McqAnswers
        answers={answers}
        iconOnly
        answerBoxes={question.layout?.answers}
        onAnswer={() => undefined}
      />
    )
  }

  if (type === "true_false") {
    return (
      <TrueFalseAnswers
        answerBoxes={question.layout?.answers}
        onAnswer={() => undefined}
      />
    )
  }

  if (type === "open" || type === "image_sequence") {
    return (
      <div className="flex flex-1 items-center">
        <OpenAnswer onTextAnswer={() => undefined} />
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
          pickCount={pickCount}
          onAnswer={() => undefined}
        />
      </div>
    )
  }

  // Slide titre : aucune interaction côté joueur
  return <div className="flex-1" />
}

const ParticipantAnswers = ({ question }: Props) => {
  const { t } = useTranslation()
  const customBackground = Boolean(question.background?.value)
  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden">
      <div
        className={
          customBackground
            ? "absolute inset-0 bg-black"
            : "absolute inset-0 bg-slate-900"
        }
      />
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            question.background?.type === "color"
              ? undefined
              : `url(${question.background?.value || "/bg-salon.png"})`,
          backgroundColor:
            question.background?.type === "color"
              ? question.background.value
              : undefined,
          opacity:
            question.backgroundOpacity ??
            (customBackground || question.revelationEnabled ? 1 : 0.5),
        }}
      />
      {question.revelationEnabled && (
        <BackgroundRevealer
          duration={question.revealDuration ?? question.time}
          gridCols={question.gridCols ?? 8}
          gridRows={question.gridRows ?? 6}
          seedString={question.question || question.background?.value}
          configuredStyle={question.revelationStyle}
          imageUrl={
            question.background?.type === "image"
              ? question.background.value
              : undefined
          }
        />
      )}
      {question.elements && question.elements.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <SlideCanvas
            elements={question.elements}
            onChange={() => undefined}
            onSelect={() => undefined}
            readOnly
            noBackground
            hideYoutube
          />
        </div>
      )}
      {question.type === "image_sequence" && question.images.length > 0 && (
        <ImageSequenceReveal
          images={question.images}
          imageInterval={question.imageInterval ?? 5}
        />
      )}
      <div className="absolute inset-x-0 top-0 z-20 h-2 bg-green-500" />
      <div className="relative z-10 px-4 pt-4">
        <div className="rounded-2xl bg-black/50 px-6 py-4 backdrop-blur-md">
          <h2 className="text-center text-2xl font-bold text-white">
            {question.question}
          </h2>
        </div>
      </div>
      <div className="flex-1" />
      <div className="relative z-10 pb-20">
        <div className="mb-4 flex justify-between gap-1 px-2 text-lg font-bold">
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4">
            <span className="text-sm">{t("game:hud.time")}</span>
            <span>{question.time}</span>
          </div>
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4">
            <span className="text-sm">{t("game:hud.answers")}</span>
            <span>0/1</span>
          </div>
        </div>
        <ParticipantBody question={question} phase="answers" />
      </div>
    </div>
  )
}

const PreviewParticipantView = ({ question, phase = "answers" }: Props) => {
  const { t } = useTranslation()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = wrapperRef.current

    if (!el) {
      return undefined
    }

    if (el.clientWidth > 0) {
      setScale(el.clientWidth / DESIGN_W)
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
        key={`${question.id}-${phase}`}
        className="absolute top-0 left-0 flex flex-col bg-slate-950 text-white"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {phase === "answers" && question.type !== "title" ? (
          <ParticipantAnswers question={question} />
        ) : (
          <ParticipantBody question={question} phase={phase} />
        )}
        <div className="absolute right-0 bottom-0 left-0 z-20 flex min-h-16 items-center justify-between bg-black/60 px-3 py-3 backdrop-blur-md">
          <span className="text-sm font-bold">{t("game:player")}</span>
          <span className="bg-primary/20 text-primary ring-primary/40 rounded-lg px-3 py-1.5 text-sm font-black ring-1">
            0 pts
          </span>
        </div>
      </div>
    </div>
  )
}

export default PreviewParticipantView
