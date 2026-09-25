import { SaveSession } from "@rahoot/web/features/quizz/utils/save-session"
import EditorDialog from "@rahoot/web/features/quizz/components/EditorDialog"
import type {
  AnswerReveal,
  DropPinZone,
  GridCell,
  PodiumThemeSetting,
  Question,
  QuestionMedia,
  QuestionType,
  QuizzWithId,
  SlideBackground,
  SlideElement,
} from "@rahoot/common/types/game"
import { quizzValidator } from "@rahoot/common/validators/quizz"
import {
  balancedColumns,
  DEFAULT_GRID_CELLS,
} from "@rahoot/web/features/quizz/utils/grid"
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
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { EVENTS } from "@rahoot/common/constants"
import toast from "react-hot-toast"
import { useBlocker } from "@tanstack/react-router"
import type { QuizSaveAck } from "@rahoot/common/types/game/socket"
import { useTranslation } from "react-i18next"
import Button from "@rahoot/web/components/Button"
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
  cells?: GridCell[]
  cellsPerRow?: number
  correctIndexes?: number[]
  revelationEnabled?: boolean
  revealDuration?: number
  gridCols?: number
  gridRows?: number
  revelationStyle?: string
  pointsMultiplier?: number
  id?: string
}

type QuizzEditorContextType = {
  quizzId: string | null
  subject: string
  publicName: string
  description: string
  folder: string
  tags: string[]
  salonImage?: string
  listingImage?: string
  podiumTheme?: PodiumThemeSetting
  setSubject: (_subject: string) => void
  setPublicName: (_publicName: string) => void
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
  saveQuizz: (_options?: {
    silent?: boolean
    navigate?: boolean
  }) => Promise<string | null>
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

// Le serveur fait foi une fois la sauvegarde confirmée : les brouillons locaux
// n'ont plus de raison d'être, et un localStorage indisponible ne doit pas
// transformer un enregistrement réussi en erreur.
const clearBackups = (backupKey: string, previousId?: string) => {
  try {
    localStorage.removeItem(backupKey)
    if (previousId) {
      localStorage.removeItem(`rahoot-backup-${previousId}`)
    }
  } catch {
    /* Saving on the server succeeded */
  }
}

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

    // Grille de 6 cases (répartie en 3×2) : l'hôte remplit les cases puis
    // désigne la ou les bonnes.
    case "grid":
      return {
        ...base,
        type: "grid",
        cellsPerRow: balancedColumns(DEFAULT_GRID_CELLS),
        cells: Array.from({ length: DEFAULT_GRID_CELLS }, () => ({
          image: "",
        })),
        correctIndexes: [0],
      }

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
  const { t } = useTranslation()

  const [subject, setSubject] = useState(
    initialData?.subject ?? "Untitled Quizz",
  )
  const [publicName, setPublicName] = useState(initialData?.publicName ?? "")
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
  const saveSession = useRef(new SaveSession())
  const dirtyRef = useRef(false)
  const [creationId] = useState(() => {
    try {
      const id = sessionStorage.getItem("quiz-draft-id") || generateId()
      sessionStorage.setItem("quiz-draft-id", id)
      return id
    } catch {
      return generateId()
    }
  })
  const [backupKey] = useState(() => {
    let clientId = "local"
    try {
      clientId = localStorage.getItem("client_id") || clientId
    } catch {
      /* Storage unavailable */
    }
    return `rahoot-backup-${clientId}-${initialData?.id ?? creationId}`
  })
  useBlocker({
    enableBeforeUnload: () => dirtyRef.current,
    shouldBlockFn: () => {
      if (!dirtyRef.current) {
        return false
      }
      // eslint-disable-next-line no-alert
      return !window.confirm(
        "Des modifications ne sont pas enregistrées sur le serveur. Quitter l'éditeur ?",
      )
    },
  })

  const currentQuestion =
    questions[currentIndex] ||
    questions[Math.max(0, questions.length - 1)] ||
    questions[0]

  const markDirty = () => {
    saveSession.current.change()
    dirtyRef.current = true
    setIsDirty(true)
  }

  const wrappedSetSubject = (val: string) => {
    setSubject(val)
    markDirty()
  }
  const wrappedSetPublicName = (val: string) => {
    setPublicName(val)
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

      if (!clickedId) {
        return
      }

      setSelectedQuestionIds((prevSelected) => {
        if (ctrlKey) {
          if (prevSelected.includes(clickedId)) {
            const nextSelected = prevSelected.filter((id) => id !== clickedId)

            if (nextSelected.length === 0) {
              return [clickedId]
            }

            return nextSelected
          }

          return [...prevSelected, clickedId]
        } else if (shiftKey) {
          const start = Math.min(currentIndex, index)
          const end = Math.max(currentIndex, index)
          const rangeIds = questions.slice(start, end + 1).map((q) => q.id)

          return rangeIds
        }

        return [clickedId]
      })

      handleSetCurrentIndex(index)
    },
    [questions, currentIndex, handleSetCurrentIndex],
  )

  // ─── Undo / Redo ────────────────────────────────────────────────────────────

  type Snapshot = {
    questions: QuestionWithId[]
    subject: string
    publicName: string
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

  const historySelectionRef = useRef({ currentIndex, selectedQuestionIds })
  historySelectionRef.current = { currentIndex, selectedQuestionIds }

  const takeSnapshot = useCallback(
    (): Snapshot => ({
      questions,
      subject,
      publicName,
      description,
      folder,
      tags,
      salonImage,
      listingImage,
      podiumTheme,
      ...historySelectionRef.current,
    }),
    [
      questions,
      subject,
      publicName,
      description,
      folder,
      tags,
      salonImage,
      listingImage,
      podiumTheme,
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
    publicName,
    description,
    folder,
    tags,
    salonImage,
    listingImage,
    podiumTheme,
    takeSnapshot,
  ])

  const applySnapshot = (s: Snapshot) => {
    isApplyingHistoryRef.current = true
    setQuestions(s.questions)
    setSubject(s.subject)
    setPublicName(s.publicName)
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
    markDirty()
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

    if (!draggedId) {
      return
    }

    const idsToMove = selectedQuestionIds.includes(draggedId)
      ? questions
          .filter((q) => selectedQuestionIds.includes(q.id))
          .map((q) => q.id)
      : [draggedId]

    setQuestions((prev) => {
      const movingQuestions = prev.filter((q) => idsToMove.includes(q.id))
      const remaining = prev.filter((q) => !idsToMove.includes(q.id))
      const draggedIndexInMoving = movingQuestions.findIndex(
        (q) => q.id === draggedId,
      )
      const targetOffset =
        draggedIndexInMoving !== -1 ? draggedIndexInMoving : 0
      const insertIndex = Math.max(
        0,
        Math.min(remaining.length, to - targetOffset),
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
    const question = questions[index]
    if (!question || question.type === type) {
      return
    }

    if (
      // eslint-disable-next-line no-alert -- garde-fou volontaire : le changement de type détruit les réponses saisies
      !window.confirm(
        "Changer de type remplacera les réponses de cette question. Continuer ?",
      )
    ) {
      return
    }
    flushPendingHistoryPush()
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) {
          return q
        }
        const converted = buildDefaultForType(q, type)
        return {
          ...converted,
          difficulty: q.difficulty,
          suddenDeath: q.suddenDeath,
          pointsMultiplier: q.pointsMultiplier,
          revelationEnabled: q.revelationEnabled,
          revealDuration: q.revealDuration,
          gridCols: q.gridCols,
          gridRows: q.gridRows,
          revelationStyle: q.revelationStyle,
        }
      }),
    )
    markDirty()
  }

  const saveQuizz = useCallback(
    async (options?: {
      silent?: boolean
      navigate?: boolean
      force?: boolean
    }): Promise<string | null> => {
      if (saveSession.current.saving || (saveConflict && !options?.force)) {
        return null
      }
      if (!socket || !isConnected) {
        if (!options?.silent) {
          toast.error("Connexion perdue. Le brouillon reste local.", {
            id: "quizz-save",
          })
        }
        return null
      }
      const result = quizzValidator.safeParse({
        subject,
        publicName: publicName.trim() || undefined,
        description: description || undefined,
        folder: folder || undefined,
        tags: tags.length ? tags : undefined,
        salonImage,
        listingImage,
        podiumTheme,
        questions,
        updatedAt: options?.force ? undefined : updatedAt,
      })
      if (!result.success) {
        if (!options?.silent) {
          const [first] = result.error.issues
          if (
            first.path[0] === "questions" &&
            typeof first.path[1] === "number"
          ) {
            handleSetCurrentIndex(first.path[1])
          }
          toast.error(t(first.message, first.message), { id: "quizz-save" })
        }
        return null
      }
      const sentRevision = saveSession.current.begin()
      if (sentRevision === null) {
        return null
      }
      setIsSaving(true)
      if (!options?.silent) {
        toast.loading(t("quizz:saving"), { id: "quizz-save" })
      }
      try {
        const response = await new Promise<QuizSaveAck>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Sauvegarde non confirmée. Réessayez.")),
            15000,
          )
          const ack = (value: QuizSaveAck) => {
            clearTimeout(timer)
            resolve(value)
          }
          if (quizzId) {
            socket.emit(
              EVENTS.QUIZZ.UPDATE,
              { id: quizzId, ...result.data },
              ack,
            )
          } else {
            socket.emit(EVENTS.QUIZZ.SAVE, { ...result.data, creationId }, ack)
          }
        })
        if ("error" in response) {
          throw new Error(response.error)
        }
        setQuizzId(response.id)
        setUpdatedAt(response.updatedAt)
        setLastSaved(new Date())
        const currentSaved = saveSession.current.complete(
          sentRevision,
          response.replayed,
        )
        dirtyRef.current = !currentSaved
        setIsDirty(!currentSaved)
        if (currentSaved) {
          clearBackups(backupKey, initialData?.id)
        }
        if (!options?.silent) {
          toast.success(
            currentSaved
              ? t("quizz:quizzSaved")
              : "Version enregistrée ; de nouvelles modifications restent à sauvegarder.",
            { id: "quizz-save" },
          )
        }
        return currentSaved ? response.id : null
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "errors:quizz.failedToSave"
        if (message === "errors:quizz.conflict") {
          setSaveConflict(true)
        }
        toast.error(t(message, message), { id: "quizz-save" })
        return null
      } finally {
        saveSession.current.fail()
        setIsSaving(false)
      }
    },
    [
      socket,
      isConnected,
      subject,
      publicName,
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
      saveConflict,
      creationId,
      backupKey,
    ],
  )

  const handleConflictOverwrite = () => {
    setSaveConflict(false)
    void saveQuizz({ force: true })
  }

  const handleConflictReload = () => {
    // Retain the local copy until the user explicitly discards it on reload.
    window.location.reload()
  }

  // Backups may contain incomplete questions: restore drafts without applying
  // the playable schema, but reject malformed storage before using it as state.
  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(backupKey) ??
        (initialData?.id
          ? localStorage.getItem(`rahoot-backup-${initialData.id}`)
          : null)
      if (raw) {
        const backup = JSON.parse(raw)
        if (
          Array.isArray(backup.questions) &&
          backup.questions.length &&
          backup.questions.every(
            (q: unknown) =>
              q &&
              typeof q === "object" &&
              typeof (q as Question).type === "string",
          )
        ) {
          setPendingRestore(backup)
        }
      }
    } catch {
      toast.error("Le brouillon local ne peut pas être lu.")
    }
  }, [backupKey])

  const handleApplyRestore = () => {
    if (pendingRestore) {
      if (pendingRestore.subject !== undefined) {
        setSubject(pendingRestore.subject)
      }

      if (pendingRestore.publicName !== undefined) {
        setPublicName(pendingRestore.publicName)
      }

      if (pendingRestore.description !== undefined) {
        setDescription(pendingRestore.description)
      }

      if (pendingRestore.folder !== undefined) {
        setFolder(pendingRestore.folder)
      }

      if (pendingRestore.tags !== undefined) {
        setTags(pendingRestore.tags)
      }

      if (pendingRestore.salonImage !== undefined) {
        setSalonImage(pendingRestore.salonImage)
      }

      if (pendingRestore.listingImage !== undefined) {
        setListingImage(pendingRestore.listingImage)
      }

      if (pendingRestore.podiumTheme !== undefined) {
        setPodiumTheme(pendingRestore.podiumTheme)
      }

      if (pendingRestore.questions !== undefined) {
        setQuestions(pendingRestore.questions.map(toQuestionWithId))
      }

      setSalonImage(pendingRestore.salonImage)
      setListingImage(pendingRestore.listingImage)
      setPodiumTheme(pendingRestore.podiumTheme)
      if (typeof pendingRestore.savedId === "string") {
        setQuizzId(pendingRestore.savedId)
      }
      if (typeof pendingRestore.baseUpdatedAt === "number") {
        setUpdatedAt(pendingRestore.baseUpdatedAt)
      } else if (initialData?.id) {
        setSaveConflict(true)
      }
      markDirty()
      toast.success("Modifications restaurées depuis le cache local.")
    }

    setPendingRestore(null)
  }

  const handleDiscardRestore = () => {
    try {
      localStorage.removeItem(backupKey)
      if (initialData?.id) {
        localStorage.removeItem(`rahoot-backup-${initialData.id}`)
      }
    } catch {
      /* Unavailable storage */
    }
    setPendingRestore(null)
  }

  const backupRef = useRef<() => void>(() => undefined)
  backupRef.current = () => {
    if (!dirtyRef.current || pendingRestore) {
      return
    }
    try {
      localStorage.setItem(
        backupKey,
        JSON.stringify({
          savedId: quizzId,
          baseUpdatedAt: updatedAt,
          subject,
          publicName,
          description,
          folder,
          tags,
          salonImage,
          listingImage,
          podiumTheme,
          questions: questions.map(({ id: _id, ...q }) => q),
        }),
      )
    } catch {
      toast.error(
        "Le stockage local est plein ou indisponible. Enregistrez sur le serveur ou exportez le quiz.",
        { id: "quiz-backup-error" },
      )
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => backupRef.current(), 400)
    return () => clearTimeout(timer)
  }, [
    subject,
    publicName,
    description,
    folder,
    tags,
    salonImage,
    listingImage,
    podiumTheme,
    questions,
  ])

  const autosaveRef = useRef<() => void>(() => undefined)
  autosaveRef.current = () => {
    if (dirtyRef.current && !pendingRestore && !saveConflict) {
      void saveQuizz({ silent: true })
    }
  }
  useEffect(() => {
    const localTimer = setInterval(() => backupRef.current(), 3000)
    const serverTimer = setInterval(() => autosaveRef.current(), 10000)
    const flush = () => backupRef.current()
    window.addEventListener("beforeunload", flush)
    document.addEventListener("visibilitychange", flush)
    return () => {
      flush()
      if (!dirtyRef.current && !initialData) {
        try {
          sessionStorage.removeItem("quiz-draft-id")
        } catch {
          /* Unavailable */
        }
      }
      clearInterval(localTimer)
      clearInterval(serverTimer)
      window.removeEventListener("beforeunload", flush)
      document.removeEventListener("visibilitychange", flush)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName.toLowerCase()
      const inTextField =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable === true

      if (
        e.defaultPrevented ||
        inTextField ||
        document.querySelector("[aria-modal=true], dialog[open]")
      ) {
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
        publicName,
        description,
        folder,
        tags,
        salonImage,
        listingImage,
        podiumTheme,
        setSubject: wrappedSetSubject,
        setPublicName: wrappedSetPublicName,
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
        <EditorDialog label="Restauration de session">
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
        </EditorDialog>
      )}

      {/* Conflit de sauvegarde : le quiz a été modifié ailleurs entre-temps */}
      {saveConflict && (
        <EditorDialog label="Conflit de sauvegarde">
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
        </EditorDialog>
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
