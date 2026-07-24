import type {
  AnswerReveal,
  DropPinZone,
  PodiumThemeSetting,
  Question,
  QuestionMedia,
  QuestionType,
  QuizzWithId,
  SlideBackground,
  SlideElement,
} from "@rahoot/common/types/game"
import { quizzValidator } from "@rahoot/common/validators/quizz"
import { generateId } from "@rahoot/web/features/quizz/utils/id"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react"
import {
  useSocket,
  useEvent,
} from "@rahoot/web/features/game/contexts/socket-context"
import { EVENTS } from "@rahoot/common/constants"
import toast from "react-hot-toast"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import Button from "@rahoot/web/components/Button"
import { validateQuestion } from "@rahoot/web/features/quizz/utils/validation"
import { RotateCcw } from "lucide-react"

export type QuestionWithId = Question & { id: string }

export type InspectorPanel = "settings" | "appearance" | "layers" | "element"

export type QuestionUpdate = {
  question?: string
  type?: QuestionType
  media?: QuestionMedia | undefined
  background?: SlideBackground | undefined
  backgroundOpacity?: number
  elements?: SlideElement[] | undefined
  audio?: string | undefined
  showLeaderboard?: boolean
  answerReveal?: AnswerReveal | undefined
  suddenDeath?: boolean
  cooldown?: number
  time?: number
  answers?: string[]
  solutions?: number[]
  solution?: 0 | 1
  correctAnswers?: string[]
  images?: string[]
  imageInterval?: number
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
  revelationEnabled?: boolean
  revealDuration?: number
  gridCols?: number
  gridRows?: number
  revelationStyle?: string
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
  podiumTheme?: PodiumThemeSetting
  setSubject: (_subject: string) => void
  setDescription: (_description: string) => void
  setFolder: (_folder: string) => void
  setTags: (_tags: string[]) => void
  setSalonImage: (_salonImage?: string) => void
  setListingImage: (_listingImage?: string) => void
  setPodiumTheme: (_podiumTheme?: PodiumThemeSetting) => void
  questions: QuestionWithId[]
  currentIndex: number
  currentQuestion: QuestionWithId
  setCurrentIndex: (_index: number) => void
  addQuestion: () => void
  removeQuestion: (_index: number) => void
  reorderQuestions: (_from: number, _to: number) => void
  duplicateQuestion: (_index: number) => void
  updateQuestion: (_index: number, _updates: QuestionUpdate) => void
  applyToAllQuestions: (_patch: QuestionUpdate) => void
  changeQuestionType: (_index: number, _type: QuestionType) => void
  selectedId: string | undefined
  setSelectedId: (_id: string | undefined) => void
  selectedQuestionIds: string[]
  setSelectedQuestionIds: (_ids: string[]) => void
  selectSlide: (_index: number, _ctrlKey: boolean, _shiftKey: boolean) => void
  importQuestions: (_imported: Question[]) => void
  saveQuizz: (_options?: { silent?: boolean; navigate?: boolean }) => void
  isDirty: boolean
  isSaving: boolean
  lastSaved: Date | null
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  activeInspectorPanel: InspectorPanel
  setActiveInspectorPanel: (_panel: InspectorPanel) => void
}

const QuizzEditorContext = createContext<QuizzEditorContextType | null>(null)

const defaultQuestion = (): QuestionWithId => ({
  id: generateId(),
  type: "mcq",
  question: "",
  answers: ["", ""],
  solutions: [0],
  cooldown: 5,
  time: 20,
})

const toQuestionWithId = (q: Question): QuestionWithId => ({
  ...q,
  id: generateId(),
})

