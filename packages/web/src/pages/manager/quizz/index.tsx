import EditorWorkspace from "@rahoot/web/features/quizz/components/EditorWorkspace"
import QuizzEditorHeader from "@rahoot/web/features/quizz/components/QuizzEditorHeader"
import { QuizzEditorProvider } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { createFileRoute } from "@tanstack/react-router"

const QuizzEditorPage = () => (
  <QuizzEditorProvider>
    <div className="bg-canvas text-ink relative flex h-svh flex-col">
      <QuizzEditorHeader />

      <EditorWorkspace />
    </div>
  </QuizzEditorProvider>
)

export const Route = createFileRoute("/manager/quizz/")({
  component: QuizzEditorPage,
})
