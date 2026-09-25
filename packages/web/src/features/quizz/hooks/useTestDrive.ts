import { EVENTS } from "@rahoot/common/constants"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"

// Flux « démonstration » partagé entre le header de l'éditeur et l'aperçu :
// crée une partie en mode démo sur la question demandée puis bascule vers
// l'écran manager de la partie.
const useTestDrive = () => {
  const { socket, isConnected } = useSocket()
  const { questions, saveQuizz } = useQuizzEditor()
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

  useEffect(() => {
    if (!isTestDriving) {
      return () => undefined
    }
    const timer = setTimeout(() => {
      pendingRef.current = false
      setIsTestDriving(false)
      toast.error("Le test n'a pas pu démarrer. Réessayez.")
    }, 30000)
    return () => clearTimeout(timer)
  }, [isTestDriving])

  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    if (!pendingRef.current) {
      return
    }
    pendingRef.current = false
    setIsTestDriving(false)
    toast.error(message)
  })

  const startTestDrive = async (questionIndex: number) => {
    if (
      !socket ||
      !isConnected ||
      questions.length === 0 ||
      isTestDriving ||
      pendingRef.current
    ) {
      return
    }

    setIsTestDriving(true)
    pendingRef.current = true
    const savedId = await saveQuizz()
    if (!savedId || !socket.connected || !pendingRef.current) {
      pendingRef.current = false
      setIsTestDriving(false)
      return
    }
    socket.emit(EVENTS.GAME.CREATE, {
      quizId: savedId,
      powerUpsEnabled: false,
      questionIndex,
    })
  }

  return { startTestDrive, isTestDriving }
}

export default useTestDrive
