import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import QuizzEditorCard from "@rahoot/web/features/quizz/components/QuizzEditorCard"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Plus } from "lucide-react"
import { type MouseEvent, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import SidebarContextMenu, {
  type SidebarAction,
} from "@rahoot/web/features/quizz/components/QuizzEditorSidebar/SidebarContextMenu"

const QuizzEditorSidebar = () => {
  const {
    questions,
    currentIndex,
    setCurrentIndex,
    selectedQuestionIds,
    selectSlide,
    addQuestion,
    removeQuestion,
    reorderQuestions,
    duplicateQuestion,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    index: number
    show: boolean
  } | null>(null)

  const isDragging = useRef(false)

  const handleSlideClick = (index: number) => (e: MouseEvent) => {
    if (!isDragging.current) {
      selectSlide(index, e.ctrlKey || e.metaKey, e.shiftKey)
    }
  }

  const handleDelete = (index: number) => () => {
    removeQuestion(index)
  }

  const handleDuplicate = (index: number) => () => {
    duplicateQuestion(index)
  }

  const handleDragEnd = (result: DropResult) => {
    isDragging.current = false

    if (
      !result.destination ||
      result.destination.index === result.source.index
    ) {
      return
    }

    reorderQuestions(result.source.index, result.destination.index)
  }

  const handleContextMenu = (index: number) => (e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, index, show: true })
  }

  const handleSidebarAction = (action: SidebarAction, index: number) => {
    switch (action) {
      case "add":
        addQuestion()

        // Wait for state update then select it? addQuestion usually handles selection
        break

      case "duplicate":
        duplicateQuestion(index)

        break

      case "delete":
        removeQuestion(index)

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

      case "changeBackground":
        setCurrentIndex(index)

        // This will show the background settings in the right sidebar
        break
    }
  }

  return (
    <aside className="border-border bg-panel z-10 flex w-72 shrink-0 flex-col border-r">
      <div className="border-border/70 flex shrink-0 items-center justify-between border-b px-4 py-3">
        <span className="text-ink-muted text-xs font-bold">
          {t("quizz:slidesTitle", "Diapositives")}
        </span>
        <span className="bg-border/60 text-ink-muted rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
          {questions.length}
        </span>
      </div>

      <div className="scrollbar-light flex-1 overflow-auto px-3 py-3">
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
                {questions.map((q, index) => (
                  <Draggable key={q.id} draggableId={q.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={clsx(
                          "ease-out-soft rounded-lg transition-shadow duration-150",
                          snapshot.isDragging && "shadow-2xl shadow-black/25",
                        )}
                      >
                        <QuizzEditorCard
                          question={q}
                          index={index}
                          isActive={currentIndex === index}
                          isSelected={selectedQuestionIds.includes(q.id)}
                          canDelete={questions.length > 1}
                          onClick={handleSlideClick(index)}
                          onDelete={handleDelete(index)}
                          onDuplicate={handleDuplicate(index)}
                          onContextMenu={handleContextMenu(index)}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="border-border/70 shrink-0 border-t p-3">
        <button
          onClick={addQuestion}
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
          onClose={() => setContextMenu(null)}
          onAction={handleSidebarAction}
        />
      )}
    </aside>
  )
}

export default QuizzEditorSidebar
