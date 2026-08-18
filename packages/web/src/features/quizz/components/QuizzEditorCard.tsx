import type { QuestionType } from "@rahoot/common/types/game"
import dateImg from "@rahoot/web/assets/game/types/date.png"
import dropPinImg from "@rahoot/web/assets/game/types/drop_pin.png"
import mcqImg from "@rahoot/web/assets/game/types/mcq.png"
import openImg from "@rahoot/web/assets/game/types/open.png"
import puzzleImg from "@rahoot/web/assets/game/types/puzzle.png"
import sliderImg from "@rahoot/web/assets/game/types/slider.png"
import trueFalseImg from "@rahoot/web/assets/game/types/true_false.png"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import { type QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import PreviewPresenterView from "@rahoot/web/features/quizz/components/SlideEditor/PreviewPresenterView"
import clsx from "clsx"
import {
  Presentation,
  Trash2,
  Copy,
  Film,
  LayoutGrid,
  AlertTriangle,
} from "lucide-react"
import { type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"
import { validateQuestion } from "@rahoot/web/features/quizz/utils/validation"

const TYPE_ASSETS = new Map<QuestionType, any>([
  ["title", Presentation],
  ["mcq", mcqImg],
  ["true_false", trueFalseImg],
  ["open", openImg],
  ["date", dateImg],
  ["slider", sliderImg],
  ["puzzle", puzzleImg],
  ["drop_pin", dropPinImg],
  ["image_sequence", Film],
  ["grid", LayoutGrid],
])

type Props = {
  question: QuestionWithId
  index: number
  isActive: boolean
  isSelected?: boolean
  canDelete: boolean
  onClick: (_e: MouseEvent) => void
  onDelete: () => void
  onDuplicate: () => void
  onContextMenu?: (_e: MouseEvent) => void
}

const QuizzEditorCard = ({
  question,
  index,
  isActive,
  isSelected,
  canDelete,
  onClick,
  onDelete,
  onDuplicate,
  onContextMenu,
}: Props) => {
  const { t } = useTranslation()
  const Asset = TYPE_ASSETS.get(question.type)
  const isImage = typeof Asset === "string"
  const validationErrors = validateQuestion(question)
  let borderClasses = "ring-border group-hover:ring-border-strong"

  if (isActive) {
    borderClasses =
      "ring-primary shadow-[0_2px_14px_rgba(255,153,0,0.28)] ring-2"
  } else if (isSelected) {
    borderClasses =
      "ring-primary/50 shadow-[0_1px_8px_rgba(255,153,0,0.15)] ring-2"
  }

  const numberColor =
    isActive || isSelected
      ? "text-primary-ink"
      : "text-ink-subtle group-hover:text-ink-muted"

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group flex cursor-pointer items-center gap-2.5"
    >
      <span
        className={clsx(
          "w-4 shrink-0 text-center text-xs font-bold tabular-nums transition-colors",
          numberColor,
        )}
      >
        {index + 1}
      </span>

      <div
        className={twMerge(
          clsx(
            "ease-out-soft relative flex-1 overflow-hidden rounded-lg ring-1 transition-all duration-150",
            borderClasses,
          ),
        )}
      >
        <div
          className="pointer-events-none absolute top-1 left-1 z-20 flex h-4 w-4 items-center justify-center rounded bg-black/45 p-0.5 text-white backdrop-blur-sm"
          title={t(`quizz:questionType.${question.type}`)}
        >
          {isImage ? (
            <img src={Asset} alt="" className="h-full w-full object-contain" />
          ) : (
            <Asset className="size-2.5" />
          )}
        </div>

        <PreviewPresenterView
          question={question}
          className="rounded-none shadow-none"
          hideYoutube
        />

        {validationErrors.length > 0 && (
          <div
            className="bg-danger absolute bottom-1 left-1 z-10 flex h-4.5 w-4.5 cursor-help items-center justify-center rounded text-white shadow-sm"
            title={validationErrors.join("\n")}
          >
            <AlertTriangle className="size-3 animate-pulse" />
          </div>
        )}

        {canDelete && (
          <div className="ease-out-soft absolute top-1 right-1 z-10 flex flex-col gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
              className="text-ink-muted hover:text-primary-ink rounded-md bg-white/85 p-1 shadow-sm backdrop-blur-sm transition-colors hover:bg-white active:scale-95"
              title={t("quizz:question.duplicateQuestion")}
            >
              <Copy className="size-3" />
            </button>

            <AlertDialog
              trigger={
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-ink-muted hover:text-danger rounded-md bg-white/85 p-1 shadow-sm backdrop-blur-sm transition-colors hover:bg-white active:scale-95"
                >
                  <Trash2 className="size-3" />
                </button>
              }
              title={t("quizz:question.deleteQuestion")}
              description={t("quizz:question.deleteQuestionConfirm")}
              confirmLabel={t("common:delete")}
              onConfirm={onDelete}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default QuizzEditorCard
