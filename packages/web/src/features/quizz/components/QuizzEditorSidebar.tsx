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
import { Plus, Layers } from "lucide-react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

const QuizzEditorSidebar = () => {
  const {
    questions,
    currentIndex,
    setCurrentIndex,
    addQuestion,
    removeQuestion,
    reorderQuestions,
  } = useQuizzEditor()
  const { t } = useTranslation()

  const isDragging = useRef(false)

  const handleSlideClick = (index: number) => () => {
    if (!isDragging.current) {
      setCurrentIndex(index)
    }
  }

  const handleDelete = (index: number) => () => {
    removeQuestion(index)
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

  return (
    <aside className="z-10 flex w-72 shrink-0 flex-col gap-2 overflow-auto bg-white p-3 shadow-sm">
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

      {/* Layers Panel */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex-1 overflow-auto">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <Layers className="size-4" />
          Calques (Slide {currentIndex + 1})
        </h3>
        <div className="flex flex-col gap-1.5">
          {[...(questions[currentIndex]?.elements || [])].reverse().map((el, i) => (
            <div key={el.id} className="text-xs p-2 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="font-medium capitalize text-gray-700">{el.type}</span>
                {el.type === "text" && <span className="text-gray-500 truncate">"{el.text}"</span>}
              </div>
              <span className="text-gray-400 shrink-0 text-[10px]">z-index: {questions[currentIndex]?.elements?.length! - i - 1}</span>
            </div>
          ))}
          {(!questions[currentIndex]?.elements || questions[currentIndex]?.elements?.length === 0) && (
            <p className="text-xs text-gray-400 italic text-center py-4">Aucun calque</p>
          )}
        </div>
      </div>
    </aside>
  )
}

export default QuizzEditorSidebar
