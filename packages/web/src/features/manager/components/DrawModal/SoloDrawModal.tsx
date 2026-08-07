import React, { useState, useMemo } from "react"
import { EVENTS } from "@rahoot/common/constants"
import type { GameResult, GameResultPlayer } from "@rahoot/common/types/game"
import {
  SOLO_DRAW_POOL_SIZE,
  resultDisplaySubject,
} from "@rahoot/common/utils/result-kind"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import {
  Trophy,
  Dices,
  X,
  Send,
  Crown,
  Image as ImageIcon,
  Trash2,
} from "lucide-react"
import Confetti from "react-confetti"
import toast from "react-hot-toast"
import clsx from "clsx"

type Props = {
  result: GameResult
  onClose: () => void
}

export const downloadWinnerVisualPNG = (
  quizSubject: string,
  winner: GameResultPlayer,
) => {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return
    }

    // 1. Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080)
    bgGrad.addColorStop(0, "#090d16")
    bgGrad.addColorStop(0.5, "#171026")
    bgGrad.addColorStop(1, "#090d16")
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, 1080, 1080)

    // 2. Glow orbs
    const orb1 = ctx.createRadialGradient(250, 250, 10, 250, 250, 500)
    orb1.addColorStop(0, "rgba(249, 115, 22, 0.35)")
    orb1.addColorStop(1, "transparent")
    ctx.fillStyle = orb1
    ctx.fillRect(0, 0, 1080, 1080)

    const orb2 = ctx.createRadialGradient(850, 850, 10, 850, 850, 500)
    orb2.addColorStop(0, "rgba(245, 158, 11, 0.3)")
    orb2.addColorStop(1, "transparent")
    ctx.fillStyle = orb2
    ctx.fillRect(0, 0, 1080, 1080)

    // Decorative outer border box
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"
    ctx.lineWidth = 4
    ctx.strokeRect(50, 50, 980, 980)

    // Inner card box
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)"
    ctx.beginPath()
    ctx.roundRect(80, 80, 920, 920, 32)
    ctx.fill()
    ctx.strokeStyle = "rgba(249, 115, 22, 0.5)"
    ctx.lineWidth = 3
    ctx.stroke()

    // Header pill: "🎉 GAGNANT DU TIRAGE AU SORT"
    ctx.fillStyle = "rgba(249, 115, 22, 0.2)"
    ctx.beginPath()
    ctx.roundRect(260, 130, 560, 64, 32)
    ctx.fill()
    ctx.strokeStyle = "rgba(249, 115, 22, 0.6)"
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.font = "bold 26px system-ui, sans-serif"
    ctx.fillStyle = "#fbbf24"
    ctx.textAlign = "center"
    ctx.fillText("🎉 GAGNANT DU TIRAGE AU SORT", 540, 172)

    // Quiz Subject
    ctx.font = "bold 32px system-ui, sans-serif"
    ctx.fillStyle = "#cbd5e1"
    ctx.fillText(`Quiz : ${quizSubject}`, 540, 250)

    // Trophy Icon Text
    ctx.font = "110px system-ui, sans-serif"
    ctx.fillText("🏆", 540, 380)

    // Winner Name
    ctx.font = "900 64px system-ui, sans-serif"
    ctx.fillStyle = "#ffffff"
    ctx.fillText(winner.username, 540, 480)

    // Social Contact if present
    if (winner.socialContact) {
      ctx.font = "bold 30px system-ui, sans-serif"
      ctx.fillStyle = "#fb923c"
      ctx.fillText(winner.socialContact, 540, 535)
    }

    // Score Pill Box
    const scoreY = winner.socialContact ? 600 : 560
    ctx.fillStyle = "rgba(30, 41, 59, 0.95)"
    ctx.beginPath()
    ctx.roundRect(240, scoreY, 600, 120, 24)
    ctx.fill()
    ctx.strokeStyle = "rgba(251, 191, 36, 0.6)"
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.font = "bold 22px system-ui, sans-serif"
    ctx.fillStyle = "#94a3b8"
    ctx.fillText("SCORE FINAL", 540, scoreY + 42)

    ctx.font = "900 48px system-ui, sans-serif"
    ctx.fillStyle = "#fbbf24"
    ctx.fillText(`${winner.points.toLocaleString()} PTS`, 540, scoreY + 95)

    // Footer Branding: LTNHoot!
    ctx.font = "900 42px system-ui, sans-serif"
    ctx.fillStyle = "#f97316"
    ctx.fillText("LTNHoot!", 540, 935)

    ctx.font = "18px system-ui, sans-serif"
    ctx.fillStyle = "#64748b"
    ctx.fillText("Bravo à tous les participants !", 540, 970)

    // Download Image
    const dataUrl = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.download = `Gagnant_${winner.username}_${quizSubject}.png`
    link.href = dataUrl
    link.click()
    toast.success("Visuel réseaux de victoire téléchargé (PNG 1080x1080) !")
  } catch (error) {
    console.error("Export image error:", error)
    toast.error("Erreur lors de la génération du visuel.")
  }
}

