import { memo, useEffect, useRef, useState } from "react"
import type { QuestionWithId } from "../contexts/quizz-editor-context"
import PreviewPresenterView from "./SlideEditor/PreviewPresenterView"

const listeners = new Map<Element, (_visible: boolean) => void>()
let sharedObserver: IntersectionObserver | null = null

const watchPreview = (
  element: Element,
  onVisible: (_visible: boolean) => void,
) => {
  if (typeof IntersectionObserver === "undefined") {
    onVisible(true)
    return () => undefined
  }
  sharedObserver ||= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        listeners.get(entry.target)?.(entry.isIntersecting)
      }
    },
    { rootMargin: "250px" },
  )
  listeners.set(element, onVisible)
  sharedObserver.observe(element)
  return () => {
    sharedObserver?.unobserve(element)
    listeners.delete(element)
    if (listeners.size === 0) {
      sharedObserver?.disconnect()
      sharedObserver = null
    }
  }
}

const LazySlidePreview = memo(({ question }: { question: QuestionWithId }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) {
      return () => undefined
    }
    return watchPreview(ref.current, setVisible)
  }, [])
  return (
    <div ref={ref} className="bg-canvas aspect-video overflow-hidden">
      {visible ? (
        <PreviewPresenterView
          question={question}
          className="rounded-none shadow-none"
          hideYoutube
        />
      ) : (
        <div className="text-ink-muted flex h-full items-center justify-center p-3 text-xs">
          {question.question}
        </div>
      )}
    </div>
  )
})
LazySlidePreview.displayName = "LazySlidePreview"

export default LazySlidePreview
