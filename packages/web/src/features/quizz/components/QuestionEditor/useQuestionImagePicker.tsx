import MediaSearchModal from "@rahoot/web/features/quizz/components/MediaSearchModal"
import {
  useQuizzEditor,
  type QuestionWithId,
} from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useRef, useState } from "react"
import { createPortal } from "react-dom"

type PickerTarget = {
  questionId: string
  slot?: number
}

/** Keeps a media choice attached to the question that opened the library. */
export function useQuestionImagePicker(
  onPick: (
    _questionIndex: number,
    _question: QuestionWithId,
    _url: string,
    _slot?: number,
  ) => void,
) {
  const { questions } = useQuizzEditor()
  const [target, setTarget] = useState<PickerTarget | null>(null)
  const latest = useRef({ questions, onPick })
  latest.current = { questions, onPick }

  const picker = createPortal(
    <MediaSearchModal
      open={target !== null}
      allowedTypes={["image"]}
      onClose={() => setTarget(null)}
      onSelect={(url) => {
        const request = target
        setTarget(null)
        if (!request) {
          return
        }
        const { questions: current, onPick: apply } = latest.current
        const index = current.findIndex(
          (question) => question.id === request.questionId,
        )
        if (index >= 0) {
          apply(index, current[index], url, request.slot)
        }
      }}
    />,
    document.body,
  )

  return {
    openPicker: (questionId: string, slot?: number) =>
      setTarget({ questionId, slot }),
    picker,
  }
}
