import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import Button from "@rahoot/web/components/Button"
import EditorDialog from "./EditorDialog"
import QuizzEditorSidebar from "./QuizzEditorSidebar"
import QuestionEditor from "./QuestionEditor"
import QuestionEditorConfig from "./QuestionEditor/QuestionEditorConfig"

export default function EditorWorkspace() {
  const { t } = useTranslation()
  const [wide, setWide] = useState(
    () => window.matchMedia("(min-width: 1100px)").matches,
  )
  const [panel, setPanel] = useState<"slides" | "settings" | null>(null)
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!wide && (
        <div className="border-border bg-surface flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPanel("slides")}
          >
            {t("quizz:slidesTitle", "Diapositives")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPanel("settings")}
          >
            {t("quizz:editorSettings", "Réglages de la question")}
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
                <QuizzEditorSidebar />
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
