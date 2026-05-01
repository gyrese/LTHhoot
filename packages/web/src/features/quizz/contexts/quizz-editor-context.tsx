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
  useContext,
  useState,
  type PropsWithChildren,
} from "react"

export type QuestionWithId = Question & { id: string }

export type QuestionUpdate = {
  question?: string
  type?: QuestionType
  media?: QuestionMedia | undefined
  background?: SlideBackground | undefined
  backgroundOpacity?: number
  elements?: SlideElement[] | undefined
  audio?: string | undefined
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
  updateQuestion: (_index: number, _updates: QuestionUpdate) => void
  changeQuestionType: (_index: number, _type: QuestionType) => void
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
    "id" | "question" | "media" | "background" | "backgroundOpacity" | "elements" | "audio" | "cooldown" | "time"
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
  const currentQuestion = questions[currentIndex]

  const addQuestion = () => {
    setQuestions((prev) => [...prev, defaultQuestion()])
    setCurrentIndex(questions.length)
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
    setCurrentIndex((prev) => Math.max(0, prev >= index ? prev - 1 : prev))
  }

  const reorderQuestions = (from: number, to: number) => {
    setQuestions((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)

      return next
    })
    setCurrentIndex(to)
  }

  const updateQuestion = (index: number, updates: QuestionUpdate) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? ({ ...q, ...updates } as QuestionWithId) : q)),
    )
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
          cooldown: q.cooldown,
          time: q.time,
        }

        return buildDefaultForType(base, type)
      }),
    )
  }

  return (
    <QuizzEditorContext.Provider
      value={{
        quizzId: initialData?.id ?? null,
        subject,
        description,
        folder,
        tags,
        salonImage,
        listingImage,
        setSubject,
        setDescription,
        setFolder,
        setTags,
        setSalonImage,
        setListingImage,
        questions,
        currentIndex,
        currentQuestion,
        setCurrentIndex,
        addQuestion,
        removeQuestion,
        reorderQuestions,
        updateQuestion,
        changeQuestionType,
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
