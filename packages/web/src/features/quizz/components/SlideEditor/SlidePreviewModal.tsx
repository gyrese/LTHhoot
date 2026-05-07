import { type QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { X } from "lucide-react"
import { useEffect, type CSSProperties } from "react"
import SlideCanvas from "./SlideCanvas"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
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
import { useTranslation } from "react-i18next"
import slideBg from "@rahoot/web/assets/slide-bg.png"

type Props = {
  question: QuestionWithId
  onClose: () => void
}

const SlidePreviewModal = ({ question, onClose }: Props) => {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

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
  } = question

  let bgStyle: CSSProperties = {
    backgroundImage: `url(${slideBg})`,
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
      className="fixed inset-0 z-[9999] flex flex-col bg-black text-white"
      onClick={onClose}
    >
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ ...bgStyle, opacity: backgroundOpacity ?? 0.5 }}
      />

      {/* Slide Elements (Konva) */}
      <div className="pointer-events-none absolute inset-0">
        <SlideCanvas
          elements={elements || []}
          onChange={() => {}}
          selectedId={undefined}
          onSelect={() => {}}
          readOnly={true}
        />
      </div>

      {/* Header (Question Title) */}
      {type !== "title" && (
        <div
          className="relative z-10 px-4 pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-black/50 px-6 py-4 shadow-2xl backdrop-blur-md">
            <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl">
              {title}
            </h2>
          </div>
        </div>
      )}

      {/* Media Section */}
      <div
        className="relative z-0 mx-auto flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <QuestionMedia
          media={
            type === "drop_pin" && pinImage
              ? { type: "image", url: pinImage }
              : media
          }
          alt={title}
        />
      </div>

      {/* Footer (Answers / Controls) */}
      <div
        className="relative z-10 w-full pb-8"
        onClick={(e) => e.stopPropagation()}
      >
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
            <McqAnswers answers={answers} onAnswer={() => {}} />
          )}
          {type === "true_false" && <TrueFalseAnswers />}
          {type === "open" && <OpenAnswerPlaceholder />}
          {type === "date" && (
            <DateAnswer
              minYear={minYear}
              maxYear={maxYear}
              onNumberAnswer={() => {}}
            />
          )}
          {type === "slider" && (
            <SliderAnswer
              min={min ?? 0}
              max={max ?? 100}
              onNumberAnswer={() => {}}
            />
          )}
          {type === "puzzle" && items && (
            <PuzzleAnswer items={items} onOrderAnswer={() => {}} />
          )}
          {type === "drop_pin" && pinImage && (
            <div className="pointer-events-none scale-90 opacity-80">
              <DropPinAnswer pinImage={pinImage} onTextAnswer={() => {}} />
            </div>
          )}
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[100] rounded-full border border-white/20 bg-white/10 p-2 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
      >
        <X className="size-6" />
      </button>
    </div>
  )
}

export default SlidePreviewModal
