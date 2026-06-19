import { EVENTS } from "@rahoot/common/constants"
import type { QuizzWithId } from "@rahoot/common/types/game"
import Button from "@rahoot/web/components/Button"
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
      <div className="bg-canvas flex h-svh flex-col items-center justify-center gap-4">
        <p className="text-danger text-xl font-bold">
          Quizz introuvable ou erreur de chargement.
        </p>
        <Button onClick={() => navigate({ to: "/manager/quizz" })}>
          Retour à la liste
        </Button>
      </div>
    )
  }

  if (!quizz) {
    return (
      <div className="bg-canvas flex h-svh items-center justify-center">
        <Loader className="text-primary max-h-23" />
      </div>
    )
  }

  return (
    <QuizzEditorProvider initialData={quizz}>
      <div className="bg-canvas text-ink relative flex h-svh flex-col">
        <QuizzEditorHeader />

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
