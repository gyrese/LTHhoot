import type { QuestionType } from "@rahoot/common/types/game"
import dateImg from "@rahoot/web/assets/game/types/date.png"
import dropPinImg from "@rahoot/web/assets/game/types/drop_pin.png"
import mcqImg from "@rahoot/web/assets/game/types/mcq.png"
import openImg from "@rahoot/web/assets/game/types/open.png"
import puzzleImg from "@rahoot/web/assets/game/types/puzzle.png"
import sliderImg from "@rahoot/web/assets/game/types/slider.png"
import trueFalseImg from "@rahoot/web/assets/game/types/true_false.png"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Film, Presentation } from "lucide-react"
import { useTranslation } from "react-i18next"

const TYPES: { type: QuestionType; icon?: any; img?: string; key: string }[] = [
  { type: "title", icon: Presentation, key: "quizz:questionType.title_slide" },
  { type: "mcq", img: mcqImg, key: "quizz:questionType.mcq" },
  {
    type: "true_false",
    img: trueFalseImg,
    key: "quizz:questionType.true_false",
  },
  { type: "open", img: openImg, key: "quizz:questionType.open" },
  { type: "image_sequence", icon: Film, key: "quizz:questionType.image_sequence" },
  { type: "date", img: dateImg, key: "quizz:questionType.date" },
  { type: "slider", img: sliderImg, key: "quizz:questionType.slider" },
  { type: "puzzle", img: puzzleImg, key: "quizz:questionType.puzzle" },
  { type: "drop_pin", img: dropPinImg, key: "quizz:questionType.drop_pin" },
]

const QuestionEditorTypeSelector = () => {
  const { currentQuestion, currentIndex, changeQuestionType } = useQuizzEditor()
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1.5">
      {TYPES.map(({ type, icon: Icon, img, key }) => (
        <button
          key={type}
          type="button"
          onClick={() => changeQuestionType(currentIndex, type)}
          className={clsx(
            "focus-ring ease-out-soft flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-all duration-150 active:scale-[0.99]",
            currentQuestion.type === type
              ? "bg-primary text-secondary shadow-[0_2px_12px_rgba(255,153,0,0.3)]"
              : "border-border bg-surface text-ink-muted hover:bg-panel hover:text-ink border",
          )}
        >
          <div
            className={clsx(
              "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg",
              currentQuestion.type === type ? "bg-black/10" : "bg-panel",
            )}
          >
            {img ? (
              <img
                src={img}
                alt={type}
                className="h-full w-full object-contain"
              />
            ) : (
              <Icon className="size-5" />
            )}
          </div>
          <span className="truncate">{t(key)}</span>
        </button>
      ))}
    </div>
  )
}

export default QuestionEditorTypeSelector
