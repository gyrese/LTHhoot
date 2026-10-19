import type { QuizzMeta } from "@rahoot/common/types/game"
import { ArrowUpRight, FolderOpen, Layers } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useRef, useState, type DragEvent } from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"
import "./library-folder.css"

export type LibraryFolderCardProps = {
  path: string
  quizzes: QuizzMeta[]
  list: boolean
  onOpen: () => void
  onDropQuiz: (_id: string) => void
  /** An empty id checks general permission while drag data is protected. */
  canDropQuiz: (_id: string) => boolean
}

export default function LibraryFolderCard({
  path,
  quizzes,
  list,
  onOpen,
  onDropQuiz,
  canDropQuiz,
}: LibraryFolderCardProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [dropping, setDropping] = useState(false)
  const ignoreMouseUntil = useRef(0)
  const active = !reducedMotion && (hovered || dropping)
  const title = path.split("/").filter(Boolean).at(-1) || path
  const countLabel = t("manager:library.count", { count: quizzes.length })
  const covers = quizzes.slice(0, 3)
  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: active ? 0.26 : 0.18, ease: [0.22, 1, 0.36, 1] as const }

  const acceptDrag = (event: DragEvent<HTMLButtonElement>) => {
    const types = Array.from(event.dataTransfer.types, (type) =>
      type.toLowerCase(),
    )
    if (!types.includes("quizzid") || !canDropQuiz("")) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDropping(true)
  }

  return (
    <button
      type="button"
      data-library-folder={path}
      data-library-id={`folder:${path}`}
      className={clsx(
        "library-folder group",
        list ? "library-folder--list" : "aspect-[3/4]",
        dropping && "library-folder--drop",
      )}
      aria-label={`${title}, ${countLabel}`}
      title={path}
      onClick={onOpen}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") {
          ignoreMouseUntil.current = performance.now() + 800
          return
        }
        if (performance.now() >= ignoreMouseUntil.current) {
          setHovered(true)
        }
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") {
          ignoreMouseUntil.current = performance.now() + 800
          setHovered(false)
        }
      }}
      onMouseEnter={() => {
        if (performance.now() >= ignoreMouseUntil.current) {
          setHovered(true)
        }
      }}
      onMouseLeave={() => setHovered(false)}
      onDragEnter={acceptDrag}
      onDragOver={acceptDrag}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropping(false)
        }
      }}
      onDrop={(event) => {
        setDropping(false)
        const id = event.dataTransfer.getData("quizzId")
        if (!id || !canDropQuiz(id)) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        onDropQuiz(id)
      }}
    >
      <span className="library-folder__object" aria-hidden="true">
        <span className="library-folder__shadow" />
        <span className="library-folder__back">
          <span className="library-folder__tab" />
        </span>
        <span className="library-folder__contents">
          {covers.map((quiz, index) => {
            const slot = index - (covers.length - 1) / 2
            return (
              <motion.span
                key={quiz.id}
                data-folder-cover={quiz.id}
                className="library-folder__cover"
                style={{ zIndex: index + 1 }}
                initial={false}
                animate={{
                  transform: `translateX(${slot * (active ? 12 : 7)}%) translateY(${active ? -16 - index * 2 : -index * 5}px) rotate(${slot * (active ? 10 : 5)}deg)`,
                }}
                transition={transition}
              >
                {quiz.listingImage ? (
                  <img
                    src={quiz.listingImage}
                    alt=""
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <span className="library-folder__cover-empty">
                    <Layers size={22} strokeWidth={1} />
                    <span>{quiz.subject}</span>
                  </span>
                )}
              </motion.span>
            )
          })}
          {covers.length === 0 && (
            <FolderOpen className="library-folder__empty" strokeWidth={1} />
          )}
        </span>
        <motion.span
          className="library-folder__front"
          initial={false}
          animate={{
            transform: `rotateX(${active ? -17 : 0}deg) scale(${dropping ? 1.025 : 1})`,
          }}
          transition={transition}
          style={{ transformOrigin: "50% 100%" }}
        >
          <span className="library-folder__glass" />
          <svg
            className="library-folder__rim"
            viewBox="0 0 340 198"
            preserveAspectRatio="none"
          >
            <path d="M1 22Q1 1 22 1H118C144 1 146 32 172 32H318Q339 32 339 54V176Q339 197 318 197H22Q1 197 1 176Z" />
          </svg>
          <span className="library-folder__reflection" />
        </motion.span>
      </span>
      <span className="library-folder__label">
        <span className="library-folder__title">{title}</span>
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={quizzes.length}
            className="library-folder__count"
            initial={{
              opacity: reducedMotion ? 1 : 0,
              y: reducedMotion ? 0 : 5,
            }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: reducedMotion ? 1 : 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
          >
            {countLabel}
          </motion.span>
        </AnimatePresence>
      </span>
      <ArrowUpRight
        className="library-folder__open"
        size={16}
        aria-hidden="true"
      />
    </button>
  )
}
