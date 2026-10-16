import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import QuizzEditorCard from "@rahoot/web/features/quizz/components/QuizzEditorCard"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import type { QuestionType } from "@rahoot/common/types/game"
import clsx from "clsx"
import {
  ChevronDown,
  Copy,
  GripVertical,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import {
  type MouseEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import EditorDialog from "@rahoot/web/features/quizz/components/EditorDialog"
import SidebarContextMenu, {
  type SidebarAction,
} from "@rahoot/web/features/quizz/components/QuizzEditorSidebar/SidebarContextMenu"

const QUESTION_TYPES: QuestionType[] = [
  "title",
  "mcq",
  "true_false",
  "open",
  "date",
  "slider",
  "puzzle",
  "drop_pin",
  "image_sequence",
  "grid",
]

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()

const QuizzEditorSidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const {
    questions,
    currentIndex,
    setCurrentIndex,
    selectedQuestionIds,
    setSelectedQuestionIds,
    selectSlide,
    addQuestion,
    removeQuestion,
    removeQuestions,
    reorderQuestions,
    duplicateQuestion,
    duplicateQuestions,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    index: number
    show: boolean
    returnFocusTo: HTMLElement | null
  } | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<
    string[] | null
  >(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [query, setQuery] = useState("")
  const [navigationOpen, setNavigationOpen] = useState(false)
  const navigationId = useId()
  const [typeFilter, setTypeFilter] = useState<QuestionType | "all">("all")
  const hasFilter = query.trim() !== "" || typeFilter !== "all"
  const filteredQuestions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim())
    return questions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => {
        if (typeFilter !== "all" && question.type !== typeFilter) {
          return false
        }
        if (!normalizedQuery) {
          return true
        }
        return (
          normalizeSearch(question.question ?? "").includes(normalizedQuery) ||
          String(index + 1) === normalizedQuery
        )
      })
  }, [questions, query, typeFilter])
  const visibleSelectedIds = filteredQuestions
    .filter(({ question }) => selectedQuestionIds.includes(question.id))
    .map(({ question }) => question.id)
  const hiddenSelectionCount =
    selectedQuestionIds.length - visibleSelectedIds.length
  const showBulkActions = selectionMode || selectedQuestionIds.length > 1

  const isDragging = useRef(false)
  const activeCardRef = useRef<HTMLDivElement>(null)
  const questionButtons = useRef(new Map<string, HTMLButtonElement>())
  const keyboardAnchor = useRef<string | null>(null)
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    activeCardRef.current?.scrollIntoView?.({ block: "nearest" })
  }, [currentIndex, questions.length])

  const handleSlideClick = (index: number) => (e: MouseEvent) => {
    if (!isDragging.current) {
      if (selectionMode) {
        toggleSelected(questions[index].id)
        return
      }
      if (!e.shiftKey) {
        keyboardAnchor.current = questions[index].id
      }
      selectSlide(index, e.ctrlKey || e.metaKey, e.shiftKey)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        onNavigate?.()
      }
    }
  }

  const handleQuestionKeyDown =
    (id: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      const position = filteredQuestions.findIndex(
        ({ question }) => question.id === id,
      )
      if (position < 0) {
        return
      }

      let nextPosition = position
      if (event.key === "ArrowDown") {
        nextPosition += 1
      } else if (event.key === "ArrowUp") {
        nextPosition -= 1
      } else if (event.key === "Home") {
        nextPosition = 0
      } else if (event.key === "End") {
        nextPosition = filteredQuestions.length - 1
      } else {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      nextPosition = Math.max(
        0,
        Math.min(nextPosition, filteredQuestions.length - 1),
      )
      const target = filteredQuestions[nextPosition]
      questionButtons.current.get(target.question.id)?.focus()

      if (event.shiftKey) {
        const anchorPosition = filteredQuestions.findIndex(
          ({ question }) => question.id === keyboardAnchor.current,
        )
        const start = anchorPosition >= 0 ? anchorPosition : position
        if (anchorPosition < 0) {
          keyboardAnchor.current = id
        }
        setSelectedQuestionIds(
          filteredQuestions
            .slice(
              Math.min(start, nextPosition),
              Math.max(start, nextPosition) + 1,
            )
            .map(({ question }) => question.id),
        )
        setCurrentIndex(target.index)
      } else {
        keyboardAnchor.current = target.question.id
        if (selectionMode) {
          setCurrentIndex(target.index)
        } else {
          selectSlide(target.index, false, false)
        }
      }
    }

  const handleDelete = (index: number) => () => {
    setPendingDeleteId(questions[index]?.id ?? null)
  }

  const handleDuplicate = (index: number) => () => {
    duplicateQuestion(index)
  }

  const handleDragEnd = (result: DropResult) => {
    isDragging.current = false

    if (
      hasFilter ||
      selectionMode ||
      !result.destination ||
      result.destination.index === result.source.index
    ) {
      return
    }

    reorderQuestions(result.source.index, result.destination.index)
  }

  const handleContextMenu = (index: number) => (e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      index,
      show: true,
      returnFocusTo: questionButtons.current.get(questions[index].id) ?? null,
    })
  }

  const handleMoreClick =
    (index: number) => (event: MouseEvent<HTMLButtonElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect()
      setContextMenu({
        x: bounds.right,
        y: bounds.bottom,
        index,
        show: true,
        returnFocusTo: event.currentTarget,
      })
    }

  const handleSidebarAction = (action: SidebarAction, index: number) => {
    switch (action) {
      case "add":
        setQuery("")
        setTypeFilter("all")
        addQuestion()

        // Wait for state update then select it? addQuestion usually handles selection
        break

      case "duplicate":
        duplicateQuestion(index)

        break

      case "delete":
        setPendingDeleteId(questions[index]?.id ?? null)

        break

      case "moveUp":
        if (index > 0) {
          reorderQuestions(index, index - 1)
        }

        break

      case "moveDown":
        if (index < questions.length - 1) {
          reorderQuestions(index, index + 1)
        }

        break
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedQuestionIds(
      selectedQuestionIds.includes(id)
        ? selectedQuestionIds.filter((selectedId) => selectedId !== id)
        : [...selectedQuestionIds, id],
    )
  }

  const finishSelection = () => {
    setSelectionMode(false)
    setSelectedQuestionIds(
      questions[currentIndex] ? [questions[currentIndex].id] : [],
    )
  }

  return (
    <aside
      aria-label={t("quizz:slidesTitle")}
      className="border-border bg-panel z-10 flex w-72 shrink-0 flex-col border-r"
    >
      <div className="border-border/70 flex shrink-0 items-center justify-between border-b px-4 py-3">
        <span className="text-ink-muted text-xs font-bold">
          {t("quizz:slidesTitle", "Diapositives")}
        </span>
        <div className="flex items-center gap-2">
          <span className="bg-border/60 text-ink-muted rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
            {questions.length}
          </span>
          <button
            type="button"
            onClick={() =>
              selectionMode ? finishSelection() : setSelectionMode(true)
            }
            className="focus-ring text-primary hover:bg-primary-soft rounded px-1.5 py-1 text-xs font-semibold"
          >
            {selectionMode
              ? t("quizz:sidebar.doneSelecting")
              : t("quizz:sidebar.selectMultiple")}
          </button>
        </div>
      </div>

      <div className="border-border/70 shrink-0 border-b px-3 py-1.5">
        <button
          type="button"
          aria-expanded={navigationOpen}
          aria-controls={navigationOpen ? navigationId : undefined}
          onClick={() => setNavigationOpen((open) => !open)}
          className="focus-ring text-ink-muted hover:bg-surface flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-xs font-semibold"
        >
          <Search aria-hidden="true" className="size-3.5 shrink-0" />
          {t("quizz:sidebar.navigationTools")}
          {hasFilter && (
            <span className="text-primary-ink ml-auto text-[11px] tabular-nums">
              {filteredQuestions.length}/{questions.length}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={clsx(
              "size-3.5 shrink-0",
              !hasFilter && "ml-auto",
              navigationOpen && "rotate-180",
            )}
          />
        </button>
        {navigationOpen && (
          <div id={navigationId} className="flex flex-col gap-2 pt-2 pb-1.5">
            <div className="border-border bg-surface focus-within:border-primary flex items-center gap-2 rounded-lg border px-2.5">
              <Search
                aria-hidden="true"
                className="text-ink-muted size-4 shrink-0"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("quizz:sidebar.searchPlaceholder")}
                aria-label={t("quizz:sidebar.search")}
                className="text-ink placeholder:text-ink-subtle min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="text-ink-muted mb-1 block text-[11px] font-semibold">
                  {t("quizz:sidebar.typeFilter")}
                </span>
                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as QuestionType | "all")
                  }
                  className="focus-ring border-border bg-surface text-ink w-full rounded-lg border px-2 py-1.5 text-xs"
                >
                  <option value="all">{t("quizz:sidebar.allTypes")}</option>
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(
                        `quizz:questionType.${type === "title" ? "title_slide" : type}`,
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="text-ink-muted mb-1 block text-[11px] font-semibold">
                  {t("quizz:sidebar.quickJump")}
                </span>
                <select
                  value={currentIndex}
                  onChange={(event) => {
                    selectSlide(Number(event.target.value), false, false)
                    onNavigate?.()
                  }}
                  className="focus-ring border-border bg-surface text-ink w-full rounded-lg border px-2 py-1.5 text-xs"
                >
                  {questions.map((question, index) => (
                    <option key={question.id} value={index}>
                      {index + 1}.{" "}
                      {question.question?.trim() ||
                        t(
                          `quizz:questionType.${question.type === "title" ? "title_slide" : question.type}`,
                        )}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {hasFilter && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted text-xs" role="status">
                    {t("quizz:sidebar.resultCount", {
                      count: filteredQuestions.length,
                      total: questions.length,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("")
                      setTypeFilter("all")
                    }}
                    className="focus-ring text-primary hover:bg-primary-soft flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold"
                  >
                    <X className="size-3" />
                    {t("quizz:sidebar.clearFilters")}
                  </button>
                </div>
                <p className="text-ink-subtle mt-1 text-[11px]">
                  {t("quizz:sidebar.reorderHint")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {showBulkActions && (
        <div className="border-border/70 bg-primary-soft shrink-0 border-b px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-primary-ink text-xs">
              {t("quizz:sidebar.selectedCount", {
                count: visibleSelectedIds.length,
              })}
            </strong>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedQuestionIds(
                    filteredQuestions.map(({ question }) => question.id),
                  )
                }
                className="focus-ring text-primary-ink rounded px-1 py-1 text-xs font-semibold underline"
              >
                {t("quizz:sidebar.selectVisible")}
              </button>
              <button
                type="button"
                onClick={() => setSelectedQuestionIds([])}
                className="focus-ring text-primary-ink rounded px-1 py-1 text-xs font-semibold underline"
              >
                {t("quizz:sidebar.clearSelection")}
              </button>
            </div>
          </div>
          {hiddenSelectionCount > 0 && (
            <p className="text-primary-ink/70 mt-1 text-[11px]">
              {t("quizz:sidebar.hiddenSelection", {
                count: hiddenSelectionCount,
              })}
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={visibleSelectedIds.length === 0}
              onClick={() => {
                const ids = [...visibleSelectedIds]
                setQuery("")
                setTypeFilter("all")
                setSelectionMode(false)
                duplicateQuestions(ids)
              }}
              className="focus-ring border-border bg-surface text-ink hover:bg-panel flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              <Copy className="size-3.5" />
              {t("quizz:sidebar.duplicateSelected")}
            </button>
            <button
              type="button"
              disabled={
                visibleSelectedIds.length === 0 ||
                visibleSelectedIds.length >= questions.length
              }
              onClick={() => setPendingBulkDeleteIds([...visibleSelectedIds])}
              title={
                visibleSelectedIds.length >= questions.length
                  ? t("quizz:sidebar.keepOneQuestion")
                  : undefined
              }
              className="focus-ring border-danger/30 bg-surface text-danger hover:bg-danger-soft flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
              {t("quizz:sidebar.deleteSelected")}
            </button>
          </div>
          {visibleSelectedIds.length >= questions.length && (
            <p className="text-ink-muted mt-1 text-[11px]">
              {t("quizz:sidebar.keepOneQuestion")}
            </p>
          )}
        </div>
      )}

      <div
        data-editor-question-list
        className="scrollbar-light flex-1 overflow-auto px-3 py-3"
      >
        {filteredQuestions.length === 0 && (
          <p className="text-ink-muted py-8 text-center text-sm">
            {t("quizz:sidebar.noResults")}
          </p>
        )}
        <DragDropContext
          onDragStart={() => {
            isDragging.current = true
          }}
          onDragEnd={handleDragEnd}
        >
          <Droppable droppableId="questions">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-col gap-2"
              >
                {filteredQuestions.map(
                  ({ question: q, index }, visibleIndex) => (
                    <Draggable
                      key={q.id}
                      draggableId={q.id}
                      index={visibleIndex}
                      isDragDisabled={hasFilter || selectionMode}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={clsx(
                            "ease-out-soft flex items-start gap-1.5 rounded-lg transition-shadow duration-150",
                            snapshot.isDragging && "shadow-2xl shadow-black/25",
                          )}
                        >
                          <div
                            {...provided.dragHandleProps}
                            aria-label={t("quizz:sidebar.reorderQuestion", {
                              number: index + 1,
                            })}
                            className={clsx(
                              "focus-ring text-ink-muted flex w-6 shrink-0 flex-col items-center gap-1 rounded-md py-2",
                              hasFilter || selectionMode
                                ? "cursor-default opacity-60"
                                : "hover:bg-surface hover:text-ink cursor-grab active:cursor-grabbing",
                            )}
                          >
                            {!hasFilter && !selectionMode && (
                              <GripVertical className="size-4" />
                            )}
                            <span className="text-[11px] font-bold tabular-nums">
                              {index + 1}
                            </span>
                          </div>
                          <div
                            ref={
                              currentIndex === index ? activeCardRef : undefined
                            }
                            className="min-w-0 flex-1"
                          >
                            <QuizzEditorCard
                              question={q}
                              index={index}
                              isActive={currentIndex === index}
                              isSelected={selectedQuestionIds.includes(q.id)}
                              showSelection={showBulkActions}
                              canDelete={questions.length > 1}
                              menuOpen={contextMenu?.index === index}
                              onClick={handleSlideClick(index)}
                              onKeyDown={handleQuestionKeyDown(q.id)}
                              buttonRef={(node) => {
                                if (node) {
                                  questionButtons.current.set(q.id, node)
                                } else {
                                  questionButtons.current.delete(q.id)
                                }
                              }}
                              onDelete={handleDelete(index)}
                              onDuplicate={handleDuplicate(index)}
                              onToggleSelection={() => toggleSelected(q.id)}
                              onMore={handleMoreClick(index)}
                              onContextMenu={handleContextMenu(index)}
                            />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ),
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="border-border/70 shrink-0 border-t p-3">
        <button
          onClick={() => {
            setQuery("")
            setTypeFilter("all")
            addQuestion()
          }}
          className="focus-ring border-border-strong text-ink-muted hover:border-primary hover:bg-primary-soft hover:text-primary-ink ease-out-soft flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-2.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98]"
        >
          <Plus className="size-4" />
          {t("quizz:addQuestion")}
        </button>
      </div>

      {contextMenu?.show && (
        <SidebarContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          index={contextMenu.index}
          canDelete={questions.length > 1}
          canMoveUp={contextMenu.index > 0}
          canMoveDown={contextMenu.index < questions.length - 1}
          returnFocusTo={contextMenu.returnFocusTo}
          onClose={closeContextMenu}
          onAction={handleSidebarAction}
        />
      )}
      {pendingDeleteId && (
        <EditorDialog
          label={t("quizz:question.deleteQuestion")}
          onClose={() => setPendingDeleteId(null)}
          returnFocusTo={() =>
            questionButtons.current.get(pendingDeleteId) ??
            questionButtons.current.values().next().value
          }
        >
          <div className="bg-surface flex flex-col gap-4 p-5">
            <h2 className="text-ink text-base font-semibold">
              {t("quizz:question.deleteQuestion")}
            </h2>
            <p className="text-ink-muted text-sm">
              {t("quizz:question.deleteQuestionConfirm")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPendingDeleteId(null)}
                className="focus-ring border-border text-ink-muted rounded-lg border px-3 py-2 text-sm"
              >
                {t("common:cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const index = questions.findIndex(
                    (question) => question.id === pendingDeleteId,
                  )
                  if (index >= 0 && questions.length > 1) {
                    removeQuestion(index)
                  }
                  setPendingDeleteId(null)
                }}
                className="focus-ring bg-danger rounded-lg px-3 py-2 text-sm font-semibold text-white"
              >
                {t("common:delete")}
              </button>
            </div>
          </div>
        </EditorDialog>
      )}
      {pendingBulkDeleteIds && (
        <EditorDialog
          label={t("quizz:sidebar.confirmDeleteTitle", {
            count: pendingBulkDeleteIds.length,
          })}
          onClose={() => setPendingBulkDeleteIds(null)}
          returnFocusTo={() =>
            questionButtons.current.get(questions[currentIndex]?.id) ??
            questionButtons.current.values().next().value
          }
        >
          <div className="bg-surface flex flex-col gap-4 p-5">
            <h2 className="text-ink text-base font-semibold">
              {t("quizz:sidebar.confirmDeleteTitle", {
                count: pendingBulkDeleteIds.length,
              })}
            </h2>
            <p className="text-ink-muted text-sm">
              {t("quizz:sidebar.confirmDeleteDescription")}
            </p>
            <ul className="text-ink-muted max-h-36 list-inside list-disc overflow-auto text-xs">
              {questions
                .map((question, index) => ({ question, index }))
                .filter(({ question }) =>
                  pendingBulkDeleteIds.includes(question.id),
                )
                .map(({ question, index }) => (
                  <li key={question.id} className="truncate">
                    {question.question?.trim() ||
                      t("quizz:sidebar.untitledQuestion", {
                        number: index + 1,
                      })}
                  </li>
                ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPendingBulkDeleteIds(null)}
                className="focus-ring border-border text-ink-muted rounded-lg border px-3 py-2 text-sm"
              >
                {t("common:cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  removeQuestions(pendingBulkDeleteIds)
                  setPendingBulkDeleteIds(null)
                  setSelectionMode(false)
                }}
                className="focus-ring bg-danger rounded-lg px-3 py-2 text-sm font-semibold text-white"
              >
                {t("common:delete")}
              </button>
            </div>
          </div>
        </EditorDialog>
      )}
    </aside>
  )
}

export default QuizzEditorSidebar
