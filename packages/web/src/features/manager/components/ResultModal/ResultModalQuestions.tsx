import ResultModalAnswers from "@rahoot/web/features/manager/components/ResultModal/ResultModalAnswers"
import ResultModalStats from "@rahoot/web/features/manager/components/ResultModal/ResultModalStats"
import ResultModalTable from "@rahoot/web/features/manager/components/ResultModal/ResultModalTable"
import { useResultModal } from "@rahoot/web/features/manager/contexts/result-modal-context"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"

const ResultModalQuestions = () => {
  const { questionResult, questionIndex, total, goNext, goPrev } =
    useResultModal()
  const { t } = useTranslation()
  const hasAnswers = questionResult.playerAnswers.length > 0

  return (
    <>
      {/* Navigation question — épinglée en haut de la zone scrollable pour
          rester atteignable sur un rapport de 16 questions. */}
      <div className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-white/10 bg-slate-900 px-5">
        <span className="text-xs font-semibold tracking-wide text-white/60 uppercase">
          {t("manager:result.questionOf", {
            current: questionIndex + 1,
            total,
          })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={questionIndex === 0}
            onClick={goPrev}
            aria-label={t("manager:result.previousQuestion")}
            className="flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none disabled:cursor-default disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            disabled={questionIndex === total - 1}
            onClick={goNext}
            aria-label={t("manager:result.nextQuestion")}
            className="flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none disabled:cursor-default disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <ResultModalAnswers />
      <ResultModalStats />

      {hasAnswers ? (
        <ResultModalTable />
      ) : (
        <p className="px-5 py-10 text-center text-sm text-white/60 italic">
          {t("manager:result.noAnswers")}
        </p>
      )}
    </>
  )
}

export default ResultModalQuestions
