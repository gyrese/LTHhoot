import type { QuestionType } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ListChecks,
  MapPin,
  Presentation,
  Shuffle,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

const TYPES: { type: QuestionType; icon: LucideIcon; key: string }[] = [
  { type: "title", icon: Presentation, key: "quizz:questionType.title_slide" },
  { type: "mcq", icon: ListChecks, key: "quizz:questionType.mcq" },
  { type: "true_false", icon: CheckSquare, key: "quizz:questionType.true_false" },
  { type: "open", icon: AlignLeft, key: "quizz:questionType.open" },
  { type: "date", icon: Calendar, key: "quizz:questionType.date" },
  { type: "slider", icon: SlidersHorizontal, key: "quizz:questionType.slider" },
  { type: "puzzle", icon: Shuffle, key: "quizz:questionType.puzzle" },
  { type: "drop_pin", icon: MapPin, key: "quizz:questionType.drop_pin" },
]

const QuestionEditorTypeSelector = () => {
  const { currentQuestion, currentIndex, changeQuestionType } = useQuizzEditor()
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1.5">
      {TYPES.map(({ type, icon: Icon, key }) => (
        <button
          key={type}
          type="button"
          onClick={() => changeQuestionType(currentIndex, type)}
          className={clsx(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
            currentQuestion.type === type
              ? "bg-yellow-500 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200",
          )}
        >
          <Icon className="size-4" />
          {t(key)}
        </button>
      ))}
    </div>
  )
}

export default QuestionEditorTypeSelector
