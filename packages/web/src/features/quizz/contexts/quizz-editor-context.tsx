import type {
  DropPinZone,
  Question,
  QuestionMedia,
  QuestionType,
  QuizzWithId,
  SlideBackground,
  SlideElement,
} from "@rahoot/common/types/game"

const randomUUID = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/gu, (c) => {
    const r = Math.trunc(Math.random() * 16)
    const v = c === "x" ? r : (r % 4) + 8

    return v.toString(16)
  })
}
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react"
import { useSocket, useEvent } from "@rahoot/web/features/game/contexts/socket-context"
import { EVENTS } from "@rahoot/common/constants"
import toast from "react-hot-toast"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

export type QuestionWithId = Question & { id: string }

export type QuestionUpdate = {
  question?: string
  type?: QuestionType
  media?: QuestionMedia | undefined
  background?: SlideBackground | undefined
  backgroundOpacity?: number
  elements?: SlideElement[] | undefined
  audio?: string | undefined
  showLeaderboard?: boolean
  cooldown?: number
  time?: number
  answers?: string[]
  solutions?: number[]
  solution?: 0 | 1
  correctAnswers?: string[]
  correctYear?: number
  minYear?: number
  maxYear?: number
  correctValue?: number
  min?: number
  max?: number
  tolerance?: number
  items?: string[]
  pinImage?: string
  zones?: DropPinZone[]
  id?: string
}

type QuizzEditorContextType = {
  quizzId: string | null
  subject: string
  description: string
  folder: string
  tags: string[]
  salonImage?: string
  listingImage?: string
  setSubject: (_subject: string) => void
  setDescription: (_description: string) => void
  setFolder: (_folder: string) => void
  setTags: (_tags: string[]) => void
  setSalonImage: (_salonImage?: string) => void
  setListingImage: (_listingImage?: string) => void
  questions: QuestionWithId[]
  currentIndex: number
  currentQuestion: QuestionWithId
  setCurrentIndex: (_index: number) => void
  addQuestion: () => void
  removeQuestion: (_index: number) => void
  reorderQuestions: (_from: number, _to: number) => void
  duplicateQuestion: (_index: number) => void
  updateQuestion: (_index: number, _updates: QuestionUpdate) => void
  changeQuestionType: (_index: number, _type: QuestionType) => void
  selectedId: string | undefined
  setSelectedId: (_id: string | undefined) => void
  saveQuizz: (_options?: { silent?: boolean; navigate?: boolean }) => void
  isDirty: boolean
  isSaving: boolean
  lastSaved: Date | null
}

const QuizzEditorContext = createContext<QuizzEditorContextType | null>(null)

const defaultQuestion = (): QuestionWithId => ({
  id: randomUUID(),
  type: "mcq",
  question: "",
  answers: ["", ""],
  solutions: [0],
  cooldown: 5,
  time: 20,
})

const toQuestionWithId = (q: Question): QuestionWithId => ({
  ...q,
  id: randomUUID(),
})

const buildDefaultForType = (
  base: Pick<
    QuestionWithId,
    "id" | "question" | "media" | "background" | "backgroundOpacity" | "elements" | "audio" | "showLeaderboard" | "cooldown" | "time"
  >,
  type: QuestionType,
): QuestionWithId => {
  switch (type) {
    case "mcq":
      return { ...base, type: "mcq", answers: ["", ""], solutions: [0] }

    case "true_false":
      return { ...base, type: "true_false", solution: 0 }

    case "open":
      return { ...base, type: "open", correctAnswers: [""] }

    case "date": {
      const year = new Date().getFullYear()

      return { ...base, type: "date", correctYear: year, tolerance: 5, minYear: year - 30, maxYear: year + 30 }
    }

    case "slider":
      return { ...base, type: "slider", correctValue: 50, min: 0, max: 100, tolerance: 5 }

    case "title":
      return { ...base, type: "title" }

    case "puzzle":
      return { ...base, type: "puzzle", items: ["", ""] }

    case "drop_pin":
      return { ...base, type: "drop_pin", pinImage: "", zones: [] }

    default:
      return { ...base, type: "mcq", answers: ["", ""], solutions: [0] }
  }
}

type QuizzEditorProviderProps = PropsWithChildren<{
  initialData?: QuizzWithId
}>


