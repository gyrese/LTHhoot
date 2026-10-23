import type { SlideElement, YoutubeElement } from "@rahoot/common/types/game"
import { useQuizzEditor } from "../../contexts/quizz-editor-context"
import {
  createImageElement,
  createShapeElement,
  createTextElement,
} from "../../utils/element-factory"
import MediaSearchModal from "../MediaSearchModal"
import {
  AudioButton,
  BackgroundButton,
} from "../QuestionEditor/QuestionEditorSlideToolbar"
import {
  Image as ImageIcon,
  Layers,
  Redo2,
  Square,
  Type,
  Undo2,
} from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"
import ElementToolbar from "./ElementToolbar"
import { ToolButton, ToolbarPopover } from "./ToolbarControls"
import YoutubePanel from "./YoutubePanel"

export default function SlideToolbar() {
  const {
    currentQuestion,
    currentIndex,
    questions,
    updateQuestion,
    selectedId,
    setSelectedId,
    undo,
    redo,
    canUndo,
    canRedo,
    openInspector,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const [mediaRequest, setMediaRequest] = useState<{
    questionId: string
    elementId?: string
  } | null>(null)
  const elements = currentQuestion.elements || []
  const selectedElement = elements.find((item) => item.id === selectedId)
  const currentRef = useRef({ questions, currentIndex })
  currentRef.current = { questions, currentIndex }

  const updateElements = (next: SlideElement[]) =>
    updateQuestion(currentIndex, { elements: next })
  const add = (element: SlideElement) => {
    updateElements([...elements, element])
    setSelectedId(element.id)
  }
  const updateSelected = (patch: Partial<SlideElement>) => {
    if (!selectedElement) {
      return
    }
    updateElements(
      elements.map((item) =>
        item.id === selectedElement.id
          ? ({ ...item, ...patch } as SlideElement)
          : item,
      ),
    )
  }
  const removeSelected = () => {
    updateElements(elements.filter((item) => item.id !== selectedId))
    setSelectedId(undefined)
  }
  const bringToFront = () => {
    if (selectedElement) {
      updateElements([
        ...elements.filter((item) => item.id !== selectedId),
        selectedElement,
      ])
    }
  }
  const sendToBack = () => {
    if (selectedElement) {
      updateElements([
        selectedElement,
        ...elements.filter((item) => item.id !== selectedId),
      ])
    }
  }
  const addYoutube = (element: YoutubeElement) => add(element)
  const addMedia = (url: string) => {
    const request = mediaRequest
    setMediaRequest(null)
    if (!request) {
      return
    }
    const { elementId, questionId } = request
    const questionIndex = currentRef.current.questions.findIndex(
      (item) => item.id === questionId,
    )
    if (questionIndex < 0) {
      return
    }
    if (elementId) {
      const question = currentRef.current.questions[questionIndex]
      updateQuestion(questionIndex, {
        elements: (question.elements || []).map((item) =>
          item.id === elementId ? ({ ...item, url } as SlideElement) : item,
        ),
      })
      return
    }
    const image = new window.Image()
    image.crossOrigin = "anonymous"
    image.onload = () => {
      const currentIndex = currentRef.current.questions.findIndex(
        (item) => item.id === questionId,
      )
      if (currentIndex < 0) {
        return
      }
      const current = currentRef.current.questions[currentIndex]
      const scale = Math.min(
        1,
        600 / image.naturalWidth,
        600 / image.naturalHeight,
      )
      const element = createImageElement(
        url,
        image.naturalWidth * scale,
        image.naturalHeight * scale,
      )
      updateQuestion(currentIndex, {
        elements: [...(current.elements || []), element],
      })
      if (currentRef.current.currentIndex === currentIndex) {
        setSelectedId(element.id)
      }
    }
    image.onerror = () => toast.error(t("quizz:editorToolbar.imageLoadFailed"))
    image.src = url
  }
  return (
    <div className="flex w-full min-w-0 flex-col">
      <div
        role="toolbar"
        aria-label={t("quizz:editorToolbar.slideTools")}
        className="flex min-h-11 flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1"
      >
        <div className="flex items-center gap-0.5">
          <ToolButton
            label={t("quizz:editorToolbar.undo")}
            icon={<Undo2 className="size-4" />}
            iconOnly
            disabled={!canUndo}
            onClick={undo}
          />
          <ToolButton
            label={t("quizz:editorToolbar.redo")}
            icon={<Redo2 className="size-4" />}
            iconOnly
            disabled={!canRedo}
            onClick={redo}
          />
        </div>
        <span aria-hidden="true" className="bg-border h-5 w-px" />
        <span className="text-ink-subtle hidden text-xs font-semibold sm:inline">
          {t("quizz:editorToolbar.add")}
        </span>
        <ToolButton
          label={t("quizz:addText")}
          icon={<Type className="size-4" />}
          onClick={() => add(createTextElement({}, elements.length))}
        />
        <ToolButton
          label={t("quizz:addShape")}
          icon={<Square className="size-4" />}
          onClick={() => add(createShapeElement({}, elements.length))}
        />
        <ToolButton
          label={t("quizz:editorToolbar.imageGif")}
          icon={<ImageIcon className="size-4" />}
          onClick={() =>
            setMediaRequest({
              questionId: currentQuestion.id,
            })
          }
        />
        <ToolbarPopover
          label={t("quizz:editorToolbar.youtube")}
          resetKey={currentQuestion.id}
        >
          {(close) => (
            <YoutubePanel
              onAdd={(element) => {
                addYoutube(element)
                close()
              }}
              onClose={close}
            />
          )}
        </ToolbarPopover>
        <span aria-hidden="true" className="bg-border h-5 w-px" />
        <BackgroundButton />
        <AudioButton />
        <div className="flex items-center gap-1">
          <ToolButton
            label={t("quizz:editorToolbar.layers")}
            icon={<Layers className="size-4" />}
            iconOnly
            onClick={() => openInspector("layers")}
          />
        </div>
      </div>
      {selectedElement && (
        <ElementToolbar
          key={`${currentIndex}-${selectedElement.id}`}
          element={selectedElement}
          update={updateSelected}
          remove={removeSelected}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          replaceImage={() =>
            setMediaRequest({
              questionId: currentQuestion.id,
              elementId: selectedElement.id,
            })
          }
          openInspector={() => openInspector("element")}
        />
      )}
      <MediaSearchModal
        open={Boolean(mediaRequest)}
        allowedTypes={["image"]}
        onClose={() => setMediaRequest(null)}
        onSelect={addMedia}
      />
    </div>
  )
}
