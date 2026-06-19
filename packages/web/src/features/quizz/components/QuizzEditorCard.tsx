import type { QuestionType, SlideElement } from "@rahoot/common/types/game"
import dateImg from "@rahoot/web/assets/game/types/date.png"
import dropPinImg from "@rahoot/web/assets/game/types/drop_pin.png"
import mcqImg from "@rahoot/web/assets/game/types/mcq.png"
import openImg from "@rahoot/web/assets/game/types/open.png"
import puzzleImg from "@rahoot/web/assets/game/types/puzzle.png"
import sliderImg from "@rahoot/web/assets/game/types/slider.png"
import trueFalseImg from "@rahoot/web/assets/game/types/true_false.png"
import AlertDialog from "@rahoot/web/components/AlertDialog"
import { type QuestionWithId } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { ANSWERS_COLORS } from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import { Presentation, Trash2, Copy } from "lucide-react"
import { type CSSProperties, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"

const TYPE_ASSETS = new Map<QuestionType, any>([
  ["title", Presentation],
  ["mcq", mcqImg],
  ["true_false", trueFalseImg],
  ["open", openImg],
  ["date", dateImg],
  ["slider", sliderImg],
  ["puzzle", puzzleImg],
  ["drop_pin", dropPinImg],
])

const SlideElementPreview = ({ el }: { el: SlideElement }) => {
  const style: CSSProperties = {
    position: "absolute",
    left: `${(el.x / 1920) * 100}%`,
    top: `${(el.y / 1080) * 100}%`,
    width: `${(el.width / 1920) * 100}%`,
    height: `${(el.height / 1080) * 100}%`,
    opacity: el.opacity,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: "top left",
    overflow: "hidden",
  }

  if (el.type === "text") {
    let justifyContent: CSSProperties["justifyContent"] = "flex-start"

    if (el.align === "center") {
      justifyContent = "center"
    } else if (el.align === "right") {
      justifyContent = "flex-end"
    }

    return (
      <div
        style={{
          ...style,
          color: el.fill,
          display: "flex",
          alignItems: "center",
          justifyContent,
        }}
      >
        <span
          style={{
            fontSize: `${(el.fontSize / 1080) * 100}cqh`,
            fontFamily: el.fontFamily,
            lineHeight: 1.2,
            wordBreak: "break-word",
          }}
        >
          {el.text}
        </span>
      </div>
    )
  }

  if (el.type === "shape" && el.shapeType === "rect") {
    return (
      <div
        style={{
          ...style,
          backgroundColor: el.fill,
          borderRadius: el.cornerRadius
            ? `${(el.cornerRadius / 1920) * 100}%`
            : undefined,
        }}
      />
    )
  }

  if (el.type === "image") {
    return <img src={el.url} style={{ ...style, objectFit: "cover" }} alt="" />
  }

  if (el.type === "youtube") {
    return (
      <div
        style={{
          ...style,
          backgroundColor: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={`https://img.youtube.com/vi/${el.videoId}/mqdefault.jpg`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          alt=""
        />
      </div>
    )
  }

  return null
}

const SlideThumbnail = ({ question }: { question: QuestionWithId }) => {
  const bg = question.background
  const hasBg = bg && bg.value
  const bgOpacity = question.backgroundOpacity ?? 1

  return (
    <div
      className="relative w-full overflow-hidden rounded-md bg-black"
      style={{ aspectRatio: "16/9", containerType: "size" }}
    >
      {hasBg ? (
        <>
          <div className="absolute inset-0 bg-black" />
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundColor: bg.type === "color" ? bg.value : undefined,
              backgroundImage:
                bg.type === "image" ? `url(${bg.value})` : undefined,
              opacity: bgOpacity,
            }}
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[#0f172a]" />
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(/bg-salon.png)`,
              opacity: 0.5,
            }}
          />
        </>
      )}

      {question.elements?.map((el) => (
        <SlideElementPreview key={el.id} el={el} />
      ))}

      {question.question && question.type !== "title" && (
        <div className="absolute inset-x-0 top-[5%] flex items-center justify-center px-[3%]">
          <span
            className="rounded bg-white/80 px-1 text-center leading-tight font-semibold text-gray-800"
            style={{
              fontSize: "clamp(5px, 1.8cqw, 11px)",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {question.question}
          </span>
        </div>
      )}

      {question.type === "mcq" && (
        <div className="absolute inset-x-[3%] bottom-[5%] grid grid-cols-2 gap-[1%]">
          {question.answers.map((_, i) => (
            <div
              key={i}
              className={clsx("rounded-sm opacity-80", ANSWERS_COLORS[i])}
              style={{ height: "clamp(4px, 1.8cqh, 10px)" }}
            />
          ))}
        </div>
      )}

      {question.type === "true_false" && (
        <div className="absolute inset-x-[3%] bottom-[5%] grid grid-cols-2 gap-[1%]">
          <div
            className="rounded-sm bg-red-400 opacity-80"
            style={{ height: "clamp(4px, 1.8cqh, 10px)" }}
          />
          <div
            className="rounded-sm bg-green-400 opacity-80"
            style={{ height: "clamp(4px, 1.8cqh, 10px)" }}
          />
        </div>
      )}
    </div>
  )
}

type Props = {
  question: QuestionWithId
  index: number
  isActive: boolean
  canDelete: boolean
  onClick: () => void
  onDelete: () => void
  onDuplicate: () => void
  onContextMenu?: (_e: MouseEvent) => void
}

const QuizzEditorCard = ({
  question,
  index,
  isActive,
  canDelete,
  onClick,
  onDelete,
  onDuplicate,
  onContextMenu,
}: Props) => {
  const { t } = useTranslation()
  const Asset = TYPE_ASSETS.get(question.type)
  const isImage = typeof Asset === "string"

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group flex cursor-pointer items-center gap-2.5"
    >
      <span
        className={clsx(
          "w-4 shrink-0 text-center text-xs font-bold tabular-nums transition-colors",
          isActive ? "text-primary-ink" : "text-ink-subtle group-hover:text-ink-muted",
        )}
      >
        {index + 1}
      </span>

      <div
        className={twMerge(
          clsx(
            "ease-out-soft relative flex-1 overflow-hidden rounded-lg ring-1 transition-all duration-150",
            isActive
              ? "ring-primary shadow-[0_2px_14px_rgba(255,153,0,0.28)] ring-2"
              : "ring-border group-hover:ring-border-strong",
          ),
        )}
      >
        <div
          className="absolute top-1 left-1 z-10 flex h-4 w-4 items-center justify-center rounded bg-black/45 p-0.5 text-white backdrop-blur-sm"
          title={t(`quizz:questionType.${question.type}`)}
        >
          {isImage ? (
            <img src={Asset} alt="" className="h-full w-full object-contain" />
          ) : (
            <Asset className="size-2.5" />
          )}
        </div>

        <SlideThumbnail question={question} />

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
