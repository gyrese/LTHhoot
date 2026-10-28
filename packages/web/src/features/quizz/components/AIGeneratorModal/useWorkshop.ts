import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { EVENTS } from "@rahoot/common/constants"
import {
  workshopRequestValidator,
  type WorkshopReply,
} from "@rahoot/common/validators/ai-workshop"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "../../contexts/quizz-editor-context"
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./options"
import {
  applyWorkshopOperations,
  emptySession,
  loadSession,
  numberedTargets,
  type DraftQuestion,
  type ChatMessage,
} from "./workshop"

export default function useWorkshop(onClose: () => void) {
  const { socket } = useSocket()
  const {
    quizzId,
    questions: existingQuestions,
    subject,
    importQuestions,
  } = useQuizzEditor()
  // Unsaved quizzes keep their conversation in this editor instance only.
  // A shared "new" backup would leak it into every subsequent new quiz.
  const storageKey = quizzId ? `rahoot-ai-workshop-v1:${quizzId}` : null
  const [session, setSession] = useState(() =>
    storageKey ? loadSession(storageKey) : emptySession(),
  )
  const [settings, setSettings] = useState(() => {
    const saved = loadSettings()
    return workshopRequestValidator.shape.settings.safeParse({
      ...saved,
      time: saved.time || null,
    }).success
      ? saved
      : DEFAULT_SETTINGS
  })
  const [loading, setLoading] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(true)
  const retryRef = useRef<{ text: string; targetIds?: string[] } | null>(null)
  const [error, setError] = useState("")
  const [storageError, setStorageError] = useState(false)
  const [previous, setPrevious] = useState<DraftQuestion[] | null>(null)
  const [mobileTab, setMobileTab] = useState<"chat" | "questions">("chat")
  const append = (messages: ChatMessage[], message: ChatMessage) =>
    [...messages, message].slice(-24)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!storageKey) {
      return
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(session))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [storageKey, session])

  const send = (text: string, targetIds?: string[], retry = false) => {
    if (busy.current || !text.trim()) {
      return
    }
    if (!socket?.connected) {
      setError(
        "Connexion au serveur interrompue. Réessayez une fois reconnecté.",
      )
      return
    }
    let targets = targetIds
    try {
      targets ??= numberedTargets(text, session.questions)
    } catch (caught) {
      setError((caught as Error).message)
      return
    }
    const parsed = workshopRequestValidator.safeParse({
      message: text.trim(),
      history: (retry ? session.messages.slice(0, -1) : session.messages)
        .slice(-8)
        .map((message) => ({ ...message, text: message.text.slice(0, 1000) })),
      questions: session.questions,
      existingQuestions: existingQuestions
        .map((q) => q.question.slice(0, 500))
        .slice(0, 100),
      targetIds: targets,
      settings: {
        ...settings,
        time: settings.time || null,
        instructions: [
          settings.instructions,
          session.audience.trim()
            ? `Public visé : ${session.audience.trim()}`
            : "",
          subject ? `Titre du quiz en cours : ${subject}` : "",
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2000),
      },
    })
    if (!parsed.success) {
      setError(
        "Vérifiez vos réglages et la longueur de votre demande (2 000 caractères maximum).",
      )
      return
    }
    busy.current = true
    retryRef.current = { text, targetIds: targets }
    setLoading(true)
    setError("")
    saveSettings(settings)
    setSession((prev) => ({
      ...prev,
      input: "",
      messages: retry
        ? prev.messages
        : append(prev.messages, { role: "user", text: text.trim() }),
    }))
    socket
      .timeout(95000)
      .emit(
        EVENTS.QUIZZ.AI_WORKSHOP,
        parsed.data,
        (timeoutError: Error | null, reply: WorkshopReply) => {
          busy.current = false
          if (!mounted.current) {
            return
          }
          setLoading(false)
          if (timeoutError || !reply) {
            setError(
              "Le serveur n’a pas répondu à temps. Votre brouillon est conservé. Vous pouvez réessayer.",
            )
            return
          }
          if ("error" in reply) {
            setError(reply.error)
            return
          }
          try {
            const next = applyWorkshopOperations(
              session.questions,
              reply.result.operations,
            )
            if (reply.result.operations.length) {
              setPrevious(session.questions)
            }
            setSession((prev) => ({
              ...prev,
              questions: next,
              messages: append(prev.messages, {
                role: "assistant",
                text: reply.result.message,
              }),
            }))
            retryRef.current = null
            if (reply.result.operations.length) {
              setMobileTab("questions")
            }
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "La proposition est invalide. Votre brouillon est conservé.",
            )
          }
        },
      )
  }

  const update = (id: string, patch: Partial<DraftQuestion>) =>
    setSession((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q,
      ),
    }))
  const selected = session.questions.filter((q) => q.selected)
  const importDraft = () => {
    if (!selected.length || loading) {
      return
    }
    importQuestions(selected.map((q) => q.question))
    setSession((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => !q.selected),
      messages: append(prev.messages, {
        role: "assistant",
        text: `${selected.length} question(s) ajoutée(s) au quiz. Elles ont été retirées du brouillon pour éviter un second ajout.`,
      }),
    }))
    setPrevious(null)
    toast.success(`${selected.length} question(s) ajoutée(s)`)
    onClose()
  }
  const remove = (id: string) => {
    setPrevious(session.questions)
    setSession((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== id),
    }))
  }
  const undo = () => {
    if (previous) {
      setSession((prev) => ({ ...prev, questions: previous }))
    }
    setPrevious(null)
  }
  const reset = () => {
    setSession(emptySession())
    setPrevious(null)
    setError("")
    retryRef.current = null
  }
  return {
    session,
    setSession,
    settings,
    setSettings,
    subject,
    loading,
    error,
    storageError,
    previous,
    setPrevious,
    mobileTab,
    setMobileTab,
    send,
    update,
    selected,
    importDraft,
    remove,
    undo,
    reset,
    retry: retryRef.current
      ? () => {
          const pending = retryRef.current
          if (pending) {
            send(pending.text, pending.targetIds, true)
          }
        }
      : null,
  }
}
