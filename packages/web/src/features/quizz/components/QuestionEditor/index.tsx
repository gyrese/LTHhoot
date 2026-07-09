import QuestionEditorAnswers from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorAnswers"
import QuestionEditorConfig from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig"
import QuestionEditorDate from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDate"
import QuestionEditorDropPin from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDropPin"
import QuestionEditorImageSequence from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorImageSequence"
import QuestionEditorOpen from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorOpen"
import QuestionEditorPuzzle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorPuzzle"
import QuestionEditorSlider from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorSlider"
import QuestionEditorTitle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTitle"
import QuestionEditorTrueFalse from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTrueFalse"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"

import SlideEditor from "@rahoot/web/features/quizz/components/SlideEditor"

const QuestionAnswerEditor = () => {
  const { currentQuestion } = useQuizzEditor()

  if (!currentQuestion) {
    return null
  }

  switch (currentQuestion.type) {
    case "mcq":
      return <QuestionEditorAnswers />

    case "true_false":
      return <QuestionEditorTrueFalse />

    case "open":
      return <QuestionEditorOpen />

    case "image_sequence":
      return <QuestionEditorImageSequence />

    case "date":
      return <QuestionEditorDate />

    case "slider":
      return <QuestionEditorSlider />

    case "puzzle":
      return <QuestionEditorPuzzle />

    case "drop_pin":
      return <QuestionEditorDropPin />

    default:
      return null
  }
}

const QuestionEditor = () => {
  const { currentQuestion, updateQuestion, currentIndex } = useQuizzEditor()

  if (!currentQuestion) {
    return null
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="relative mx-auto flex max-w-7xl flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <SlideEditor
            elements={currentQuestion.elements || []}
            onChange={(elements) => updateQuestion(currentIndex, { elements })}
            background={currentQuestion.background}
            backgroundOpacity={currentQuestion.backgroundOpacity}
          />
        </div>

        <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-4">
          {currentQuestion.type !== "title" && (
            <div className="pointer-events-auto">
              <QuestionEditorTitle />
            </div>
          )}
          <div className="pointer-events-none flex flex-1 flex-col"></div>
          {currentQuestion.type !== "title" && (
            <div className="pointer-events-auto">
              <QuestionAnswerEditor />
            </div>
          )}
        </div>
      </main>
      <QuestionEditorConfig />
    </div>
  )
}

export default QuestionEditor
