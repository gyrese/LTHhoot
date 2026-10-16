import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import useTestDrive from "@rahoot/web/features/quizz/hooks/useTestDrive"
import PreviewPresenterView from "./PreviewPresenterView"
import PreviewParticipantView from "./PreviewParticipantView"
import type { PreviewPhase } from "./PreviewCorrection"
import Button from "@rahoot/web/components/Button"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize,
  Minimize,
  Play,
  X,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import slideBg from "@rahoot/web/assets/slide-bg.png"

type Props = {
  onClose: () => void
}

// Aperçu façon Kahoot : vue présentateur + vue participants côte à côte,
// navigation entre toutes les questions du quiz, lancement de la démo.
const SlidePreviewModal = ({ onClose }: Props) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const {
    questions,
    currentIndex,
    salonImage,
    validationIssues,
    setShowValidation,
  } = useQuizzEditor()
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(currentIndex, questions.length - 1)),
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mobileView, setMobileView] = useState<
    "presenter" | "participant" | "both"
  >("presenter")
  const [phase, setPhase] = useState<PreviewPhase>("question")
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const { startTestDrive, isTestDriving } = useTestDrive()

  const total = questions.length
  const question = questions[index]
  const selectQuestion = (next: number) => {
    setIndex(next)
    setPhase("question")
  }
  const launchTest = (startIndex: number) => {
    if (validationIssues?.length) {
      onClose()
      setShowValidation(true)
      return
    }
    void startTestDrive(startIndex)
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement)?.matches?.(
        "input, textarea, select, [contenteditable=true]",
      )
      if (e.key === "Escape") {
        onClose()
      } else if (!inField && e.key === "ArrowLeft") {
        e.preventDefault()
        setPhase("question")
        setIndex((i) => Math.max(0, i - 1))
      } else if (!inField && e.key === "ArrowRight") {
        e.preventDefault()
        setPhase("question")
        setIndex((i) => Math.min(total - 1, i + 1))
      } else if (e.key === "Tab") {
        const focusable = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), select:not(:disabled), input, textarea, [href], [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        )
        if (focusable.length === 0) {
          return
        }
        const [first] = focusable
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, total])

  useEffect(() => {
    const onFsChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFsChange)

    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void rootRef.current?.requestFullscreen()
    }
  }

  if (!question) {
    return null
  }

  const navButtonClass =
    "flex size-9 cursor-pointer items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15 disabled:cursor-default disabled:opacity-30"

  // Portal vers <body> : le modal est monté dans un conteneur `relative z-30`
  // (toolbar), son z-index serait sinon piégé sous l'header de l'éditeur.
  return createPortal(
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("quizz:previewFlow.open")}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className="fixed inset-0 z-9999 flex flex-col bg-black text-white"
    >
      {/* Fond flouté façon Kahoot */}
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
        style={{ backgroundImage: `url(${salonImage || slideBg})` }}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">
            {t("quizz:previewFlow.open")}
          </p>
          <h2 className="truncate text-base font-bold sm:text-xl">
            {question.question?.trim() ||
              t(
                `quizz:questionType.${question.type === "title" ? "title_slide" : question.type}`,
              )}
          </h2>
          <p className="text-xs text-white/60">
            {t(
              `quizz:questionType.${question.type === "title" ? "title_slide" : question.type}`,
            )}{" "}
            · {index + 1}/{total}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("common:close")}
          className="focus-ring flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative z-10 flex shrink-0 flex-wrap justify-center gap-3 px-4 pb-2">
        <label className="flex items-center gap-2 text-sm">
          {t("quizz:previewFlow.view")}
          <select
            aria-label={t("quizz:previewFlow.view")}
            value={mobileView}
            onChange={(event) =>
              setMobileView(event.target.value as typeof mobileView)
            }
            className="focus-ring rounded-md bg-white px-3 py-2 text-black"
          >
            <option value="presenter">{t("quizz:previewPresenter")}</option>
            <option value="participant">
              {t("quizz:previewParticipants")}
            </option>
            <option value="both">{t("quizz:previewFlow.both")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t("quizz:previewFlow.phase")}
          <select
            aria-label={t("quizz:previewFlow.phase")}
            value={phase}
            disabled={question.type === "title"}
            onChange={(event) => setPhase(event.target.value as PreviewPhase)}
            className="focus-ring rounded-md bg-white px-3 py-2 text-black disabled:opacity-50"
          >
            <option value="question">{t("quizz:previewFlow.question")}</option>
            <option value="answers">{t("quizz:previewFlow.answers")}</option>
            <option value="correction">
              {t("quizz:previewFlow.correction")}
            </option>
          </select>
        </label>
      </div>

      {/* Zone centrale : présentateur + participants */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 py-2">
        <div className="flex w-full max-w-6xl flex-col items-center justify-center gap-6 lg:flex-row lg:items-start">
          {mobileView !== "participant" && (
            <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-white/90 drop-shadow">
                {t("quizz:previewPresenter", "Affichage du présentateur")}
              </span>
              <div className="mx-auto w-full max-w-[min(100%,calc((100dvh-260px)*16/9))]">
                <PreviewPresenterView
                  key={`${question.id}-${phase}`}
                  question={question}
                  phase={phase}
                  hideYoutube={false}
                />
              </div>
            </div>
          )}

          {mobileView !== "presenter" && (
            <div className="flex w-64 max-w-full shrink-0 flex-col gap-2">
              <span className="text-sm font-semibold text-white/90 drop-shadow">
                {t("quizz:previewParticipants", "Affichage des participants")}
              </span>
              <PreviewParticipantView
                key={`${question.id}-${phase}`}
                question={question}
                phase={phase}
              />
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 shrink-0 border-y border-white/15 bg-black/35 px-4 py-2 sm:px-6">
        <p className="mb-2 text-xs font-semibold text-white/70">
          {t("quizz:previewAllQuestions", "Toutes les questions")}
        </p>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label={t("quizz:previewAllQuestions", "Toutes les questions")}
        >
          {questions.map((item, questionIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectQuestion(questionIndex)}
              aria-current={questionIndex === index ? "step" : undefined}
              aria-label={t("quizz:sidebar.openQuestion", {
                number: questionIndex + 1,
                title:
                  item.question?.trim() ||
                  t(
                    `quizz:questionType.${item.type === "title" ? "title_slide" : item.type}`,
                  ),
              })}
              className={`focus-ring flex w-44 shrink-0 items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs ${questionIndex === index ? "border-white bg-white text-black" : "border-white/20 bg-white/10 text-white hover:bg-white/20"}`}
            >
              <span className="font-bold tabular-nums">
                {questionIndex + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {item.question?.trim() ||
                    t(
                      `quizz:questionType.${item.type === "title" ? "title_slide" : item.type}`,
                    )}
                </span>
                <span className="block truncate opacity-60">
                  {t(
                    `quizz:questionType.${item.type === "title" ? "title_slide" : item.type}`,
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Barre basse : quitter / navigation / démonstration */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 px-4 py-3 sm:justify-between">
        <span className="hidden text-xs text-white/60 sm:block">
          {t(
            "quizz:previewKeyboardHint",
            "← → pour naviguer · Échap pour fermer",
          )}
        </span>

        <div className="flex items-center gap-0.5 rounded-xl bg-black/60 px-1.5 py-1 backdrop-blur-md">
          <button
            type="button"
            className={navButtonClass}
            disabled={index === 0}
            onClick={() => selectQuestion(0)}
            title={t("quizz:previewFirstQuestion", "Première question")}
          >
            <ChevronsLeft className="size-5" />
          </button>
          <button
            type="button"
            className={navButtonClass}
            disabled={index === 0}
            onClick={() => selectQuestion(Math.max(0, index - 1))}
            title={t("quizz:previewPrevQuestion", "Question précédente")}
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-14 px-1 text-center text-sm font-bold tabular-nums">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            className={navButtonClass}
            disabled={index === total - 1}
            onClick={() => selectQuestion(Math.min(total - 1, index + 1))}
            title={t("quizz:previewNextQuestion", "Question suivante")}
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            className={navButtonClass}
            disabled={index === total - 1}
            onClick={() => selectQuestion(total - 1)}
            title={t("quizz:previewLastQuestion", "Dernière question")}
          >
            <ChevronsRight className="size-5" />
          </button>
          <div className="mx-1 h-5 w-px bg-white/20" />
          <button
            type="button"
            className={navButtonClass}
            onClick={toggleFullscreen}
            title={t("quizz:previewFullscreen", "Plein écran")}
          >
            {isFullscreen ? (
              <Minimize className="size-5" />
            ) : (
              <Maximize className="size-5" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            className="gap-2"
            disabled={isTestDriving}
            onClick={() => launchTest(index)}
          >
            <Play className="size-4" />
            {t("quizz:previewFlow.testCurrent")}
          </Button>
          <Button
            variant="secondary"
            disabled={isTestDriving}
            onClick={() => launchTest(0)}
          >
            {t("quizz:previewFlow.testAll")}
          </Button>
        </div>
      </div>
      <p className="relative z-10 px-4 pb-2 text-center text-xs text-white/80">
        {t("quizz:previewFlow.hint")}
      </p>
    </motion.div>,
    document.body,
  )
}

export default SlidePreviewModal
