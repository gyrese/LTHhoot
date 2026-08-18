import {
  type QuestionWithId,
  useQuizzEditor,
} from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import SlideCanvas from "./SlideCanvas"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
import BackgroundRevealer from "@rahoot/web/features/game/components/BackgroundRevealer"
import {
  DateAnswer,
  McqAnswers,
  OpenAnswerPlaceholder,
  SliderAnswer,
  TrueFalseAnswers,
} from "@rahoot/web/features/game/components/AnswersDisplay"
import {
  PuzzleAnswer,
  DropPinAnswer,
} from "@rahoot/web/features/game/components/states/AnswerInputs"
import GridBoard from "@rahoot/web/features/game/components/GridBoard"
import ImageSequenceReveal from "@rahoot/web/features/game/components/states/ImageSequenceReveal"
import type { GridCell } from "@rahoot/common/types/game"
import { useTranslation } from "react-i18next"
import slideBg from "@rahoot/web/assets/slide-bg.png"
import clsx from "clsx"

// Taille de conception fixe : la slide est rendue comme en présentation réelle
// puis réduite via transform pour tenir dans la carte (miniature fidèle).
const DESIGN_W = 1280
const DESIGN_H = 720

type Props = {
  question: QuestionWithId
  className?: string
  hideYoutube?: boolean
}

const isEmpty = (list?: unknown[]) => !list || list.length === 0

const hasGridCells = (type: string, cells?: GridCell[]) =>
  type === "grid" && !isEmpty(cells)

const PreviewPresenterView = ({
  question,
  className,
  hideYoutube = true,
}: Props) => {
  const { t } = useTranslation()
  const { salonImage: quizSalonImage } = useQuizzEditor()
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
        if (entry.contentRect.width > 0) {
          setScale(entry.contentRect.width / DESIGN_W)
        }
      }
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  const {
    type,
    background,
    backgroundOpacity,
    elements,
    question: title,
    media,
    answers,
    min,
    max,
    minYear,
    maxYear,
    items,
    pinImage,
    cells,
    cellsPerRow,
    revealDuration,
    gridCols,
    gridRows,
    revelationStyle,
    images,
    imageInterval,
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
    revealDuration?: number
    gridCols?: number
    gridRows?: number
    revelationStyle?: string
    images?: string[]
    imageInterval?: number
  }

  let bgStyle: CSSProperties = {
    backgroundImage: `url(${quizSalonImage || slideBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  }

  if (background?.type === "image") {
    bgStyle = {
      backgroundImage: `url(${background.value})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
  } else if (background?.type === "color") {
    bgStyle = { backgroundColor: background.value }
  }

  return (
    <div
      ref={wrapperRef}
      className={clsx(
        "relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl",
        className,
      )}
    >
      <div
        key={question.id}
        className="pointer-events-none absolute top-0 left-0 flex flex-col text-white"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Fond de slide */}
        <div
          className="absolute inset-0"
          style={{
            ...bgStyle,
            opacity:
              backgroundOpacity ?? (question.revelationEnabled ? 1.0 : 0.5),
          }}
        />

        {question.revelationEnabled && (
          <BackgroundRevealer
            duration={
              revealDuration ??
              (type === "title"
                ? question.cooldown
                : question.cooldown + question.time)
            }
            gridCols={gridCols ?? 8}
            gridRows={gridRows ?? 6}
            seedString={title || question.background?.value}
            configuredStyle={revelationStyle}
            imageUrl={
              background?.type === "image" ? background.value : undefined
            }
          />
        )}

        {/* Éléments de slide (Konva) */}
        <div className="absolute inset-0">
          <SlideCanvas
            elements={elements || []}
            onChange={() => undefined}
            selectedId={undefined}
            onSelect={() => undefined}
            readOnly={true}
            noBackground={true}
            hideYoutube={hideYoutube}
          />
        </div>

        {type === "image_sequence" && images && images.length > 0 && (
          <ImageSequenceReveal
            images={images}
            imageInterval={imageInterval ?? 5}
          />
        )}

        {/* Titre de la question */}
        {type !== "title" && (
          <div className="relative z-10 px-4 pt-4">
            <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-black/50 px-6 py-4 shadow-2xl backdrop-blur-md">
              <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl">
                {title}
              </h2>
            </div>
          </div>
        )}

        {/* Média — la grille prend la place centrale, comme sur l'écran hôte */}
        {type !== "title" && (
          <div className="relative z-0 mx-auto flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5 px-10">
            {hasGridCells(type, cells) ? (
              <GridBoard
                cells={cells!}
                cellsPerRow={cellsPerRow ?? 3}
                fitHeight="420px"
                className="max-w-3xl"
              />
            ) : (
              isEmpty(elements) && (
                <QuestionMedia
                  media={
                    type === "drop_pin" && pinImage
                      ? { type: "image", url: pinImage }
                      : media
                  }
                  alt={title}
                />
              )
            )}
          </div>
        )}

        {/* Pied (HUD + réponses) */}
        {type !== "title" && (
          <div className="relative z-10 w-full pb-8">
            <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
              <div className="flex flex-col items-center rounded-full border border-white/5 bg-black/40 px-4 text-lg font-bold">
                <span className="translate-y-1 text-sm opacity-60">
                  {t("game:hud.time")}
                </span>
                <span className="tabular-nums">{question.time}</span>
              </div>
              <div className="flex flex-col items-center rounded-full border border-white/5 bg-black/40 px-4 text-lg font-bold">
                <span className="translate-y-1 text-sm opacity-60">
                  {t("game:hud.answers")}
                </span>
                <span className="tabular-nums">0/10</span>
              </div>
            </div>

            <div className="w-full">
              {type === "mcq" && answers && (
                <McqAnswers answers={answers} onAnswer={() => undefined} />
              )}
              {type === "true_false" && <TrueFalseAnswers />}
              {type === "open" && <OpenAnswerPlaceholder />}
              {type === "image_sequence" && <OpenAnswerPlaceholder />}
              {type === "date" && (
                <DateAnswer
                  minYear={minYear}
                  maxYear={maxYear}
                  onNumberAnswer={() => undefined}
                />
              )}
              {type === "slider" && (
                <SliderAnswer
                  min={min ?? 0}
                  max={max ?? 100}
                  onNumberAnswer={() => undefined}
                />
              )}
              {type === "puzzle" && items && (
                <PuzzleAnswer items={items} onOrderAnswer={() => undefined} />
              )}
              {type === "drop_pin" && pinImage && (
                <div className="scale-90 opacity-80">
                  <DropPinAnswer
                    pinImage={pinImage}
                    onTextAnswer={() => undefined}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PreviewPresenterView
