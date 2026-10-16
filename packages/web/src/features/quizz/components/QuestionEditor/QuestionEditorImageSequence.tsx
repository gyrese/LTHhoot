import { FieldErrors } from "../EditorValidation"
import type { ImageSequenceQuestion } from "@rahoot/common/types/game"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { ImagePlus, Minus, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  AnswerEditorPanel,
  AnswerEditorSection,
  EditableAnswerList,
} from "./AnswerEditorParts"
import { useQuestionImagePicker } from "./useQuestionImagePicker"

const iconButtonClass =
  "focus-ring text-ink-muted hover:bg-surface hover:text-ink flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30"

const QuestionEditorImageSequence = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const question = currentQuestion as ImageSequenceQuestion & { id: string }
  const { openPicker, picker } = useQuestionImagePicker(
    (questionIndex, target, url, slot) => {
      if (target.type !== "image_sequence") {
        return
      }
      const images = [...target.images]
      if (slot === undefined) {
        images.push(url)
      } else if (slot < images.length) {
        images[slot] = url
      } else {
        return
      }
      updateQuestion(questionIndex, { images })
    },
  )

  const removeImage = (index: number) => {
    updateQuestion(currentIndex, {
      images: question.images.filter((_, itemIndex) => itemIndex !== index),
    })
  }

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= question.images.length) {
      return
    }
    const images = [...question.images]
    const [moved] = images.splice(from, 1)
    images.splice(to, 0, moved)
    updateQuestion(currentIndex, { images })
  }

  return (
    <AnswerEditorPanel validationField={`questions.${currentIndex}.images`}>
      <AnswerEditorSection
        title={t("quizz:imageSequence.imagesLabel")}
        action={() => openPicker(question.id)}
        actionLabel={t("quizz:imageSequence.addImage")}
      >
        <FieldErrors field="images" exact />
        <span className="text-ink-muted text-xs tabular-nums">
          {question.images.length}
        </span>
        {question.images.map((url, index) => (
          <div
            key={`${index}-${url.slice(-12)}`}
            className="bg-panel flex min-w-0 items-center gap-2 rounded-lg p-2"
          >
            <img
              src={url}
              alt={`${t("quizz:imageSequence.image")} ${index + 1}`}
              className="size-12 shrink-0 rounded-lg object-cover"
            />
            <span className="text-ink-muted min-w-0 flex-1 truncate text-xs">
              {index + 1}. {url.split("/").pop()}
            </span>
            <div className="flex shrink-0 gap-0.5">
              <button
                type="button"
                onClick={() => moveImage(index, index - 1)}
                disabled={index === 0}
                aria-label={`${t("quizz:imageSequence.moveUp")} ${index + 1}`}
                className={iconButtonClass}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveImage(index, index + 1)}
                disabled={index === question.images.length - 1}
                aria-label={`${t("quizz:imageSequence.moveDown")} ${index + 1}`}
                className={iconButtonClass}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => openPicker(question.id, index)}
                aria-label={`${t("quizz:imageSequence.replaceImage")} ${index + 1}`}
                className={iconButtonClass}
              >
                <RefreshCw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => removeImage(index)}
                aria-label={`${t("quizz:imageSequence.removeImage")} ${index + 1}`}
                className={iconButtonClass}
              >
                <Minus className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {question.images.length === 0 && (
          <button
            type="button"
            onClick={() => openPicker(question.id)}
            className="focus-ring border-border text-ink-muted hover:border-primary hover:text-ink flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm transition-colors"
          >
            <ImagePlus className="size-5" />
            {t("quizz:imageSequence.addImage")}
          </button>
        )}
      </AnswerEditorSection>

      <AnswerEditorSection
        title={t("quizz:imageSequence.intervalLabel")}
        hint={t("quizz:imageSequence.intervalHint")}
      >
        <div className="w-24">
          <ConfigNumberInput
            field="imageInterval"
            value={question.imageInterval ?? 5}
            min={2}
            max={60}
            onChange={(value) =>
              updateQuestion(currentIndex, { imageInterval: value })
            }
          />
        </div>
      </AnswerEditorSection>

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
      {picker}
    </AnswerEditorPanel>
  )
}

export default QuestionEditorImageSequence
