import type { PuzzleQuestion } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useTranslation } from "react-i18next"
import { AnswerEditorPanel, EditableAnswerList } from "./AnswerEditorParts"

const QuestionEditorPuzzle = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const question = currentQuestion as PuzzleQuestion & { id: string }

  return (
    <AnswerEditorPanel validationField={`questions.${currentIndex}.items`}>
      <EditableAnswerList
        field="items"
        values={question.items}
        minimum={2}
        title={t("quizz:puzzle.itemsLabel")}
        placeholder={t("quizz:puzzle.itemPlaceholder")}
        hint={t("quizz:puzzle.hint")}
        onChange={(items) => updateQuestion(currentIndex, { items })}
      />
    </AnswerEditorPanel>
  )
}

export default QuestionEditorPuzzle
