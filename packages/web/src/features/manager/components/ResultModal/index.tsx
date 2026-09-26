import type { GameResult } from "@rahoot/common/types/game"
import {
  isSoloResult,
  resultDisplaySubject,
} from "@rahoot/common/utils/result-kind"
import Modal from "@rahoot/web/components/Modal"
import { SoloDrawModal } from "@rahoot/web/features/manager/components/DrawModal/SoloDrawModal"
import ResultModalHeader from "@rahoot/web/features/manager/components/ResultModal/ResultModalHeader"
import ResultModalLogs from "@rahoot/web/features/manager/components/ResultModal/ResultModalLogs"
import ResultModalQuestions from "@rahoot/web/features/manager/components/ResultModal/ResultModalQuestions"
import ResultModalRanking from "@rahoot/web/features/manager/components/ResultModal/ResultModalRanking"
import { ResultModalProvider } from "@rahoot/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

type Props = {
  result: GameResult
  // Ouvre directement le tirage au sort : la liste des résultats solo propose
  // un raccourci qui court-circuite la lecture du détail.
  openDraw?: boolean
  onClose: () => void
}

type View = "ranking" | "questions" | "logs"

const ResultModal = ({ result, openDraw = false, onClose }: Props) => {
  const { t } = useTranslation()
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
    {
      id: "ranking",
      label: t("manager:result.tabs.ranking"),
      count: result.players.length,
    },
    {
      id: "questions",
      label: t("manager:result.tabs.questions"),
      count: result.questions.length,
    },
    // Un classement solo n'est pas une partie animée : il n'a pas de journal.
    ...(isSoloResult(result)
      ? []
      : [
          {
            id: "logs" as const,
            label: t("manager:result.tabs.logs"),
            count: logCount,
            alert: errorCount > 0,
          },
        ]),
  ]

  // Rendue via la primitive Modal (portal) : le panneau qui monte cette modale
  // porte un `backdrop-blur`, ce qui en fait le bloc conteneur de ses
  // descendants `position: fixed` — sans portal la modale serait positionnée
  // (et rognée par l'`overflow-hidden`) dans le panneau au lieu de la fenêtre.
  // Plancher + plafond plutôt qu'une hauteur libre : sans plancher la zone
  // scrollable se réduit à quelques pixels, sans plafond la modale déborde de
  // la fenêtre sur un rapport de 165 participants.
  return (
    <>
      <Modal
        label={resultDisplaySubject(result.subject)}
        onClose={onClose}
        closeOnOverlay={false}
        overlayClassName="z-60 bg-black/60 backdrop-blur-sm"
        className="flex max-h-[88vh] min-h-[min(26rem,88vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 text-white shadow-2xl backdrop-blur-xl"
      >
        <ResultModalProvider result={result} onClose={onClose}>
          <ResultModalHeader />

          {/* Onglets */}
          <div
            role="tablist"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-4"
          >
            {tabs.map(({ id, label, count, alert }) => (
              <button
                type="button"
                role="tab"
                aria-selected={view === id}
                key={id}
                onClick={() => setView(id)}
                className={clsx(
                  "-mb-px flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:bg-white/10 focus-visible:outline-none",
                  view === id
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-white/60 hover:text-white",
                )}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span
                    className={clsx(
                      "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                      alert
                        ? "bg-red-500/20 text-red-300"
                        : "bg-white/10 text-white/70",
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
      </Modal>

      {showDrawModal && (
        <SoloDrawModal
          result={result}
          onClose={() => setShowDrawModal(false)}
        />
      )}
    </>
  )
}

export default ResultModal
