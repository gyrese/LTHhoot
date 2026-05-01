import slideBg from "@rahoot/web/assets/slide-bg.png"
import QuestionEditorAnswers from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorAnswers"
import QuestionEditorConfig from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig"
import QuestionEditorDate from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDate"
import QuestionEditorDropPin from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDropPin"
import QuestionEditorOpen from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorOpen"
import QuestionEditorPuzzle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorPuzzle"
import QuestionEditorSlider from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorSlider"
import QuestionEditorSlideToolbar from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorSlideToolbar"
import QuestionEditorTitle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTitle"
import QuestionEditorTrueFalse from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTrueFalse"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"

import SlideEditor from "@rahoot/web/features/quizz/components/SlideEditor"
import type { CSSProperties } from "react"

const QuestionAnswerEditor = () => {
  const { currentQuestion } = useQuizzEditor()

  switch (currentQuestion.type) {
    case "mcq":
      return <QuestionEditorAnswers />

    case "true_false":
      return <QuestionEditorTrueFalse />

    case "open":
      return <QuestionEditorOpen />

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

  const bg = currentQuestion.background
  let customBgStyle: CSSProperties = {}

  if (bg?.type === "image") {
    customBgStyle = { backgroundImage: `url(${bg.value})`, backgroundSize: "cover", backgroundPosition: "center" }
  } else if (bg?.type === "color") {
    customBgStyle = { backgroundColor: bg.value }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="mx-auto flex max-w-7xl flex-1 flex-col gap-4 overflow-y-auto p-6 relative">
        {/* Background container (Black background for darkening) */}
        <div className="absolute inset-0 pointer-events-none bg-black" />

        {/* Background layer */}
        {!bg ? (
          <div
            className="absolute inset-0 pointer-events-none bg-cover bg-center bg-no-repeat"
            style={{ 
              backgroundImage: `url(${slideBg})`,
              opacity: currentQuestion.backgroundOpacity ?? 0.5 
            }}
          />
        ) : (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ 
              ...customBgStyle,
              opacity: currentQuestion.backgroundOpacity ?? 0.5
            }}
          />
        )}

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <SlideEditor 
            elements={currentQuestion.elements || []} 
            onChange={(elements) => updateQuestion(currentIndex, { elements })} 
          />
        </div>

        <div className="relative z-10 flex flex-col gap-4 flex-1 pointer-events-none">
          {currentQuestion.type !== "title" && (
            <div className="pointer-events-auto"><QuestionEditorTitle /></div>
          )}
          <div className="flex-1 pointer-events-none flex flex-col"></div>
          <div className="pointer-events-auto"><QuestionAnswerEditor /></div>
          <div className="pointer-events-auto"><QuestionEditorSlideToolbar /></div>
        </div>
      </main>
      <QuestionEditorConfig />
    </div>
  )
}

export default QuestionEditor