// Participants affichés autour du podium : au-delà, la liste n'aide plus à
// arbitrer le tirage.
const SHORTLIST_SIZE = 10

const MEDAL_CLASSES = [
  "bg-amber-400 text-slate-950",
  "bg-slate-300 text-slate-950",
  "bg-amber-700 text-white",
]

const rankBadgeClass = (idx: number) =>
  MEDAL_CLASSES[idx] ?? "bg-slate-800 text-gray-300"

// Tirage au sort réservé aux classements des quiz solo « Réseaux ». Seuls les
// SOLO_DRAW_POOL_SIZE premiers sont éligibles ; supprimer une participation
// (bot, doublon) fait remonter le suivant dans le tirage.
export const SoloDrawModal: React.FC<Props> = ({ result, onClose }) => {
  const { socket } = useSocket()
  const quizName = resultDisplaySubject(result.subject)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null)
  const [winner, setWinner] = useState<GameResultPlayer | null>(null)

  const shortlist = useMemo(
    () =>
      [...result.players]
        .sort((a, b) => b.points - a.points)
        .slice(0, SHORTLIST_SIZE),
    [result],
  )

  const candidates = useMemo(
    () => shortlist.slice(0, SOLO_DRAW_POOL_SIZE),
    [shortlist],
  )

  const handleDeletePlayer = (username: string) => {
    socket?.emit(EVENTS.RESULTS.DELETE_PLAYER, {
      resultId: result.id,
      username,
    })
    setPendingDelete(null)
    // Le classement change : un gagnant déjà tiré n'a plus de sens.
    setWinner(null)
    setHighlightedIdx(null)
    toast.success(`Participation de ${username} supprimée`)
  }

  const handleStartDraw = () => {
    if (candidates.length === 0) {
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
      setHighlightedIdx(current % candidates.length)
      current += 1

      if (elapsed < durationMs) {
        speed = 80 + (elapsed / durationMs) ** 2 * 300
        setTimeout(animate, speed)
      } else {
        // Sélection aléatoire équitable parmi les finalistes
        const winnerIndex = Math.floor(Math.random() * candidates.length)
        setHighlightedIdx(winnerIndex)
        setWinner(candidates[winnerIndex])
        setIsSpinning(false)
        toast.success(`Le gagnant est ${candidates[winnerIndex].username} ! 🎉`)
      }
    }

    animate()
  }

  const winnerPostText = winner
    ? `🎉 ANNONCE GAGNANT DU QUIZ !
Félicitations à ${winner.username} ${winner.socialContact ? `(${winner.socialContact})` : ""} qui remporte le tirage au sort de la semaine sur le quiz "${quizName}" avec ${winner.points.toLocaleString()} pts !

Merci à tous les participants du Top ${SOLO_DRAW_POOL_SIZE} ! 🚀`
    : ""

  const handleCopyWinnerAnnouncement = () => {
    if (!winnerPostText) {
      return
    }

    navigator.clipboard.writeText(winnerPostText)
    toast.success("Texte d'annonce du gagnant copié pour vos réseaux !")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      {winner && <Confetti recycle={false} numberOfPieces={350} />}

      <div className="animate-in fade-in zoom-in w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl duration-200">
        {/* Header */}
        <div className="bg-slate-850 flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Dices className="size-6 text-amber-400" />
            <div>
              <h3 className="text-lg leading-none font-bold">
                Tirage au sort · Top {SOLO_DRAW_POOL_SIZE}
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                Quiz solo · {quizName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[80vh] space-y-6 overflow-y-auto p-6">
          {/* Classement : les premiers sont éligibles, les suivants restent
              visibles pour pouvoir supprimer une participation suspecte. */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-gray-300 uppercase">
                <Trophy className="size-4 text-amber-400" />
                Finalistes ({candidates.length}/{SOLO_DRAW_POOL_SIZE})
              </span>
              <span className="text-[11px] text-gray-400">
                Chaque finaliste a 1 chance égale d'être tiré au sort
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {shortlist.map((player, idx) => {
                const isEligible = idx < SOLO_DRAW_POOL_SIZE
                const isSelected = isEligible && highlightedIdx === idx
                const isWinner = winner?.username === player.username
                const isPendingDelete = pendingDelete === player.username

                return (
                  <div
                    key={player.username}
                    className={clsx(
                      "flex items-center justify-between rounded-xl border p-3 transition-all duration-150",
                      isWinner &&
                        "border-amber-400 bg-gradient-to-r from-amber-500/20 to-orange-500/20 shadow-lg ring-2 shadow-amber-500/20 ring-amber-400",
                      isSelected &&
                        !isWinner &&
                        "scale-[1.02] border-orange-400 bg-orange-500/20",
                      !isSelected &&
                        !isWinner &&
                        "border-white/10 bg-slate-950/70 hover:border-white/20",
                      !isEligible && !isWinner && "opacity-50",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={clsx(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                          rankBadgeClass(idx),
                        )}
                      >
                        #{idx + 1}
                      </span>

                      <div className="truncate">
                        <p className="flex items-center gap-1 truncate text-sm font-bold text-white">
                          {player.username}
                          {isWinner && (
                            <Crown className="inline size-4 shrink-0 fill-amber-400 text-amber-400" />
                          )}
                        </p>
                        {player.socialContact && (
                          <p className="truncate text-[11px] text-orange-300">
                            {player.socialContact}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="ml-2 flex shrink-0 items-center gap-2">
                      {isPendingDelete ? (
                        <>
                          <span className="text-[11px] text-gray-300">
                            Supprimer sa participation ?
                          </span>
                          <button
                            onClick={() => setPendingDelete(null)}
                            className="cursor-pointer rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-gray-300 transition-colors hover:bg-white/10"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.username)}
                            className="cursor-pointer rounded-lg bg-red-500 px-2 py-1 text-[11px] font-bold text-white transition-colors hover:bg-red-600"
                          >
                            Supprimer
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-extrabold text-amber-400">
                            {player.points.toLocaleString()} pts
                          </span>
                          <button
                            disabled={isSpinning}
                            onClick={() => setPendingDelete(player.username)}
                            title="Supprimer définitivement cette participation"
                            className="cursor-pointer rounded-lg p-1 text-gray-500 transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:cursor-default disabled:opacity-30"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {shortlist.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-slate-950/70 p-6 text-center text-sm text-gray-400 italic">
                Aucune participation enregistrée pour ce quiz.
              </p>
            )}

            {shortlist.length > SOLO_DRAW_POOL_SIZE && (
              <p className="mt-2 text-[11px] text-gray-500">
                Seuls les {SOLO_DRAW_POOL_SIZE} premiers participent au tirage —
                supprimer une participation fait remonter le suivant.
              </p>
            )}
          </div>

          {/* Banner Gagnant s'il existe */}
          {winner && (
            <div className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 p-5 text-center shadow-xl">
              <div className="mb-3 inline-flex rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 p-3 text-slate-950 shadow-lg shadow-amber-500/30">
                <Crown className="size-8" />
              </div>
              <h4 className="mb-1 text-xs font-bold tracking-widest text-amber-400 uppercase">
                Vainqueur du Tirage au Sort
              </h4>
              <p className="mb-1 text-2xl font-black text-white">
                {winner.username}
              </p>
              {winner.socialContact && (
                <p className="mb-3 text-xs font-semibold text-orange-300">
                  Contact : {winner.socialContact}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={handleCopyWinnerAnnouncement}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-700"
                >
                  <Send className="size-4 text-orange-400" />
                  <span>Copier le texte d'annonce</span>
                </button>

                <button
                  onClick={() => downloadWinnerVisualPNG(quizName, winner)}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:from-amber-600 hover:to-orange-600"
                >
                  <ImageIcon className="size-4" />
                  <span>Télécharger le Visuel Réseaux (PNG)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer avec Bouton de Tirage */}
        <div className="bg-slate-850 flex items-center justify-between border-t border-white/10 px-6 py-4">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Fermer
          </button>

          <button
            disabled={isSpinning || candidates.length === 0}
            onClick={handleStartDraw}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
          >
            <Dices className={clsx("size-5", isSpinning && "animate-spin")} />
            <span>
              {isSpinning ? "Tirage en cours..." : "Lancer le Tirage au Sort"}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
