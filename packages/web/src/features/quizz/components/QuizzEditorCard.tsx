import type { QuestionType } from "@rahoot/common/types/game"
import dateImg from "@rahoot/web/assets/game/types/date.png"
import dropPinImg from "@rahoot/web/assets/game/types/drop_pin.png"
import gridImg from "@rahoot/web/assets/game/types/grid.png"
import imageSequenceImg from "@rahoot/web/assets/game/types/image_sequence.png"
import mcqImg from "@rahoot/web/assets/game/types/mcq.png"
import openImg from "@rahoot/web/assets/game/types/open.png"
import puzzleImg from "@rahoot/web/assets/game/types/puzzle.png"
import sliderImg from "@rahoot/web/assets/game/types/slider.png"
import trueFalseImg from "@rahoot/web/assets/game/types/true_false.png"
import {
  type QuestionWithId,
  useQuizzEditor,
} from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import LazySlidePreview from "@rahoot/web/features/quizz/components/LazySlidePreview"
import clsx from "clsx"
import {
  AlertTriangle,
  Copy,
  MoreHorizontal,
  Presentation,
  Trash2,
} from "lucide-react"
import type { KeyboardEvent, MouseEvent, Ref } from "react"
import { useTranslation } from "react-i18next"

const TYPE_ASSETS = new Map<QuestionType, typeof Presentation | string>([
  ["title", Presentation],
  ["mcq", mcqImg],
  ["true_false", trueFalseImg],
  ["open", openImg],
  ["date", dateImg],
  ["slider", sliderImg],
  ["puzzle", puzzleImg],
  ["drop_pin", dropPinImg],
  ["image_sequence", imageSequenceImg],
  ["grid", gridImg],
])

type Props = {
  question: QuestionWithId
  index: number
  isActive: boolean
  isSelected?: boolean
  canDelete: boolean
  showSelection?: boolean
  menuOpen?: boolean
  onClick: (_event: MouseEvent<HTMLButtonElement>) => void
  onKeyDown?: (_event: KeyboardEvent<HTMLButtonElement>) => void
  buttonRef?: Ref<HTMLButtonElement>
  onDelete: () => void
  onDuplicate: () => void
  onToggleSelection?: () => void
  onMore: (_event: MouseEvent<HTMLButtonElement>) => void
  onContextMenu?: (_event: MouseEvent<HTMLDivElement>) => void
}

const actionClass =
  "focus-ring text-ink-muted hover:bg-surface hover:text-ink flex size-8 shrink-0 items-center justify-center rounded-md transition-colors"

const QuizzEditorCard = ({
  question,
  index,
  isActive,
  isSelected,
  canDelete,
  showSelection = false,
  menuOpen = false,
  onClick,
  onKeyDown,
  buttonRef,
  onDelete,
  onDuplicate,
  onToggleSelection,
  onMore,
  onContextMenu,
}: Props) => {
  const { t } = useTranslation()
  const asset = TYPE_ASSETS.get(question.type)
  const { validationIssues, setShowValidation, setCurrentIndex } =
    useQuizzEditor()
  const validationErrors = validationIssues.filter(
    (issue) => issue.questionIndex === index,
  )
  const typeLabel = t(
    `quizz:questionType.${question.type === "title" ? "title_slide" : question.type}`,
  )
  const title = question.question?.trim() || typeLabel
  const Icon = typeof asset === "string" ? null : asset
  let status = ""
  if (isActive) {
    status = t("quizz:sidebar.current")
  } else if (isSelected) {
    status = t("quizz:sidebar.selected")
  }

  return (
    <div className="min-w-0 flex-1" onContextMenu={onContextMenu}>
      <div
        className={clsx(
          "border-border bg-surface focus-within:ring-primary min-w-0 flex-1 overflow-hidden rounded-lg border transition-colors focus-within:ring-2",
          isActive && "border-primary ring-primary ring-2",
          !isActive && isSelected && "border-primary/70 ring-primary/40 ring-2",
        )}
      >
        <button
          ref={buttonRef}
          type="button"
          onClick={onClick}
          onKeyDown={onKeyDown}
          aria-current={isActive ? "step" : undefined}
          aria-label={t("quizz:sidebar.openQuestion", {
            number: index + 1,
            title,
          })}
          className="focus-ring group block w-full text-left"
        >
          <div className="relative">
            <LazySlidePreview question={question} />
            <span
              className="absolute top-1 left-1 flex size-5 items-center justify-center rounded bg-black/60 text-white"
              aria-hidden="true"
            >
              {typeof asset === "string" && (
                <img src={asset} alt="" className="size-4 object-contain" />
              )}
              {Icon && <Icon className="size-3.5" />}
            </span>
          </div>
        </button>
        <div className="border-border/70 bg-panel flex min-h-9 items-center gap-0.5 border-t px-1.5">
          {showSelection && (
            <input
              type="checkbox"
              checked={Boolean(isSelected)}
              onChange={onToggleSelection}
              aria-label={t("quizz:sidebar.selectQuestion", {
                number: index + 1,
              })}
              className="accent-primary focus-ring ml-1 size-4 shrink-0 cursor-pointer"
            />
          )}
          <span
            className="text-ink-muted min-w-0 flex-1 truncate pl-1 text-[11px] font-medium"
            title={status ? `${typeLabel} · ${status}` : typeLabel}
          >
            {typeLabel}
            {status && ` · ${status}`}
          </span>
          {validationErrors.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCurrentIndex(index)
                setShowValidation(true)
              }}
              className="focus-ring flex min-h-8 items-center gap-1 rounded px-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/10"
              aria-label={t("quizz:sidebar.issues", {
                number: index + 1,
                count: validationErrors.length,
              })}
              title={validationErrors
                .map((error) => t(error.message, error.message))
                .join("\n")}
            >
              <AlertTriangle className="size-3.5" />
              {validationErrors.length}
            </button>
          )}
          <button
            type="button"
            onClick={onDuplicate}
            className={actionClass}
            aria-label={t("quizz:question.duplicateQuestion")}
            title={t("quizz:question.duplicateQuestion")}
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onMore}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={actionClass}
            aria-label={t("quizz:sidebar.actions", { number: index + 1 })}
            title={t("quizz:sidebar.actions", { number: index + 1 })}
          >
            <MoreHorizontal className="size-4" />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className={clsx(actionClass, "hover:text-danger")}
              aria-label={t("quizz:question.deleteQuestion")}
              title={t("quizz:question.deleteQuestion")}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default QuizzEditorCard
