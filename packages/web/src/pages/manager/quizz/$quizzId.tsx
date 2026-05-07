import { EVENTS } from "@rahoot/common/constants"
import type { QuizzWithId } from "@rahoot/common/types/game"
import Loader from "@rahoot/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import QuestionEditor from "@rahoot/web/features/quizz/components/QuestionEditor"
import QuizzEditorHeader from "@rahoot/web/features/quizz/components/QuizzEditorHeader"
import QuizzEditorSidebar from "@rahoot/web/features/quizz/components/QuizzEditorSidebar"
import { QuizzEditorProvider } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import SlideToolbar from "@rahoot/web/features/quizz/components/SlideEditor/SlideToolbar"

const QuizzEditPage = () => {
  const { quizzId } = Route.useParams()
  const { socket } = useSocket()
  const [quizz, setQuizz] = useState<QuizzWithId | null>(null)
  const [loadError, setLoadError] = useState(false)
  const navigate = Route.useNavigate()

  useEffect(() => {
    socket?.emit(EVENTS.QUIZZ.GET, quizzId)
    const timer = setTimeout(() => setLoadError(true), 8000)

    return () => clearTimeout(timer)
  }, [socket, quizzId])

  useEvent(EVENTS.QUIZZ.DATA, (data) => {
    if (data.id === quizzId) {
      setQuizz(data)
    }
  })

  if (loadError && !quizz) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-xl font-bold text-red-500">
          Quizz introuvable ou erreur de chargement.
        </p>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          onClick={() => navigate({ to: "/manager/quizz" })}
        >
          Retour à la liste
        </button>
      </div>
    )
  }

  if (!quizz) {
    return (
      <div className="flex h-svh items-center justify-center bg-gray-50">
        <Loader className="text-background max-h-23" />
      </div>
    )
  }

  return (
    <QuizzEditorProvider initialData={quizz}>
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
}

export const Route = createFileRoute("/manager/quizz/$quizzId")({
  component: QuizzEditPage,
})
