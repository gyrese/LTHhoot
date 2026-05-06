import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import Button from "@rahoot/web/components/Button"
import QuizzEditorCard from "@rahoot/web/features/quizz/components/QuizzEditorCard"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import clsx from "clsx"
import { Plus } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import SidebarContextMenu, { type SidebarAction } from "@rahoot/web/features/quizz/components/QuizzEditorSidebar/SidebarContextMenu"

const QuizzEditorSidebar = () => {
  const {
    questions,
    currentIndex,
    setCurrentIndex,
    addQuestion,
    removeQuestion,
    reorderQuestions,
    duplicateQuestion,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number; show: boolean } | null>(null)

  const isDragging = useRef(false)

  const handleSlideClick = (index: number) => () => {
    if (!isDragging.current) {
      setCurrentIndex(index)
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

  const handleContextMenu = (index: number) => (e: React.MouseEvent) => {
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
        if (index > 0) reorderQuestions(index, index - 1)
        break
      case "moveDown":
        if (index < questions.length - 1) reorderQuestions(index, index + 1)
        break
      case "changeBackground":
        setCurrentIndex(index)
        // This will show the background settings in the right sidebar
        break
    }
  }

  return (
    <aside className="z-10 flex w-72 shrink-0 flex-col gap-2 overflow-auto bg-white border-r border-gray-200 px-3 pb-3">
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
                      className={clsx(snapshot.isDragging && "shadow-lg")}
                    >
                      <QuizzEditorCard
                        question={q}
                        index={index}
                        isActive={currentIndex === index}
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

      <Button
        onClick={addQuestion}
        className="mt-1 flex items-center justify-center gap-1"
      >
        <Plus className="size-6" />
        {t("quizz:addQuestion")}
      </Button>

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
