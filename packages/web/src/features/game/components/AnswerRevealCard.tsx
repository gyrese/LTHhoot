import type { AnswerReveal } from "@rahoot/common/types/game"
import clsx from "clsx"
import { useTranslation } from "react-i18next"
import "./AnswerRevealCard.css"

export function AnswerRevealCard({
  reveal,
  expanded = false,
}: {
  reveal: AnswerReveal
  expanded?: boolean
}) {
  const { t } = useTranslation()

  if (!reveal.enabled || !(reveal.image || reveal.videoId || reveal.text)) {
    return null
  }

  const isExpanded = expanded && Boolean(reveal.videoId)

  return (
    <div
      className={clsx("answer-reveal", isExpanded && "answer-reveal--expanded")}
      data-testid="answer-reveal"
      data-expanded={isExpanded}
    >
      <div className="answer-reveal__frame">
        {/* Garder le même iframe monté préserve la lecture pendant le zoom. */}
        {reveal.videoId ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${reveal.videoId}?autoplay=1&mute=0`}
              title={t("game:answerVideo.title")}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          reveal.image && (
            <img
              src={reveal.image}
              alt=""
              className="max-h-[55vh] w-full bg-black/20 object-contain"
            />
          )
        )}
        {reveal.text && (
          <div className="answer-reveal__text px-6 py-4">
            <p className="text-center text-lg leading-relaxed font-semibold text-white md:text-xl">
              {reveal.text}
            </p>
          </div>
        )}
        {isExpanded && (
          <div className="answer-reveal__bezel" aria-hidden="true">
            <span className="h-1 w-12 rounded-full bg-slate-700" />
            <span className="absolute right-5 size-1.5 rounded-full bg-orange-400" />
          </div>
        )}
      </div>
    </div>
  )
}
