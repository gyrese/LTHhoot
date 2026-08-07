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
      <div className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-gray-200 bg-white px-5">
        <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
          Question {questionIndex + 1}
          {t("manager:result.paginationOf")}
          {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={questionIndex === 0}
            onClick={goPrev}
            className="cursor-pointer rounded p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            disabled={questionIndex === total - 1}
            onClick={goNext}
            className="cursor-pointer rounded p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
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
        <p className="px-5 py-10 text-center text-sm text-gray-400 italic">
          Aucune réponse enregistrée pour cette question.
        </p>
      )}
    </>
  )
}

export default ResultModalQuestions
