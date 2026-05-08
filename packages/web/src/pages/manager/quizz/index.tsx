import QuestionEditor from "@rahoot/web/features/quizz/components/QuestionEditor"
import QuizzEditorHeader from "@rahoot/web/features/quizz/components/QuizzEditorHeader"
import QuizzEditorSidebar from "@rahoot/web/features/quizz/components/QuizzEditorSidebar"
import { QuizzEditorProvider } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { createFileRoute } from "@tanstack/react-router"

import SlideToolbar from "@rahoot/web/features/quizz/components/SlideEditor/SlideToolbar"

const QuizzEditorPage = () => (
  <QuizzEditorProvider>
    <div className="relative flex h-svh flex-col bg-gray-100">
      <QuizzEditorHeader />

      {/* Barre secondaire unifiée (Slides | Toolbar | Config) */}
      <div className="z-30 flex h-14 shrink-0 items-center border-b border-gray-200 bg-white">
        <div className="flex h-full w-72 shrink-0 items-center border-r border-gray-200 px-6">
          <span className="text-sm font-bold tracking-wider text-gray-400 uppercase">
            Diapositives
          </span>
        </div>

        <div className="flex h-full flex-1 items-center justify-center bg-gray-50/50">
          <SlideToolbar />
        </div>

        <div className="flex h-full w-68 shrink-0 items-center border-l border-gray-200 px-6">
          <span className="text-sm font-bold tracking-wider text-gray-400 uppercase">
            Paramètres
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <QuizzEditorSidebar />
        <QuestionEditor />
      </div>
    </div>
  </QuizzEditorProvider>
)

export const Route = createFileRoute("/manager/quizz/")({
  component: QuizzEditorPage,
})
