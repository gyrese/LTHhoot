import React, { useState, useMemo } from "react"
import type { GameResult, GameResultPlayer } from "@rahoot/common/types/game"
import { Trophy, Dices, X, Sparkles, Send, Check, Crown, Award } from "lucide-react"
import Confetti from "react-confetti"
import toast from "react-hot-toast"
import clsx from "clsx"

type Props = {
  result: GameResult
  onClose: () => void
}

export const Top10DrawModal: React.FC<Props> = ({ result, onClose }) => {
  // Isoler le Top 10 des meilleurs scores
  const top10Players = useMemo(() => {
    const sorted = [...result.players].sort((a, b) => b.points - a.points)
    return sorted.slice(0, 10)
  }, [result])

  const [isSpinning, setIsSpinning] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null)
  const [winner, setWinner] = useState<GameResultPlayer | null>(null)

  const handleStartDraw = () => {
    if (top10Players.length === 0) {
      toast.error("Aucun participant disponible pour le tirage.")
      return
    }

    setIsSpinning(true)
    setWinner(null)

    let current = 0
    let speed = 80
    const durationMs = 3500
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      setHighlightedIdx(current % top10Players.length)
      current += 1

      if (elapsed < durationMs) {
        speed = 80 + Math.pow(elapsed / durationMs, 2) * 300
        setTimeout(animate, speed)
      } else {
        // Sélection aléatoire équitable parmi le Top 10
        const winnerIndex = Math.floor(Math.random() * top10Players.length)
        setHighlightedIdx(winnerIndex)
        setWinner(top10Players[winnerIndex])
        setIsSpinning(false)
        toast.success(`Le gagnant est ${top10Players[winnerIndex].username} ! 🎉`)
      }
    }

    animate()
  }

  const winnerPostText = winner
    ? `🎉 ANNONCE GAGNANT DU QUIZ !
Félicitations à ${winner.username} ${winner.socialContact ? `(${winner.socialContact})` : ""} qui remporte le tirage au sort de la semaine sur le quiz "${result.subject}" avec ${winner.points.toLocaleString()} pts !

Merci à tous les participants du Top 10 ! 🚀`
    : ""

  const handleCopyWinnerAnnouncement = () => {
    if (!winnerPostText) return
    navigator.clipboard.writeText(winnerPostText)
    toast.success("Texte d'annonce du gagnant copié pour vos réseaux !")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      {winner && <Confetti recycle={false} numberOfPieces={350} />}

      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-slate-850">
          <div className="flex items-center gap-2">
            <Dices className="size-6 text-amber-400" />
            <div>
              <h3 className="font-bold text-lg leading-none">Tirage au Sort Top 10</h3>
              <p className="text-xs text-gray-400 mt-1">{result.subject}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Liste des candidats Top 10 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="size-4 text-amber-400" />
                Candidats du Top 10 ({top10Players.length})
              </span>
              <span className="text-[11px] text-gray-400">
                Chaque joueur a 1 chance égale d'être tiré au sort
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {top10Players.map((player, idx) => {
                const isSelected = highlightedIdx === idx
                const isWinner = winner?.username === player.username

                return (
                  <div
                    key={idx}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border transition-all duration-150",
                      isWinner && "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400",
                      isSelected && !isWinner && "bg-orange-500/20 border-orange-400 scale-[1.02]",
                      !isSelected && !isWinner && "bg-slate-950/70 border-white/10 hover:border-white/20",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={clsx(
                          "size-7 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0",
                          idx === 0
                            ? "bg-amber-400 text-slate-950"
                            : idx === 1
                            ? "bg-slate-300 text-slate-950"
                            : idx === 2
                            ? "bg-amber-700 text-white"
                            : "bg-slate-800 text-gray-300",
                        )}
                      >
                        #{player.rank || idx + 1}
                      </span>

                      <div className="truncate">
                        <p className="font-bold text-sm text-white truncate flex items-center gap-1">
                          {player.username}
                          {isWinner && <Crown className="size-4 text-amber-400 fill-amber-400 inline shrink-0" />}
                        </p>
                        {player.socialContact && (
                          <p className="text-[11px] text-orange-300 truncate">
                            {player.socialContact}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-extrabold text-amber-400 shrink-0 ml-2">
                      {player.points.toLocaleString()} pts
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Banner Gagnant s'il existe */}
          {winner && (
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-400/40 rounded-2xl p-5 text-center shadow-xl animate-in fade-in slide-in-from-bottom-2">
              <div className="inline-flex p-3 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-950 mb-3 shadow-lg shadow-amber-500/30">
                <Crown className="size-8" />
              </div>
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Vainqueur du Tirage au Sort</h4>
              <p className="text-2xl font-black text-white mb-1">{winner.username}</p>
              {winner.socialContact && (
                <p className="text-xs text-orange-300 font-semibold mb-3">
                  Contact : {winner.socialContact}
                </p>
              )}

              <button
                onClick={handleCopyWinnerAnnouncement}
                className="mt-2 py-2.5 px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mx-auto"
              >
                <Send className="size-4" />
                <span>Copier le texte d'annonce du gagnant</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer avec Bouton de Tirage */}
        <div className="border-t border-white/10 px-6 py-4 bg-slate-850 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-white/10 transition-colors cursor-pointer"
          >
            Fermer
          </button>

          <button
            disabled={isSpinning || top10Players.length === 0}
            onClick={handleStartDraw}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 cursor-pointer text-sm"
          >
            <Dices className={clsx("size-5", isSpinning && "animate-spin")} />
            <span>{isSpinning ? "Tirage en cours..." : "Lancer le Tirage au Sort"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
