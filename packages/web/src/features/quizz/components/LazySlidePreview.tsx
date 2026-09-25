import { useEffect, useRef, useState } from "react"
import type { QuestionWithId } from "../contexts/quizz-editor-context"
import PreviewPresenterView from "./SlideEditor/PreviewPresenterView"

export default function LazySlidePreview({
  question,
}: {
  question: QuestionWithId
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) {
      return () => undefined
    }
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return () => undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "250px" },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
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
}
