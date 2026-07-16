import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import useTestDrive from "@rahoot/web/features/quizz/hooks/useTestDrive"
import PreviewPresenterView from "./PreviewPresenterView"
import PreviewParticipantView from "./PreviewParticipantView"
import Button from "@rahoot/web/components/Button"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize,
  Minimize,
  Play,
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
  const { questions, currentIndex, quizzId, salonImage } = useQuizzEditor()
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(currentIndex, questions.length - 1)),
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { startTestDrive, isTestDriving } = useTestDrive()

  const total = questions.length
  const question = questions[index]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(total - 1, i + 1))
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

      {/* Zone centrale : présentateur + participants */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
        <div className="flex w-full items-start justify-center gap-6 px-6 lg:gap-10 lg:px-10">
          <div className="flex min-w-0 flex-1 basis-2/3 flex-col gap-2">
            <span className="text-sm font-semibold text-white/90 drop-shadow">
              {t("quizz:previewPresenter", "Affichage du présentateur")}
            </span>
            <div className="w-full max-w-[min(100%,calc((100dvh-200px)*16/9))]">
              <PreviewPresenterView question={question} />
            </div>
          </div>

          <div className="flex w-52 shrink-0 flex-col gap-2 xl:w-64">
            <span className="text-sm font-semibold text-white/90 drop-shadow">
              {t("quizz:previewParticipants", "Affichage des participants")}
            </span>
            <PreviewParticipantView question={question} />
          </div>
        </div>
      </div>

      {/* Barre basse : quitter / navigation / démonstration */}
      <div className="relative z-10 grid grid-cols-3 items-center gap-4 px-4 pb-4">
        <div className="justify-self-start">
          <Button variant="ghost" className="gap-2 text-white" onClick={onClose}>
            <ArrowLeft className="size-4" />
            {t("common:exit", "Quitter")}
          </Button>
        </div>

        <div className="flex items-center gap-0.5 justify-self-center rounded-xl bg-black/60 px-1.5 py-1 backdrop-blur-md">
          <button
            type="button"
            className={navButtonClass}
            disabled={index === 0}
            onClick={() => setIndex(0)}
            title={t("quizz:previewFirstQuestion", "Première question")}
          >
            <ChevronsLeft className="size-5" />
          </button>
          <button
            type="button"
            className={navButtonClass}
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
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
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            title={t("quizz:previewNextQuestion", "Question suivante")}
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            className={navButtonClass}
            disabled={index === total - 1}
            onClick={() => setIndex(total - 1)}
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

        <div className="justify-self-end">
          <Button
            variant="primary"
            className="gap-2"
            disabled={!quizzId || isTestDriving}
            onClick={() => startTestDrive(index)}
            title={
              !quizzId
                ? t(
                    "quizz:testDriveNeedsSave",
                    "Sauvegardez le quiz avant de le tester",
                  )
                : undefined
            }
          >
            <Play className="size-4" />
            {t("quizz:launchDemo", "Lancer la démonstration")}
          </Button>
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}

export default SlidePreviewModal