export const QuizzEditorProvider = ({
  children,
  initialData,
}: QuizzEditorProviderProps) => {
  const { socket } = useSocket()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [subject, setSubject] = useState(initialData?.subject ?? "Untitled Quizz")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [folder, setFolder] = useState(initialData?.folder ?? "")
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [salonImage, setSalonImage] = useState<string | undefined>(initialData?.salonImage)
  const [listingImage, setListingImage] = useState<string | undefined>(initialData?.listingImage)
  const [questions, setQuestions] = useState<QuestionWithId[]>(
    initialData ? initialData.questions.map(toQuestionWithId) : [defaultQuestion()],
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [quizzId, setQuizzId] = useState<string | null>(initialData?.id ?? null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const currentQuestion = questions[currentIndex]

  const markDirty = () => setIsDirty(true)

  const wrappedSetSubject = (val: string) => { setSubject(val); markDirty() }
  const wrappedSetDescription = (val: string) => { setDescription(val); markDirty() }
  const wrappedSetFolder = (val: string) => { setFolder(val); markDirty() }
  const wrappedSetTags = (val: string[]) => { setTags(val); markDirty() }
  const wrappedSetSalonImage = (val?: string) => { setSalonImage(val); markDirty() }
  const wrappedSetListingImage = (val?: string) => { setListingImage(val); markDirty() }

  const handleSetCurrentIndex = (index: number) => {
    setCurrentIndex(index)
    setSelectedId(undefined)
  }

  const addQuestion = () => {
    setQuestions((prev) => [...prev, defaultQuestion()])
    handleSetCurrentIndex(questions.length)
    markDirty()
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
    handleSetCurrentIndex(Math.max(0, currentIndex >= index ? currentIndex - 1 : currentIndex))
    markDirty()
  }

  const reorderQuestions = (from: number, to: number) => {
    setQuestions((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)

      return next
    })
    handleSetCurrentIndex(to)
    markDirty()
  }

  const duplicateQuestion = (index: number) => {
    setQuestions((prev) => {
      const next = [...prev]
      const duplicated = { ...next[index], id: randomUUID() }
      next.splice(index + 1, 0, duplicated)
      return next
    })
    handleSetCurrentIndex(index + 1)
    markDirty()
  }

  const updateQuestion = (index: number, updates: QuestionUpdate) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? ({ ...q, ...updates } as QuestionWithId) : q)),
    )
    markDirty()
  }

  const changeQuestionType = (index: number, type: QuestionType) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) {
          return q
        }

        const base = {
          id: q.id,
          question: q.question,
          media: q.media,
          background: q.background,
          backgroundOpacity: q.backgroundOpacity,
          elements: q.elements,
          audio: q.audio,
          showLeaderboard: q.showLeaderboard,
          cooldown: q.cooldown,
          time: q.time,
        }

        return buildDefaultForType(base, type)
      }),
    )
    markDirty()
  }

  const [pendingNavigation, setPendingNavigation] = useState(false)

  const saveQuizz = useCallback((options?: { silent?: boolean; navigate?: boolean }) => {
    if (!socket) return

    const payload = {
      subject,
      description: description || undefined,
      folder: folder || undefined,
      tags: tags.length ? tags : undefined,
      salonImage: salonImage || undefined,
      listingImage: listingImage || undefined,
      questions,
    }

    if (options?.navigate) {
      setPendingNavigation(true)
    }

    setIsSaving(true)

    if (quizzId) {
      socket.emit(EVENTS.QUIZZ.UPDATE, { id: quizzId, ...payload })
    } else {
      socket.emit(EVENTS.QUIZZ.SAVE, payload)
    }

    if (!options?.silent) {
      toast.loading(t("quizz:saving"), { id: "quizz-save" })
    }
  }, [socket, subject, description, folder, tags, salonImage, listingImage, questions, quizzId, t])

  useEvent(EVENTS.QUIZZ.SAVE_SUCCESS, ({ id }) => {
    setQuizzId(id)
    setIsDirty(false)
    setIsSaving(false)
    setLastSaved(new Date())
    toast.success(t("quizz:quizzSaved"), { id: "quizz-save" })
    if (pendingNavigation) {
      navigate({ to: "/manager/config" })
    }
  })

  useEvent(EVENTS.QUIZZ.UPDATE_SUCCESS, () => {
    setIsDirty(false)
    setIsSaving(false)
    setLastSaved(new Date())
    toast.success(t("quizz:quizzUpdated"), { id: "quizz-save" })
    if (pendingNavigation) {
      navigate({ to: "/manager/config" })
    }
  })

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    toast.error(t(message), { id: "quizz-save" })
    setPendingNavigation(false)
    setIsSaving(false)
  })

  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty) {
        saveQuizz({ silent: true })
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [isDirty, saveQuizz])

  return (
    <QuizzEditorContext.Provider
      value={{
        quizzId,
        subject,
        description,
        folder,
        tags,
        salonImage,
        listingImage,
        setSubject: wrappedSetSubject,
        setDescription: wrappedSetDescription,
        setFolder: wrappedSetFolder,
        setTags: wrappedSetTags,
        setSalonImage: wrappedSetSalonImage,
        setListingImage: wrappedSetListingImage,
        questions,
        currentIndex,
        currentQuestion,
        setCurrentIndex: handleSetCurrentIndex,
        addQuestion,
        removeQuestion,
        reorderQuestions,
        duplicateQuestion,
        updateQuestion,
        changeQuestionType,
        selectedId,
        setSelectedId,
        saveQuizz,
        isDirty,
        isSaving,
        lastSaved,
      }}
    >
      {children}
    </QuizzEditorContext.Provider>
  )
}

export const useQuizzEditor = () => {
  const ctx = useContext(QuizzEditorContext)

  if (!ctx) {
    throw new Error("useQuizzEditor must be used inside QuizzEditorProvider")
  }

  return ctx
}
