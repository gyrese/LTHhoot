import type { Question } from "@rahoot/common/types/game"
import { useTranslation } from "react-i18next"

export type PreviewPhase = "question" | "answers" | "correction"

export const previewSolutions = (
  question: Question,
  trueLabel: string,
  falseLabel: string,
): string[] => {
  switch (question.type) {
    case "mcq":
      return question.solutions
        .map((index) => question.answers[index])
        .filter(Boolean)
    case "true_false":
      return [question.solution === 0 ? falseLabel : trueLabel]
    case "open":
    case "image_sequence":
      return question.correctAnswers
    case "date":
      return [String(question.correctYear)]
    case "slider":
      return [String(question.correctValue)]
    case "puzzle":
      return [question.items.join(" → ")]
    case "drop_pin":
      return question.zones
        .filter((zone) => zone.isCorrect)
        .map((zone, index) => zone.label || `Zone ${index + 1}`)
    case "grid":
      return question.correctIndexes.map(
        (index) => question.cells[index]?.label || `Case ${index + 1}`,
      )
    case "title":
      return []
  }
  return []
}

export default function PreviewCorrection({
  question,
}: {
  question: Question
}) {
  const { t } = useTranslation()
  const solutions = previewSolutions(question, t("game:true"), t("game:false"))
  const reveal = question.type === "title" ? undefined : question.answerReveal
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto rounded-lg bg-black/75 p-5 text-white">
      <h3 className="text-lg font-bold">{t("quizz:previewFlow.correction")}</h3>
      <ul className="flex flex-col gap-2 text-base">
        {solutions.map((solution, index) => (
          <li key={index} className="rounded-md bg-white/10 px-3 py-2">
            {solution}
          </li>
        ))}
      </ul>
      {solutions.length === 0 && (
        <p>{t("errors:quizz.tooFewCorrectAnswers")}</p>
      )}
      {question.type === "grid" && (
        <div className="flex flex-wrap gap-2">
          {question.correctIndexes.map(
            (index) =>
              question.cells[index]?.image && (
                <img
                  key={index}
                  src={question.cells[index].image}
                  alt={question.cells[index].label || `Case ${index + 1}`}
                  className="size-24 rounded object-contain"
                />
              ),
          )}
        </div>
      )}
      {reveal?.enabled && (
        <>
          {reveal.text && <p className="whitespace-pre-wrap">{reveal.text}</p>}
          {reveal.image && (
            <img
              src={reveal.image}
              alt=""
              className="max-h-60 w-full object-contain"
            />
          )}
          {reveal.videoId && (
            <iframe
              title={t("quizz:previewFlow.correction")}
              src={`https://www.youtube.com/embed/${encodeURIComponent(reveal.videoId)}?rel=0`}
              allowFullScreen
              className="aspect-video w-full"
            />
          )}
        </>
      )}
    </div>
  )
}
