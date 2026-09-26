import { EVENTS } from "@rahoot/common/constants"
import type { QuizzWithId } from "@rahoot/common/types/game"
import Button from "@rahoot/web/components/Button"
import Loader from "@rahoot/web/components/Loader"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import EditorWorkspace from "@rahoot/web/features/quizz/components/EditorWorkspace"
import QuizzEditorHeader from "@rahoot/web/features/quizz/components/QuizzEditorHeader"
import { QuizzEditorProvider } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

// Filet de sécurité si le serveur ne répond pas du tout (QUIZZ.ERROR couvre
// déjà le quiz introuvable, signalé immédiatement).
const LOAD_TIMEOUT_MS = 10000

const QuizzEditPage = () => {
  const { quizzId } = Route.useParams()
  const { socket } = useSocket()
  const [quizz, setQuizz] = useState<QuizzWithId | null>(null)
  const [loadError, setLoadError] = useState(false)
  const navigate = Route.useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    setQuizz(null)
    setLoadError(false)
    socket?.emit(EVENTS.QUIZZ.GET, quizzId)
    const timer = setTimeout(() => setLoadError(true), LOAD_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [socket, quizzId])

  useEvent(EVENTS.QUIZZ.DATA, (data) => {
    if (data.id === quizzId) {
      setQuizz(data)
    }
  })

  // Quiz introuvable (supprimé, lien obsolète…) : affiché aussitôt au lieu
  // d'attendre le délai de secours. Une fois l'éditeur ouvert, les erreurs
  // QUIZZ.ERROR (sauvegarde…) sont gérées par le contexte de l'éditeur.
  useEvent(EVENTS.QUIZZ.ERROR, () => {
    if (!quizz) {
      setLoadError(true)
    }
  })

  if (loadError && !quizz) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
        <p role="alert" className="text-xl font-bold text-white">
          {t("manager:editor.notFound")}
        </p>
        <Button
          className="bg-orange-500 px-5 py-2.5 text-white hover:bg-orange-400"
          onClick={() => navigate({ to: "/manager/config" })}
        >
          {t("manager:editor.backToDashboard")}
        </Button>
      </div>
    )
  }

  if (!quizz) {
    return (
      <div className="flex h-svh items-center justify-center bg-slate-950">
        <Loader className="max-h-23 text-orange-400" />
      </div>
    )
  }

  return (
    <QuizzEditorProvider key={quizz.id} initialData={quizz}>
      <div className="bg-canvas text-ink relative flex h-svh flex-col">
        <QuizzEditorHeader />

        <EditorWorkspace />
      </div>
    </QuizzEditorProvider>
  )
}

export const Route = createFileRoute("/manager/quizz/$quizzId")({
  component: QuizzEditPage,
})