const buildDefaultForType = (
  base: Pick<
    QuestionWithId,
    | "id"
    | "question"
    | "media"
    | "background"
    | "backgroundOpacity"
    | "elements"
    | "audio"
    | "showLeaderboard"
    | "answerReveal"
    | "cooldown"
    | "time"
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

    case "image_sequence":
      return {
        ...base,
        type: "image_sequence",
        images: [],
        correctAnswers: [""],
        imageInterval: 5,
      }

    case "date": {
      const year = new Date().getFullYear()

      return {
        ...base,
        type: "date",
        correctYear: year,
        tolerance: 5,
        minYear: year - 30,
        maxYear: year + 30,
      }
    }

    case "slider":
      return {
        ...base,
        type: "slider",
        correctValue: 50,
        min: 0,
        max: 100,
        tolerance: 5,
      }

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
  const { socket, isConnected } = useSocket()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [subject, setSubject] = useState(
    initialData?.subject ?? "Untitled Quizz",
  )
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [folder, setFolder] = useState(initialData?.folder ?? "")
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [salonImage, setSalonImage] = useState<string | undefined>(
    initialData?.salonImage,
  )
  const [listingImage, setListingImage] = useState<string | undefined>(
    initialData?.listingImage,
  )
  const [podiumTheme, setPodiumTheme] = useState<
    PodiumThemeSetting | undefined
  >(initialData?.podiumTheme)
  const [questions, setQuestions] = useState<QuestionWithId[]>(
    initialData
      ? initialData.questions.map(toQuestionWithId)
      : [defaultQuestion()],
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    () => [questions[0]?.id || ""],
  )
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [quizzId, setQuizzId] = useState<string | null>(initialData?.id ?? null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [pendingRestore, setPendingRestore] = useState<any | null>(null)
  const [activeInspectorPanel, setActiveInspectorPanel] =
    useState<InspectorPanel>("settings")
  // `updatedAt` connu du client pour ce quiz : sert à détecter, côté serveur,
  // qu'une autre session a sauvegardé entre-temps (concurrence optimiste).
  const [updatedAt, setUpdatedAt] = useState<number | undefined>(
    initialData?.updatedAt,
  )
  const [saveConflict, setSaveConflict] = useState(false)

  // Nettoyage automatique des anciens backups volumineux de localStorage contenant du base64
  useEffect(() => {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("rahoot-backup-")) {
          const val = localStorage.getItem(key)
          if (val && val.includes("data:image/")) {
            keysToRemove.push(key)
          }
        }
      }
      keysToRemove.forEach((key) => {
        console.warn(
          `[LocalStorage Cleanup] Suppression d'un ancien backup lourd contenant du base64 : ${key}`,
        )
        localStorage.removeItem(key)
      })
    } catch (e) {
      console.error("Échec du nettoyage automatique de localStorage :", e)
    }
  }, [])

  const currentQuestion =
    questions[currentIndex] ||
    questions[Math.max(0, questions.length - 1)] ||
    questions[0]

  const markDirty = () => setIsDirty(true)

  const wrappedSetSubject = (val: string) => {
    setSubject(val)
    markDirty()
  }
  const wrappedSetDescription = (val: string) => {
    setDescription(val)
    markDirty()
  }
  const wrappedSetFolder = (val: string) => {
    setFolder(val)
    markDirty()
  }
  const wrappedSetTags = (val: string[]) => {
    setTags(val)
    markDirty()
  }
  const wrappedSetSalonImage = (val?: string) => {
    setSalonImage(val)
    markDirty()
  }
  const wrappedSetListingImage = (val?: string) => {
    setListingImage(val)
    markDirty()
  }
  const wrappedSetPodiumTheme = (val?: PodiumThemeSetting) => {
    setPodiumTheme(val)
    markDirty()
  }

  const handleSetCurrentIndex = (index: number) => {
    setCurrentIndex(index)
    setSelectedId(undefined)
  }

  const selectSlide = useCallback(
    (index: number, ctrlKey: boolean, shiftKey: boolean) => {
      const clickedId = questions[index]?.id
      if (!clickedId) return

      setSelectedQuestionIds((prevSelected) => {
        if (ctrlKey) {
          if (prevSelected.includes(clickedId)) {
            const nextSelected = prevSelected.filter((id) => id !== clickedId)
            if (nextSelected.length === 0) {
              return [clickedId]
            }
            return nextSelected
          } else {
            return [...prevSelected, clickedId]
          }
        } else if (shiftKey) {
          const start = Math.min(currentIndex, index)
          const end = Math.max(currentIndex, index)
          const rangeIds = questions.slice(start, end + 1).map((q) => q.id)
          return rangeIds
        } else {
          return [clickedId]
        }
      })

      handleSetCurrentIndex(index)
    },
    [questions, currentIndex, handleSetCurrentIndex],
  )

  // ─── Undo / Redo ────────────────────────────────────────────────────────────

  type Snapshot = {
    questions: QuestionWithId[]
    subject: string
    description: string
    folder: string
    tags: string[]
    salonImage?: string
    listingImage?: string
    podiumTheme?: PodiumThemeSetting
    currentIndex: number
    selectedQuestionIds: string[]
  }

  const HISTORY_LIMIT = 50
  const HISTORY_DEBOUNCE_MS = 400

  const historyRef = useRef<{ stack: Snapshot[]; index: number }>({
    stack: [],
    index: -1,
  })
  const isApplyingHistoryRef = useRef(false)
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const refreshHistoryFlags = () => {
    const { stack, index } = historyRef.current
    setCanUndo(index > 0)
    setCanRedo(index < stack.length - 1)
  }

  const takeSnapshot = useCallback(
    (): Snapshot => ({
      questions,
      subject,
      description,
      folder,
      tags,
      salonImage,
      listingImage,
      podiumTheme,
      currentIndex,
      selectedQuestionIds,
    }),
    [
      questions,
      subject,
      description,
      folder,
      tags,
      salonImage,
      listingImage,
      podiumTheme,
      currentIndex,
      selectedQuestionIds,
    ],
  )

  const pushSnapshot = (snapshot: Snapshot) => {
    const { stack, index } = historyRef.current
    const truncated = stack.slice(0, index + 1)
    truncated.push(snapshot)

    while (truncated.length > HISTORY_LIMIT) {
      truncated.shift()
    }

    historyRef.current = {
      stack: truncated,
      index: truncated.length - 1,
    }

    refreshHistoryFlags()
  }

  const flushPendingHistoryPush = useCallback(() => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current)
      historyTimerRef.current = null
      pushSnapshot(takeSnapshot())
    }
  }, [takeSnapshot])

  useEffect(() => {
    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false

      return
    }

    if (historyRef.current.index === -1) {
      pushSnapshot(takeSnapshot())

      return
    }

    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current)
    }

    historyTimerRef.current = setTimeout(() => {
      pushSnapshot(takeSnapshot())
      historyTimerRef.current = null
    }, HISTORY_DEBOUNCE_MS)
  }, [
    questions,
    subject,
    description,
    folder,
    tags,
    salonImage,
    listingImage,
    podiumTheme,
    currentIndex,
    selectedQuestionIds,
    takeSnapshot,
  ])

  const applySnapshot = (s: Snapshot) => {
    isApplyingHistoryRef.current = true
    setQuestions(s.questions)
    setSubject(s.subject)
    setDescription(s.description)
    setFolder(s.folder)
    setTags(s.tags)
    setSalonImage(s.salonImage)
    setListingImage(s.listingImage)
    setPodiumTheme(s.podiumTheme)
    setCurrentIndex(
      s.questions.length === 0
        ? 0
        : Math.min(s.currentIndex, s.questions.length - 1),
    )
    setSelectedQuestionIds(s.selectedQuestionIds || [])
    setSelectedId(undefined)
    setIsDirty(true)
  }

  const undo = useCallback(() => {
    flushPendingHistoryPush()

    const { stack, index } = historyRef.current

    if (index <= 0) {
      return
    }

    const newIndex = index - 1
    historyRef.current = { stack, index: newIndex }
    applySnapshot(stack[newIndex])
    refreshHistoryFlags()
  }, [flushPendingHistoryPush])

  const redo = useCallback(() => {
    flushPendingHistoryPush()

    const { stack, index } = historyRef.current

    if (index >= stack.length - 1) {
      return
    }

    const newIndex = index + 1
    historyRef.current = { stack, index: newIndex }
    applySnapshot(stack[newIndex])
    refreshHistoryFlags()
  }, [flushPendingHistoryPush])

  const addQuestion = () => {
    const newQ = defaultQuestion()
    setQuestions((prev) => [...prev, newQ])
    handleSetCurrentIndex(questions.length)
    setSelectedQuestionIds([newQ.id])
    markDirty()
  }

  const removeQuestion = (index: number) => {
    const clickedId = questions[index]?.id
    const idsToDelete =
      clickedId && selectedQuestionIds.includes(clickedId)
        ? selectedQuestionIds
        : [clickedId].filter(Boolean)

    if (questions.length <= idsToDelete.length) {
      return
    }

    const nextQuestions = questions.filter((q) => !idsToDelete.includes(q.id))
    setQuestions(nextQuestions)

    let newActiveIndex = 0
    const remainingActive = questions.find(
      (q, i) => !idsToDelete.includes(q.id) && i >= index,
    )
    if (remainingActive) {
      newActiveIndex = nextQuestions.findIndex(
        (q) => q.id === remainingActive.id,
      )
    } else {
      newActiveIndex = Math.max(0, nextQuestions.length - 1)
    }

    handleSetCurrentIndex(newActiveIndex)
    setSelectedQuestionIds([nextQuestions[newActiveIndex].id])
    markDirty()
  }

  const reorderQuestions = (from: number, to: number) => {
    const draggedId = questions[from]?.id
    if (!draggedId) return

    const idsToMove = selectedQuestionIds.includes(draggedId)
      ? questions
          .filter((q) => selectedQuestionIds.includes(q.id))
          .map((q) => q.id)
      : [draggedId]

    setQuestions((prev) => {
      const movingQuestions = prev.filter((q) => idsToMove.includes(q.id))
      const remaining = prev.filter((q) => !idsToMove.includes(q.id))
      const numMovedBeforeTo = prev
        .slice(0, to)
        .filter((q) => idsToMove.includes(q.id)).length
      const insertIndex = Math.max(
        0,
        Math.min(remaining.length, to - numMovedBeforeTo),
      )

      const next = [...remaining]
      next.splice(insertIndex, 0, ...movingQuestions)

      const newDraggedIndex = next.findIndex((q) => q.id === draggedId)
      if (newDraggedIndex !== -1) {
        setTimeout(() => {
          handleSetCurrentIndex(newDraggedIndex)
        }, 0)
      }

      return next
    })

    markDirty()
  }

  const duplicateQuestion = (index: number) => {
    const clickedId = questions[index]?.id
    const isMultiSelection =
      clickedId !== undefined &&
      selectedQuestionIds.includes(clickedId) &&
      selectedQuestionIds.length > 1

    if (isMultiSelection) {
      // Duplique tous les slides sélectionnés, dans leur ordre d'apparition
      const orderedSelected = questions.filter((q) =>
        selectedQuestionIds.includes(q.id),
      )
      const newCopies = orderedSelected.map((q) => ({ ...q, id: generateId() }))

      // Détermine l'index du dernier slide sélectionné pour insérer les copies juste après
      const lastSelectedIndex = questions.reduce(
        (acc, q, i) => (selectedQuestionIds.includes(q.id) ? i : acc),
        -1,
      )

      setQuestions((prev) => {
        const next = [...prev]
        next.splice(lastSelectedIndex + 1, 0, ...newCopies)

        return next
      })

      const firstCopyIndex = lastSelectedIndex + 1
      setSelectedQuestionIds(newCopies.map((c) => c.id))
      handleSetCurrentIndex(firstCopyIndex)
    } else {
      // Comportement d'origine : duplique un seul slide
      setQuestions((prev) => {
        const next = [...prev]
        const duplicated = { ...next[index], id: generateId() }
        next.splice(index + 1, 0, duplicated)
        setSelectedQuestionIds([duplicated.id])

        return next
      })
      handleSetCurrentIndex(index + 1)
    }

    markDirty()
  }

  const updateQuestion = (index: number, updates: QuestionUpdate) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index ? ({ ...q, ...updates } as QuestionWithId) : q,
      ),
    )
    markDirty()
  }

  const importQuestions = (imported: Question[]) => {
    if (imported.length === 0) {
      return
    }

    const newWithIds = imported.map((q) => ({
      ...q,
      id: generateId(),
    })) as QuestionWithId[]

    setQuestions((prev) => {
      const firstNewIndex = prev.length

      setTimeout(() => {
        handleSetCurrentIndex(firstNewIndex)
        setSelectedQuestionIds([newWithIds[0].id])
      }, 0)

      return [...prev, ...newWithIds]
    })

    markDirty()
  }

  const applyToAllQuestions = (patch: QuestionUpdate) => {
    setQuestions((prev) =>
      prev.map((q) => ({ ...q, ...patch }) as QuestionWithId),
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
          answerReveal: q.answerReveal,
          cooldown: q.cooldown,
          time: q.time,
        }

        return buildDefaultForType(base, type)
      }),
    )
    markDirty()
  }

  const [pendingNavigation, setPendingNavigation] = useState(false)

  const saveQuizz = useCallback(
    (options?: { silent?: boolean; navigate?: boolean; force?: boolean }) => {
      if (!socket || !isConnected) {
        if (!options?.silent) {
          toast.error(
            t("errors:quizz.failedToSave") ||
              "Connexion perdue. Sauvegarde impossible.",
            {
              id: "quizz-save",
            },
          )
        }

        return
      }

      // Client-side slide validation check
      if (!options?.silent) {
        const allErrors: { index: number; errors: string[] }[] = []
        questions.forEach((q, i) => {
          const errs = validateQuestion(q)
          if (errs.length > 0) {
            allErrors.push({ index: i + 1, errors: errs })
          }
        })

        if (allErrors.length > 0) {
          const first = allErrors[0]
          toast.error(
            `Veuillez corriger les erreurs sur la diapositive ${first.index} : ${first.errors[0]}`,
            { id: "quizz-save" },
          )
          return
        }
      }

      const payload = {
        subject,
        description: description || undefined,
        folder: folder || undefined,
        tags: tags.length ? tags : undefined,
        salonImage: salonImage || undefined,
        listingImage: listingImage || undefined,
        podiumTheme: podiumTheme || undefined,
        questions,
        // `force` omet volontairement `updatedAt` : le serveur saute alors le
        // contrôle de concurrence et écrase quoi qu'il arrive.
        updatedAt: options?.force ? undefined : updatedAt,
      }

      const result = quizzValidator.safeParse(payload)

      if (!result.success) {
        if (!options?.silent) {
          const [first] = result.error.issues
          const path = first.path.length ? ` (${first.path.join(".")})` : ""
          toast.error(`${t(first.message, first.message)}${path}`, {
            id: "quizz-save",
          })
        }

        return
      }

      if (options?.navigate) {
        setPendingNavigation(true)
      }

      setIsSaving(true)

      if (quizzId) {
        socket?.emit(EVENTS.QUIZZ.UPDATE, { id: quizzId, ...payload })
      } else {
        socket?.emit(EVENTS.QUIZZ.SAVE, payload)
      }

      if (!options?.silent) {
        toast.loading(t("quizz:saving"), { id: "quizz-save" })
      }
    },
    [
      socket,
      isConnected,
      subject,
      description,
      folder,
      tags,
      salonImage,
      listingImage,
      podiumTheme,
      questions,
      quizzId,
      updatedAt,
      t,
    ],
  )

  useEvent(EVENTS.QUIZZ.SAVE_SUCCESS, ({ id, updatedAt: newUpdatedAt }) => {
    setQuizzId(id)
    setUpdatedAt(newUpdatedAt)
    setIsDirty(false)
    setIsSaving(false)
    setLastSaved(new Date())
    localStorage.removeItem(`rahoot-backup-${id}`)
    toast.success(t("quizz:quizzSaved"), { id: "quizz-save" })

    if (pendingNavigation) {
      navigate({ to: "/manager/config" })
    }
  })

  useEvent(EVENTS.QUIZZ.UPDATE_SUCCESS, ({ updatedAt: newUpdatedAt }) => {
    setUpdatedAt(newUpdatedAt)
    setIsDirty(false)
    setIsSaving(false)
    setLastSaved(new Date())
    if (quizzId) {
      localStorage.removeItem(`rahoot-backup-${quizzId}`)
    }
    toast.success(t("quizz:quizzUpdated"), { id: "quizz-save" })

    if (pendingNavigation) {
      navigate({ to: "/manager/config" })
    }
  })

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    setPendingNavigation(false)
    setIsSaving(false)

    if (message === "errors:quizz.conflict") {
      toast.dismiss("quizz-save")
      setSaveConflict(true)

      return
    }

    toast.error(t(message), { id: "quizz-save" })
  })

  const handleConflictOverwrite = () => {
    setSaveConflict(false)
    saveQuizz({ force: true })
  }

  const handleConflictReload = () => {
    window.location.reload()
  }

  // Recovery check on load
  useEffect(() => {
    if (!quizzId) return
    const backupStr = localStorage.getItem(`rahoot-backup-${quizzId}`)
    if (backupStr) {
      try {
        const backup = JSON.parse(backupStr)
        setPendingRestore(backup)
      } catch (err) {
        console.error("Failed to parse local backup:", err)
      }
    }
  }, [quizzId])

  const handleApplyRestore = () => {
    if (pendingRestore) {
      if (pendingRestore.subject !== undefined)
        setSubject(pendingRestore.subject)
      if (pendingRestore.description !== undefined)
        setDescription(pendingRestore.description)
      if (pendingRestore.folder !== undefined) setFolder(pendingRestore.folder)
      if (pendingRestore.tags !== undefined) setTags(pendingRestore.tags)
      if (pendingRestore.salonImage !== undefined)
        setSalonImage(pendingRestore.salonImage)
      if (pendingRestore.listingImage !== undefined)
        setListingImage(pendingRestore.listingImage)
      if (pendingRestore.podiumTheme !== undefined)
        setPodiumTheme(pendingRestore.podiumTheme)
      if (pendingRestore.questions !== undefined) {
        setQuestions(pendingRestore.questions.map(toQuestionWithId))
      }
      setIsDirty(true)
      toast.success("Modifications restaurées depuis le cache local.")
    }
    setPendingRestore(null)
  }

  const handleDiscardRestore = () => {
    if (quizzId) {
      localStorage.removeItem(`rahoot-backup-${quizzId}`)
    }
    setPendingRestore(null)
  }

  // Autosave to localStorage backup
  useEffect(() => {
    if (!quizzId || !isDirty) return

    const timer = setTimeout(() => {
      const backupData = {
        subject,
        description,
        folder,
        tags,
        salonImage,
        listingImage,
        podiumTheme,
        questions: questions.map(({ id, ...q }) => q),
      }
      try {
        localStorage.setItem(
          `rahoot-backup-${quizzId}`,
          JSON.stringify(backupData),
        )
      } catch (err) {
        console.warn(
          "Failed to write to localStorage backup (likely quota exceeded due to large quiz size):",
          err,
        )
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [
    isDirty,
    subject,
    description,
    folder,
    tags,
    salonImage,
    listingImage,
    podiumTheme,
    questions,
    quizzId,
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty) {
        saveQuizz({ silent: true })
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [isDirty, saveQuizz])

  useEffect(() => {
    if (!isConnected && isSaving) {
      setIsSaving(false)
      toast.error(
        t("errors:quizz.failedToSave") ||
          "Connexion perdue. Sauvegarde impossible.",
        {
          id: "quizz-save",
        },
      )
    }
  }, [isConnected, isSaving, t])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName.toLowerCase()
      const inTextField =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable === true

      if (inTextField) {
        return
      }

      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // ─── Annuler / Rétablir (Ctrl+Z / Ctrl+Y) ───
      if (ctrl && key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((ctrl && key === "y") || (ctrl && key === "z" && e.shiftKey)) {
        e.preventDefault()
        redo()
        return
      }

      // ─── Déplacement / Réorganisation (Ctrl+Flèche ou Alt+Flèche) ───
      if (
        (e.key === "ArrowUp" || e.key === "ArrowLeft") &&
        (ctrl || e.altKey)
      ) {
        if (currentIndex > 0) {
          e.preventDefault()
          reorderQuestions(currentIndex, currentIndex - 1)
        }
        return
      }
      if (
        (e.key === "ArrowDown" || e.key === "ArrowRight") &&
        (ctrl || e.altKey)
      ) {
        if (currentIndex < questions.length - 1) {
          e.preventDefault()
          reorderQuestions(currentIndex, currentIndex + 1)
        }
        return
      }

      // ─── Navigation entre slides (Flèches simples) ───
      // Ignoré si un élément du canvas est sélectionné : les flèches doivent
      // alors déplacer l'élément (géré localement dans SlideEditor), pas
      // changer de slide.
      if (selectedId) {
        return
      }

      if (
        (e.key === "ArrowUp" || e.key === "ArrowLeft") &&
        !ctrl &&
        !e.altKey &&
        !e.shiftKey
      ) {
        if (currentIndex > 0) {
          e.preventDefault()
          handleSetCurrentIndex(currentIndex - 1)
        }
        return
      }
      if (
        (e.key === "ArrowDown" || e.key === "ArrowRight") &&
        !ctrl &&
        !e.altKey &&
        !e.shiftKey
      ) {
        if (currentIndex < questions.length - 1) {
          e.preventDefault()
          handleSetCurrentIndex(currentIndex + 1)
        }
        return
      }
    }

    window.addEventListener("keydown", handler)

    return () => window.removeEventListener("keydown", handler)
  }, [
    undo,
    redo,
    currentIndex,
    questions.length,
    reorderQuestions,
    handleSetCurrentIndex,
    selectedId,
  ])

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
        podiumTheme,
        setSubject: wrappedSetSubject,
        setDescription: wrappedSetDescription,
        setFolder: wrappedSetFolder,
        setTags: wrappedSetTags,
        setSalonImage: wrappedSetSalonImage,
        setListingImage: wrappedSetListingImage,
        setPodiumTheme: wrappedSetPodiumTheme,
        questions,
        currentIndex,
        currentQuestion,
        setCurrentIndex: handleSetCurrentIndex,
        addQuestion,
        removeQuestion,
        reorderQuestions,
        duplicateQuestion,
        updateQuestion,
        importQuestions,
        applyToAllQuestions,
        changeQuestionType,
        selectedId,
        setSelectedId,
        selectedQuestionIds,
        setSelectedQuestionIds,
        selectSlide,
        saveQuizz,
        isDirty,
        isSaving,
        lastSaved,
        undo,
        redo,
        canUndo,
        canRedo,
        activeInspectorPanel,
        setActiveInspectorPanel,
      }}
    >
      {children}

      {/* Emergency Cache Recovery Prompt Modal */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-panel border-border animate-in fade-in zoom-in-95 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border shadow-2xl duration-200">
            {/* Header */}
            <div className="border-border text-primary flex items-center gap-2 border-b px-6 py-4">
              <RotateCcw className="size-5 shrink-0" />
              <h3 className="text-ink text-base font-bold">
                Restauration de session
              </h3>
            </div>
            {/* Body */}
            <div className="p-6 text-sm">
              <p className="text-ink-muted">
                Des modifications locales non sauvegardées ont été trouvées dans
                le cache de votre navigateur pour ce quiz. Souhaitez-vous
                restaurer votre travail précédent ?
              </p>
            </div>
            {/* Footer */}
            <div className="border-border bg-border/10 flex items-center justify-end gap-3 border-t px-6 py-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDiscardRestore}
              >
                Ignorer et supprimer
              </Button>
              <Button variant="primary" size="sm" onClick={handleApplyRestore}>
                Restaurer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conflit de sauvegarde : le quiz a été modifié ailleurs entre-temps */}
      {saveConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-panel border-border animate-in fade-in zoom-in-95 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border shadow-2xl duration-200">
            {/* Header */}
            <div className="border-border text-danger flex items-center gap-2 border-b px-6 py-4">
              <RotateCcw className="size-5 shrink-0" />
              <h3 className="text-ink text-base font-bold">
                Conflit de sauvegarde
              </h3>
            </div>
            {/* Body */}
            <div className="p-6 text-sm">
              <p className="text-ink-muted">{t("errors:quizz.conflict")}</p>
            </div>
            {/* Footer */}
            <div className="border-border bg-border/10 flex items-center justify-end gap-3 border-t px-6 py-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleConflictReload}
              >
                Recharger (perdre mes modifs)
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConflictOverwrite}
              >
                Écraser quand même
              </Button>
            </div>
          </div>
        </div>
      )}
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
