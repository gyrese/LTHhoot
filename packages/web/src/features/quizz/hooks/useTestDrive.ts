import { EVENTS } from "@rahoot/common/constants"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"

// Flux « démonstration » partagé entre le header de l'éditeur et l'aperçu :
// crée une partie en mode démo sur la question demandée puis bascule vers
// l'écran manager de la partie.
const useTestDrive = () => {
  const { socket } = useSocket()
  const { quizzId, questions } = useQuizzEditor()
  const navigate = useNavigate()
  const [isTestDriving, setIsTestDriving] = useState(false)
  const pendingRef = useRef(false)

  useEvent(EVENTS.MANAGER.GAME_CREATED, ({ gameId }) => {
    if (!pendingRef.current) {
      return
    }

    pendingRef.current = false
    setIsTestDriving(false)
    navigate({ to: "/party/manager/$gameId", params: { gameId } })
    socket?.emit(EVENTS.MANAGER.START_DEMO, { gameId })
  })

  const startTestDrive = (questionIndex: number) => {
    if (!socket || !quizzId || questions.length === 0 || isTestDriving) {
      return
    }

    setIsTestDriving(true)
    pendingRef.current = true
    socket.emit(EVENTS.GAME.CREATE, {
      quizId: quizzId,
      powerUpsEnabled: false,
      questionIndex,
    })
  }

  return { startTestDrive, isTestDriving }
}

export default useTestDrive
