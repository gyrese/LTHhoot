import QuestionEditorAnswersToolbar from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorAnswersToolbar"
import QuestionEditorConfig from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig"
import QuestionEditorDate from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDate"
import QuestionEditorDropPin from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorDropPin"
import QuestionEditorGrid from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorGrid"
import QuestionEditorImageSequence from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorImageSequence"
import QuestionEditorOpen from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorOpen"
import QuestionEditorPuzzle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorPuzzle"
import QuestionEditorSlider from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorSlider"
import QuestionLayoutEditor from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionLayoutEditor"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { hasLayoutAnswers } from "@rahoot/web/features/game/utils/question-layout"

import SlideEditor from "@rahoot/web/features/quizz/components/SlideEditor"

const QuestionAnswerEditor = () => {
  const { currentQuestion } = useQuizzEditor()

  if (!currentQuestion) {
    return null
  }

  switch (currentQuestion.type) {
    // QCM et vrai-faux : les cases sont éditées sur la diapositive
    // (QuestionLayoutEditor) ; le QCM garde ici sa barre d'outils.
    case "mcq":
      return <QuestionEditorAnswersToolbar />

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

    case "grid":
      return <QuestionEditorGrid />

    default:
      return null
  }
}

const QuestionEditor = ({
  showInspector = true,
}: {
  showInspector?: boolean
}) => {
  const { currentQuestion, updateQuestion, currentIndex } = useQuizzEditor()

  if (!currentQuestion) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <main className="relative mx-auto flex max-w-7xl flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <SlideEditor
            elements={currentQuestion.elements || []}
            onChange={(elements) => updateQuestion(currentIndex, { elements })}
            background={currentQuestion.background}
            backgroundOpacity={currentQuestion.backgroundOpacity}
            renderOverlay={(view) => <QuestionLayoutEditor view={view} />}
          />
        </div>

        {/* Titre (tous types) et cases QCM / vrai-faux : boîtes positionnées sur
            la slide. Les autres types gardent leur éditeur de réponses en bas ;
            la barre d'outils du QCM se loge dans le coin haut-gauche. */}
        <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-4">
          {currentQuestion.type === "mcq" && (
            <div className="pointer-events-auto self-start">
              <QuestionAnswerEditor />
            </div>
          )}
          <div className="pointer-events-none flex flex-1 flex-col"></div>
          {currentQuestion.type !== "title" &&
            !hasLayoutAnswers(currentQuestion.type) && (
              <div className="pointer-events-auto">
                <QuestionAnswerEditor />
              </div>
            )}
        </div>
      </main>
      {showInspector && <QuestionEditorConfig />}
    </div>
  )
}

export default QuestionEditor
