import InspectorRail from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/InspectorRail"
import AppearancePanel from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/panels/AppearancePanel"
import ElementPanel from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/panels/ElementPanel"
import LayersPanel from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/panels/LayersPanel"
import SettingsPanel from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/panels/SettingsPanel"
import {
  type InspectorPanel,
  useQuizzEditor,
} from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useEffect } from "react"

const PANEL_TITLES: Record<InspectorPanel, string> = {
  settings: "Réglages",
  appearance: "Apparence",
  layers: "Calques",
  element: "Élément",
}

const QuestionEditorConfig = () => {
  const {
    currentQuestion,
    selectedId,
    activeInspectorPanel,
    setActiveInspectorPanel,
  } = useQuizzEditor()

  const selectedElement = currentQuestion?.elements?.find(
    (el) => el.id === selectedId,
  )
  const isYoutube = selectedElement?.type === "youtube"

  // La config YouTube n'existe que dans l'onglet Élément : on y bascule
  // automatiquement quand on sélectionne une vidéo, pour éviter d'avoir
  // à chercher où se trouve ce réglage.
  useEffect(() => {
    if (isYoutube) {
      setActiveInspectorPanel("element")
    }
  }, [selectedId, isYoutube])

  if (!currentQuestion) {
    return null
  }

  return (
    <aside className="z-10 flex shrink-0">
      <InspectorRail />

      <div className="border-border bg-surface scrollbar-light flex w-60 flex-col overflow-auto border-l">
        <div className="border-border/70 bg-surface sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
          <span className="text-ink-muted text-xs font-bold">
            {PANEL_TITLES[activeInspectorPanel]}
          </span>
        </div>

        <div className="flex flex-col px-4 pb-4">
          {activeInspectorPanel === "settings" && <SettingsPanel />}
          {activeInspectorPanel === "appearance" && <AppearancePanel />}
          {activeInspectorPanel === "layers" && <LayersPanel />}
          {activeInspectorPanel === "element" && <ElementPanel />}
        </div>
      </div>
    </aside>
  )
}

export default QuestionEditorConfig
