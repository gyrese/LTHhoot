import React, { useEffect, useState, useMemo } from "react"
import { EVENTS } from "@rahoot/common/constants"
import type { GameResult, GameResultPlayer } from "@rahoot/common/types/game"
import {
  SOLO_DRAW_POOL_SIZE,
  resultDisplaySubject,
} from "@rahoot/common/utils/result-kind"
import Modal from "@rahoot/web/components/Modal"
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
import { createPortal } from "react-dom"
import toast from "react-hot-toast"
import clsx from "clsx"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import {
  downloadCanvasAsPng,
  renderSoloVictoryToCanvas,
} from "@rahoot/web/features/game/utils/podium-export"

type Props = {
  result: GameResult
  onClose: () => void
}

export const downloadWinnerVisualPNG = (
  quizSubject: string,
  winner: GameResultPlayer,
  t: TFunction,
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
    ctx.fillText(`🎉 ${t("manager:draw.visual.badge")}`, 540, 172)

    // Quiz Subject
    ctx.font = "bold 32px system-ui, sans-serif"
    ctx.fillStyle = "#cbd5e1"
    ctx.fillText(t("manager:draw.visual.quiz", { name: quizSubject }), 540, 250)

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
    ctx.fillText(t("manager:draw.visual.finalScore"), 540, scoreY + 42)

    ctx.font = "900 48px system-ui, sans-serif"
    ctx.fillStyle = "#fbbf24"
    ctx.fillText(
      t("manager:draw.visual.points", {
        points: winner.points.toLocaleString(),
      }),
      540,
      scoreY + 95,
    )

    // Footer Branding: LTNHoot!
    ctx.font = "900 42px system-ui, sans-serif"
    ctx.fillStyle = "#f97316"
    ctx.fillText("LTNHoot!", 540, 935)

    ctx.font = "18px system-ui, sans-serif"
    ctx.fillStyle = "#64748b"
    ctx.fillText(t("manager:draw.visual.thanks"), 540, 970)

    // Download Image
    const dataUrl = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.download = `Gagnant_${winner.username}_${quizSubject}.png`
    link.href = dataUrl
    link.click()
    toast.success(t("manager:draw.squareDownloaded"))
  } catch (error) {
    console.error("Export image error:", error)
    toast.error(t("manager:draw.visualFailed"))
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
  const { t } = useTranslation()
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

  // Suppression envoyée, confirmée quand le résultat réécrit par le serveur
  // (RESULTS.DATA) ne contient plus le joueur.
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (deleting && !result.players.some((p) => p.username === deleting)) {
      toast.success(
        t("manager:result.participationDeleted", { name: deleting }),
      )
      setDeleting(null)
    }
  }, [result])

  const handleDeletePlayer = (username: string) => {
    socket?.emit(EVENTS.RESULTS.DELETE_PLAYER, {
      resultId: result.id,
      username,
    })
    setPendingDelete(null)
    setDeleting(username)
    // Le classement change : un gagnant déjà tiré n'a plus de sens.
    setWinner(null)
    setHighlightedIdx(null)
  }

  const handleStartDraw = () => {
    if (candidates.length === 0) {
      toast.error(t("manager:draw.noCandidates"))

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
        toast.success(
          t("manager:draw.winnerIs", {
            name: candidates[winnerIndex].username,
          }),
        )
      }
    }

    animate()
  }

  const winnerPostText = winner
    ? t("manager:draw.announcement", {
        name: winner.username,
        contact: winner.socialContact ? ` (${winner.socialContact})` : "",
        quiz: quizName,
        points: winner.points.toLocaleString(),
        count: SOLO_DRAW_POOL_SIZE,
      })
    : ""

  const [isGeneratingOfficialVisual, setIsGeneratingOfficialVisual] =
    useState(false)

  const handleDownloadOfficialVictory = async () => {
    if (!winner) {
      return
    }

    setIsGeneratingOfficialVisual(true)
    try {
      const canvas = await renderSoloVictoryToCanvas(
        winner.username,
        winner.points,
        quizName,
      )
      downloadCanvasAsPng(
        canvas,
        `Victoire_Tirage_${winner.username}_${quizName}`,
      )
      toast.success(t("manager:draw.posterDownloaded"))
    } catch (err) {
      console.error("Erreur génération visuel victoire:", err)
      toast.error(t("manager:draw.visualFailed"))
    } finally {
      setIsGeneratingOfficialVisual(false)
    }
  }

  const handleCopyWinnerAnnouncement = () => {
    if (!winnerPostText) {
      return
    }

    navigator.clipboard
      .writeText(winnerPostText)
      .then(() => toast.success(t("manager:draw.announcementCopied")))
      .catch(() => toast.error(t("manager:share.copyFailed")))
  }

  return (
    // Au-dessus de ResultModal (z-60), qui l'ouvre.
    <Modal
      label={t("manager:draw.title", { count: SOLO_DRAW_POOL_SIZE })}
      onClose={onClose}
      overlayClassName="z-70 bg-black/70 backdrop-blur-md"
      className="animate-in fade-in zoom-in flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl duration-200"
    >
      {/* Confettis plein écran : portés dans `body` pour ne pas être rognés
          par le panneau (overflow-hidden) de la modale. */}
      {winner &&
        createPortal(
          <Confetti
            recycle={false}
            numberOfPieces={350}
            style={{ position: "fixed", zIndex: 80, pointerEvents: "none" }}
          />,
          document.body,
        )}

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/40 px-6 py-4">
        <div className="flex items-center gap-2">
          <Dices className="size-6 text-amber-400" />
          <div>
            <h3 className="text-lg leading-none font-bold">
              {t("manager:draw.title", { count: SOLO_DRAW_POOL_SIZE })}
            </h3>
            <p className="mt-1 text-xs text-gray-300">
              {t("manager:draw.subtitle", { name: quizName })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("manager:actions.close")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        {/* Classement : les premiers sont éligibles, les suivants restent
              visibles pour pouvoir supprimer une participation suspecte. */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-gray-300 uppercase">
              <Trophy className="size-4 text-amber-400" />
              {t("manager:draw.finalists", {
                current: candidates.length,
                count: SOLO_DRAW_POOL_SIZE,
              })}
            </span>
            <span className="text-xs text-gray-300">
              {t("manager:draw.equalChance")}
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
                        <span className="text-xs text-gray-300">
                          {t("manager:draw.deleteQuestion")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(null)}
                          className="min-h-8 cursor-pointer rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
                        >
                          {t("common:cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlayer(player.username)}
                          className="min-h-8 cursor-pointer rounded-lg bg-red-500 px-2 py-1 text-xs font-bold text-white transition-colors hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
                        >
                          {t("common:delete")}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-extrabold text-amber-400">
                          {t("manager:draw.points", {
                            points: player.points.toLocaleString(),
                          })}
                        </span>
                        <button
                          type="button"
                          disabled={isSpinning || deleting === player.username}
                          onClick={() => setPendingDelete(player.username)}
                          title={t("manager:result.deleteParticipation")}
                          aria-label={t(
                            "manager:result.deleteParticipationNamed",
                            { name: player.username },
                          )}
                          className="flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none disabled:cursor-default disabled:opacity-30"
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
              {t("manager:result.ranking.none")}
            </p>
          )}

          {shortlist.length > SOLO_DRAW_POOL_SIZE && (
            <p className="mt-2 text-xs text-gray-400">
              {t("manager:draw.poolHint", { count: SOLO_DRAW_POOL_SIZE })}
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
              {t("manager:draw.winnerTitle")}
            </h4>
            <p className="mb-1 text-2xl font-black text-white">
              {winner.username}
            </p>
            {winner.socialContact && (
              <p className="mb-3 text-xs font-semibold text-orange-300">
                {t("manager:draw.contact", { contact: winner.socialContact })}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCopyWinnerAnnouncement}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-700"
              >
                <Send className="size-4 text-orange-400" />
                <span>{t("manager:share.copyPost")}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadOfficialVictory}
                disabled={isGeneratingOfficialVisual}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
              >
                <ImageIcon className="size-4" />
                <span>
                  {isGeneratingOfficialVisual
                    ? t("manager:draw.generatingPoster")
                    : t("manager:draw.downloadPoster")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => downloadWinnerVisualPNG(quizName, winner, t)}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-4 py-2.5 text-xs font-bold text-gray-300 shadow-md transition-all hover:bg-slate-700 hover:text-white"
              >
                <span>{t("manager:draw.downloadSquare")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer avec Bouton de Tirage */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-slate-950/40 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
        >
          {t("manager:actions.close")}
        </button>

        <button
          type="button"
          data-autofocus
          disabled={isSpinning || candidates.length === 0}
          onClick={handleStartDraw}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
        >
          <Dices className={clsx("size-5", isSpinning && "animate-spin")} />
          <span>
            {isSpinning ? t("manager:draw.spinning") : t("manager:draw.start")}
          </span>
        </button>
      </div>
    </Modal>
  )
}
