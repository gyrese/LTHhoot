import type { QuizzMeta } from "@rahoot/common/types/game"
import {
  Check,
  Clock3,
  FolderOpen,
  Layers,
  Loader2,
  Star,
  Pencil,
} from "lucide-react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"
import { motion } from "motion/react"
import {
  formatEstimatedDuration,
  formatQuizzStats,
} from "../../utils/quizzStats"
import QuizActionsMenu, { type QuizMenuAction } from "./QuizActionsMenu"
import useCardMotion from "./useCardMotion"
import useCardTilt from "./useCardTilt"
import useImageEdgeColors from "./useImageEdgeColors"

type Props = {
  quiz: QuizzMeta
  selected: boolean
  order?: number
  favorite: boolean
  readonly: boolean
  deleting: boolean
  list: boolean
  selectingMany: boolean
  selectDisabled?: boolean
  onSelect: () => void
  onEdit: () => void
  onFavorite: () => void
  actions: QuizMenuAction[]
}

export default function LibraryQuizCard({
  quiz,
  selected,
  order,
  favorite,
  readonly,
  deleting,
  list,
  selectingMany,
  selectDisabled,
  onSelect,
  onEdit,
  onFavorite,
  actions,
}: Props) {
  const { t, i18n } = useTranslation()
  const root = useRef<HTMLElement>(null)
  useCardMotion(root, selected)
  useImageEdgeColors(root, list ? undefined : quiz.listingImage)
  const tilt = useCardTilt(!list && !deleting)

  const folderName =
    quiz.folder?.split("/").at(-1) || t("manager:library.unfiled")
  return (
    <article
      ref={root}
      data-library-id={quiz.id}
      data-card-layout={list ? "list" : "grid"}
      draggable={!readonly && !deleting}
      onDragStart={(event) => {
        tilt.onDragStart()
        event.dataTransfer.setData("quizzId", quiz.id)
        event.dataTransfer.effectAllowed = "move"
      }}
      className={clsx(
        "dashboard-quiz group relative isolate min-w-0 text-white",
        list
          ? "dashboard-quiz-list flex min-h-28 items-center"
          : "aspect-[3/4]",
        deleting && "pointer-events-none opacity-50",
      )}
    >
      <motion.div
        {...tilt}
        data-card-surface
        className={clsx(
          "dashboard-jacket relative size-full rounded-[22px]",
          list && "flex min-h-28 items-center",
        )}
      >
        <div
          className={clsx(
            "dashboard-card-art pointer-events-none absolute overflow-hidden",
            list ? "inset-y-0 left-0 w-24 sm:w-32" : "inset-1 rounded-[18px]",
            selected &&
              "ring-2 ring-orange-300 ring-offset-2 ring-offset-orange-500/20",
          )}
        >
          {quiz.listingImage ? (
            <img
              data-cover
              src={quiz.listingImage}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div
              data-cover
              className={clsx(
                "dashboard-cover-fallback absolute inset-0 flex items-center justify-center",
                !list && "pb-20",
              )}
            >
              <Layers className="size-24 text-white/35" strokeWidth={0.7} />
            </div>
          )}
          <div
            className={clsx(
              "absolute inset-0",
              list ? "bg-black/15" : "dashboard-card-shade",
            )}
          />
          {!list && (
            <div
              aria-hidden="true"
              className="dashboard-jacket-light pointer-events-none absolute inset-0 rounded-[inherit]"
            />
          )}
          {!list && (
            <div
              aria-hidden="true"
              className="dashboard-spotlight-outline absolute inset-0 rounded-[inherit]"
            >
              <div className="dashboard-spotlight-colors absolute inset-0" />
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={deleting || selectDisabled}
          aria-pressed={selected}
          aria-label={quiz.subject}
          onClick={onSelect}
          className="absolute inset-0 cursor-pointer rounded-[22px] focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-default"
        />
        <span
          data-selection
          aria-hidden="true"
          className={clsx(
            "dashboard-card-selection pointer-events-none absolute top-3 left-3 flex size-7 items-center justify-center rounded-full border text-xs font-bold",
            selected
              ? "border-orange-300 bg-orange-500 text-white"
              : "border-white/50 bg-black/30 text-white/80 backdrop-blur-md",
            !selected &&
              !selectingMany &&
              "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          {selected && (order || <Check className="size-4" />)}
        </span>
        <div
          className={clsx(
            "dashboard-card-tools absolute top-3 right-3 flex items-center gap-0.5 rounded-full border border-white/20 bg-black/25 p-0.5 backdrop-blur-md",
            favorite && "dashboard-card-tools-favorite",
          )}
        >
          <button
            type="button"
            onClick={onFavorite}
            aria-pressed={favorite}
            aria-label={t(
              favorite
                ? "manager:library.unfavorite"
                : "manager:library.favorite",
              { name: quiz.subject },
            )}
            title={t(
              favorite
                ? "manager:library.unfavorite"
                : "manager:library.favorite",
              { name: quiz.subject },
            )}
            className={clsx(
              "dashboard-icon size-8",
              favorite ? "text-amber-200" : "text-white/90",
            )}
          >
            <Star
              className="size-4"
              fill={favorite ? "currentColor" : "none"}
            />
          </button>
          <QuizActionsMenu
            label={t("manager:library.actions", { name: quiz.subject })}
            actions={actions}
          />
        </div>
        <div
          data-glass
          data-card-content
          className={clsx(
            "pointer-events-none min-w-0",
            list
              ? "relative ml-24 flex-1 px-4 py-3 pr-24 sm:ml-32"
              : "dashboard-jacket-caption absolute right-1 bottom-1 left-1 px-3 pt-4 pb-2.5",
          )}
          title={quiz.folder || undefined}
        >
          {list && (
            <p
              className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium text-white/70"
              title={quiz.folder || folderName}
            >
              <FolderOpen className="size-3 shrink-0" />
              <span className="truncate">{folderName}</span>
            </p>
          )}
          <h3
            className={clsx(
              "line-clamp-2 font-bold text-white",
              list
                ? "text-base leading-snug"
                : "dashboard-jacket-title pr-8 text-[13px] leading-[17px] tracking-[-0.02em]",
            )}
            title={quiz.subject}
          >
            {quiz.subject}
          </h3>
          <div
            className={clsx(
              "flex items-center justify-between gap-1.5",
              list ? "mt-2 min-h-7" : "mt-1 min-h-4 pr-8",
            )}
          >
            <p
              className={clsx(
                "flex min-w-0 items-center gap-1 truncate text-[10px] font-medium text-white/85",
              )}
              title={formatQuizzStats(t, quiz)}
            >
              <span className="truncate">
                {t("manager:quizz.questionCount", {
                  count: quiz.questionCount,
                })}
              </span>
              {Boolean(quiz.estimatedDurationSec) && (
                <>
                  <span aria-hidden="true" className="mx-0.5 text-white/35">
                    /
                  </span>
                  <Clock3 aria-hidden="true" className="size-2.5 shrink-0" />
                  <span className="shrink-0">
                    {formatEstimatedDuration(t, quiz.estimatedDurationSec!)}
                  </span>
                </>
              )}
            </p>
            {!readonly && !selectingMany && (
              <button
                type="button"
                data-card-action
                onClick={onEdit}
                aria-label={t("manager:actions.editNamed", {
                  name: quiz.subject,
                })}
                title={t("manager:actions.edit")}
                className={clsx(
                  "dashboard-icon dashboard-edit-button pointer-events-auto rounded-xl text-white",
                  list
                    ? "-my-1 -mr-1 size-7"
                    : "absolute top-1/2 right-2 size-8 -translate-y-1/2",
                )}
              >
                <span
                  aria-hidden="true"
                  className="dashboard-edit-face absolute inset-0 flex items-center justify-center rounded-[inherit]"
                >
                  <Pencil className="size-4" />
                </span>
              </button>
            )}
          </div>
          {list && quiz.archivedAt && (
            <p className="mt-1.5 truncate text-[11px] text-amber-100/80">
              {new Date(quiz.archivedAt).toLocaleDateString(i18n.language, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        {deleting && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="size-6 motion-safe:animate-spin" />
          </div>
        )}
      </motion.div>
    </article>
  )
}
