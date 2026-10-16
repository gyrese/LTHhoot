import type { OpenQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useTranslation } from "react-i18next"
import { AnswerEditorPanel, EditableAnswerList } from "./AnswerEditorParts"

const QuestionEditorOpen = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const question = currentQuestion as OpenQuestion & { id: string }

  return (
    <AnswerEditorPanel
      validationField={`questions.${currentIndex}.correctAnswers`}
    >
      <EditableAnswerList
        field="correctAnswers"
        values={question.correctAnswers}
        minimum={1}
        title={t("quizz:correctAnswers")}
        placeholder={t("quizz:addCorrectAnswer")}
        hint={t("quizz:openAnswerHint")}
        onChange={(correctAnswers) =>
          updateQuestion(currentIndex, { correctAnswers })
        }
      />
    </AnswerEditorPanel>
  )
}

export default QuestionEditorOpen
