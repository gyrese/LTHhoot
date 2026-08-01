import type { GameResult } from "@rahoot/common/types/game"
import ResultModalAnswers from "@rahoot/web/features/manager/components/ResultModal/ResultModalAnswers"
import ResultModalHeader from "@rahoot/web/features/manager/components/ResultModal/ResultModalHeader"
import ResultModalLogs from "@rahoot/web/features/manager/components/ResultModal/ResultModalLogs"
import ResultModalStats from "@rahoot/web/features/manager/components/ResultModal/ResultModalStats"
import ResultModalTable from "@rahoot/web/features/manager/components/ResultModal/ResultModalTable"
import { Top10DrawModal } from "@rahoot/web/features/manager/components/DrawModal/Top10DrawModal"
import { ResultModalProvider } from "@rahoot/web/features/manager/contexts/result-modal-context"
import { useState, useEffect } from "react"
import clsx from "clsx"

type Props = {
  result: GameResult
  onClose: () => void
}

const ResultModal = ({ result, onClose }: Props) => {
  const [view, setView] = useState<"questions" | "logs">("questions")
  const [showDrawModal, setShowDrawModal] = useState(false)
  const logCount = result.logs?.length ?? 0
  const errorCount = result.logs?.filter((l) => l.level === "error").length ?? 0

  useEffect(() => {
    const handleOpenDraw = () => setShowDrawModal(true)
    window.addEventListener("openTop10Draw", handleOpenDraw)
    return () => window.removeEventListener("openTop10Draw", handleOpenDraw)
  }, [])

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded bg-white shadow-2xl">
        <ResultModalProvider result={result} onClose={onClose}>
          <ResultModalHeader />

          {/* Onglets */}
          <div className="flex shrink-0 gap-1 border-b border-gray-200 px-4">
            <button
              onClick={() => setView("questions")}
              className={clsx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                view === "questions"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              Questions
            </button>
            <button
              onClick={() => setView("logs")}
              className={clsx(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                view === "logs"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              Logs système
              {logCount > 0 && (
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    errorCount > 0
                      ? "bg-red-100 text-red-600"
                      : "bg-gray-100 text-gray-500",
                  )}
                >
                  {logCount}
                </span>
              )}
            </button>
          </div>

          {view === "questions" ? (
            <>
              <ResultModalAnswers />
              <ResultModalStats />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ResultModalTable />
              </div>
            </>
          ) : (
            <ResultModalLogs />
          )}
        </ResultModalProvider>
      </div>

      {showDrawModal && (
        <Top10DrawModal
          result={result}
          onClose={() => setShowDrawModal(false)}
        />
      )}
    </div>
  )
}

export default ResultModal
