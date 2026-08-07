import type { GameResult } from "@rahoot/common/types/game"
import { isSoloResult } from "@rahoot/common/utils/result-kind"
import { SoloDrawModal } from "@rahoot/web/features/manager/components/DrawModal/SoloDrawModal"
import ResultModalHeader from "@rahoot/web/features/manager/components/ResultModal/ResultModalHeader"
import ResultModalLogs from "@rahoot/web/features/manager/components/ResultModal/ResultModalLogs"
import ResultModalQuestions from "@rahoot/web/features/manager/components/ResultModal/ResultModalQuestions"
import ResultModalRanking from "@rahoot/web/features/manager/components/ResultModal/ResultModalRanking"
import { ResultModalProvider } from "@rahoot/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { useState, useEffect } from "react"

type Props = {
  result: GameResult
  // Ouvre directement le tirage au sort : la liste des résultats solo propose
  // un raccourci qui court-circuite la lecture du détail.
  openDraw?: boolean
  onClose: () => void
}

type View = "ranking" | "questions" | "logs"

const ResultModal = ({ result, openDraw = false, onClose }: Props) => {
  const [view, setView] = useState<View>("ranking")
  const [showDrawModal, setShowDrawModal] = useState(openDraw)
  const logCount = result.logs?.length ?? 0
  const errorCount = result.logs?.filter((l) => l.level === "error").length ?? 0

  useEffect(() => {
    const handleOpenDraw = () => setShowDrawModal(true)
    window.addEventListener("openSoloDraw", handleOpenDraw)

    return () => window.removeEventListener("openSoloDraw", handleOpenDraw)
  }, [])

  const tabs: { id: View; label: string; count?: number; alert?: boolean }[] = [
    { id: "ranking", label: "Classement", count: result.players.length },
    { id: "questions", label: "Questions", count: result.questions.length },
    // Un classement solo n'est pas une partie animée : il n'a pas de journal.
    ...(isSoloResult(result)
      ? []
      : [
          {
            id: "logs" as const,
            label: "Logs système",
            count: logCount,
            alert: errorCount > 0,
          },
        ]),
  ]

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      {/* Hauteur fixe : sans elle la modale s'ajuste au contenu et la zone
          scrollable se réduit à quelques pixels sur un rapport dense. */}
      <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <ResultModalProvider result={result} onClose={onClose}>
          <ResultModalHeader />

          {/* Onglets */}
          <div className="flex shrink-0 gap-1 border-b border-gray-200 px-4">
            {tabs.map(({ id, label, count, alert }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={clsx(
                  "-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  view === id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span
                    className={clsx(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      alert
                        ? "bg-red-100 text-red-600"
                        : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Une seule zone de défilement pour tout le corps de la modale */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === "ranking" && <ResultModalRanking />}
            {view === "questions" && <ResultModalQuestions />}
            {view === "logs" && <ResultModalLogs />}
          </div>
        </ResultModalProvider>
      </div>

      {showDrawModal && (
        <SoloDrawModal
          result={result}
          onClose={() => setShowDrawModal(false)}
        />
      )}
    </div>
  )
}

export default ResultModal
