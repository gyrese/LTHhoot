import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Button from "@rahoot/web/components/Button"
import EditorDialog from "./EditorDialog"
import QuizzEditorSidebar from "./QuizzEditorSidebar"
import QuestionEditor from "./QuestionEditor"
import QuestionEditorConfig from "./QuestionEditor/QuestionEditorConfig"
import { useQuizzEditor } from "../contexts/quizz-editor-context"

export default function EditorWorkspace() {
  const {
    validationTarget,
    inspectorRequest,
    questions,
    currentIndex,
    selectSlide,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const [wide, setWide] = useState(
    () => window.matchMedia("(min-width: 1100px)").matches,
  )
  const [panel, setPanel] = useState<"slides" | "settings" | null>(null)
  useEffect(() => {
    if (inspectorRequest && !wide) {
      setPanel("settings")
    }
  }, [inspectorRequest, wide])
  useEffect(() => {
    if (!validationTarget || wide) {
      return
    }
    const [, , field] = validationTarget.path.split(".")
    setPanel(
      [
        "time",
        "cooldown",
        "elements",
        "backgroundOpacity",
        "revealDuration",
        "gridCols",
        "gridRows",
        "revelationStyle",
      ].includes(field)
        ? "settings"
        : null,
    )
  }, [validationTarget, wide])
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1100px)")
    const update = () => {
      setWide(media.matches)
      setPanel(null)
    }
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return (
    // Keep canvas overlays below the header and its toolbar popovers.
    <div className="relative isolate z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
      {!wide && (
        <div className="border-border bg-surface flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPanel("slides")}
          >
            {t("quizz:slidesTitle", "Diapositives")}
          </Button>
          <div className="order-last flex w-full shrink-0 items-center justify-center gap-1 sm:order-none sm:ml-auto sm:w-auto">
            <button
              type="button"
              onClick={() => selectSlide(currentIndex - 1, false, false)}
              disabled={currentIndex === 0}
              aria-label={t("quizz:sidebar.previous")}
              className="focus-ring text-ink-muted hover:bg-panel flex size-10 items-center justify-center rounded-md disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span
              className="text-ink-muted min-w-9 text-center text-xs font-semibold tabular-nums"
              aria-label={t("quizz:sidebar.position", {
                current: currentIndex + 1,
                total: questions.length,
              })}
            >
              {currentIndex + 1}/{questions.length}
            </span>
            <button
              type="button"
              onClick={() => selectSlide(currentIndex + 1, false, false)}
              disabled={currentIndex >= questions.length - 1}
              aria-label={t("quizz:sidebar.next")}
              className="focus-ring text-ink-muted hover:bg-panel flex size-10 items-center justify-center rounded-md disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPanel("settings")}
            className="ml-auto sm:ml-0"
          >
            {t("quizz:sidebar.settings", "Réglages")}
          </Button>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {wide && <QuizzEditorSidebar />}
        <QuestionEditor showInspector={wide} />
      </div>
      {!wide && panel && (
        <EditorDialog
          label={
            panel === "slides"
              ? t("quizz:slidesTitle", "Diapositives")
              : t("quizz:editorSettings", "Réglages de la question")
          }
          onClose={() => setPanel(null)}
        >
          <div className="bg-surface flex max-h-[85dvh] flex-col">
            <div className="border-border flex justify-end border-b p-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPanel(null)}
              >
                {t("common:close", "Fermer")}
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 justify-center overflow-auto">
              {panel === "slides" ? (
                <QuizzEditorSidebar onNavigate={() => setPanel(null)} />
              ) : (
                <QuestionEditorConfig />
              )}
            </div>
          </div>
        </EditorDialog>
      )}
    </div>
  )
}
