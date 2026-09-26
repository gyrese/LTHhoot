import { EVENTS } from "@rahoot/common/constants"
import { quizzDisplayName } from "@rahoot/common/utils/quizz-name"
import { SOLO_DRAW_POOL_SIZE } from "@rahoot/common/utils/result-kind"
import Modal from "@rahoot/web/components/Modal"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import React, { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  Copy,
  Check,
  X,
  Share2,
  Download,
  Loader2,
  Sparkles,
  Send,
  Pencil,
} from "lucide-react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type Props = {
  quizz: {
    id: string
    subject: string
    publicName?: string
    description?: string
  }
  onClose: () => void
}

type PublicInfo = { publicName: string; description: string }

export const ShareSocialModal: React.FC<Props> = ({ quizz, onClose }) => {
  const { socket } = useSocket()
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [publicName, setPublicName] = useState(quizz.publicName ?? "")
  const [description, setDescription] = useState(quizz.description ?? "")
  // Valeurs envoyées au serveur, en attente de confirmation : SET_PUBLIC_INFO
  // n'a pas d'accusé, le succès se lit dans la config renvoyée (le quiz porte
  // alors les nouvelles valeurs), l'échec dans QUIZZ.ERROR.
  const [pendingSave, setPendingSave] = useState<PublicInfo | null>(null)

  // La modale reste montée d'un quiz à l'autre : on resynchronise les champs
  // sur le quiz affiché, et sur les valeurs renvoyées par le serveur.
  useEffect(() => {
    setPublicName(quizz.publicName ?? "")
    setDescription(quizz.description ?? "")

    if (
      pendingSave &&
      (quizz.publicName ?? "") === pendingSave.publicName &&
      (quizz.description ?? "") === pendingSave.description
    ) {
      toast.success(t("manager:share.saved"))
      setPendingSave(null)
    }
  }, [quizz.id, quizz.publicName, quizz.description])

  // Le toast d'erreur est affiché par QuizzPanel (écouteur QUIZZ.ERROR) : ici
  // on se contente de libérer le bouton.
  useEvent(EVENTS.QUIZZ.ERROR, () => {
    setPendingSave(null)
  })

  // Nom vu par les joueurs : nom public du quiz si renseigné, sinon son titre.
  const displayName = quizzDisplayName({ subject: quizz.subject, publicName })
  const shareUrl = `${window.location.origin}/solo/${quizz.id}`
  const isInfoDirty =
    publicName.trim() !== (quizz.publicName ?? "").trim() ||
    description.trim() !== (quizz.description ?? "").trim()

  const handleSavePublicInfo = () => {
    if (pendingSave) {
      return
    }

    setPendingSave({
      publicName: publicName.trim(),
      description: description.trim(),
    })
    socket?.emit(EVENTS.QUIZZ.SET_PUBLIC_INFO, {
      id: quizz.id,
      publicName: publicName.trim() || null,
      description: description.trim() || null,
    })
  }

  // Le texte d'annonce cite la taille réelle du tirage (SOLO_DRAW_POOL_SIZE),
  // et non plus un « 10 meilleurs » écrit en dur.
  const socialPostText = t("manager:share.post", {
    name: displayName,
    count: SOLO_DRAW_POOL_SIZE,
    url: shareUrl,
  })

  const copyToClipboard = (text: string, successMessage: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(successMessage)

        return true
      })
      .catch(() => {
        toast.error(t("manager:share.copyFailed"))

        return false
      })

  const handleCopyLink = () => {
    void copyToClipboard(shareUrl, t("manager:share.linkCopied")).then((ok) => {
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    })
  }

  const handleCopyPost = () => {
    void copyToClipboard(socialPostText, t("manager:share.postCopied"))
  }

  const handleDownloadQR = () => {
    const svg = document.getElementById("quiz-share-qr")

    if (!svg) {
      return
    }

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height

      if (ctx) {
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        const pngFile = canvas.toDataURL("image/png")
        const downloadLink = document.createElement("a")
        downloadLink.download = `QR_Quiz_${displayName}.png`
        downloadLink.href = pngFile
        downloadLink.click()
      }
    }

    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`
  }

  // Rendu via la primitive Modal, donc dans un portal : le panneau des quiz
  // porte un `backdrop-blur` qui rognait la modale (cf. ResultModal).
  return (
    <Modal
      label={t("manager:share.title")}
      onClose={onClose}
      overlayClassName="z-50 bg-black/65 backdrop-blur-sm"
      className="animate-in fade-in zoom-in flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl duration-200"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/40 px-6 py-4">
        <div className="flex items-center gap-2">
          <Share2 className="size-5 text-orange-400" />
          <h3 className="text-lg font-bold">{t("manager:share.title")}</h3>
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

      {/* Content */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        {/* Quiz Subject */}
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-center">
          <span className="mb-1 block text-xs font-semibold tracking-wider text-orange-300 uppercase">
            {t("manager:share.selectedQuiz")}
          </span>
          <p className="text-lg font-bold text-white">{displayName}</p>
          {publicName.trim() && (
            <p className="mt-1 text-xs text-gray-300">
              {t("manager:share.internalTitle", { subject: quizz.subject })}
            </p>
          )}
        </div>

        {/* Nom public — celui que les joueurs verront sur la page solo */}
        <div>
          <label
            htmlFor="share-public-name"
            className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-300 uppercase"
          >
            {t("manager:share.publicName")}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Pencil className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <input
                id="share-public-name"
                type="text"
                value={publicName}
                maxLength={90}
                onChange={(e) => setPublicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isInfoDirty) {
                    handleSavePublicInfo()
                  }
                }}
                placeholder={quizz.subject}
                className="w-full rounded-xl border border-white/15 bg-slate-950 py-2.5 pr-3.5 pl-9 text-sm text-white placeholder-gray-500 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
              />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            {t("manager:share.publicNameHint")}
          </p>
        </div>

        {/* Règles — écran de 3 s affiché avant la 1re question */}
        <div>
          <label
            htmlFor="share-rules"
            className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-300 uppercase"
          >
            {t("manager:share.rules")}
          </label>
          <textarea
            id="share-rules"
            value={description}
            maxLength={500}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("manager:share.rulesPlaceholder")}
            className="w-full resize-none rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              {t("manager:share.rulesHint")}
            </p>
            <button
              type="button"
              onClick={handleSavePublicInfo}
              disabled={!isInfoDirty || Boolean(pendingSave)}
              aria-busy={Boolean(pendingSave)}
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:outline-none disabled:cursor-default disabled:bg-slate-800 disabled:text-gray-400"
            >
              {pendingSave ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              <span>{t("manager:share.save")}</span>
            </button>
          </div>
        </div>

        {/* Lien Direct */}
        <div>
          <label
            htmlFor="share-url"
            className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-300 uppercase"
          >
            {t("manager:share.link")}
          </label>
          <div className="flex gap-2">
            <input
              id="share-url"
              type="text"
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-gray-200 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:outline-none"
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              <span>
                {copied ? t("manager:share.copied") : t("manager:share.copy")}
              </span>
            </button>
          </div>
        </div>

        {/* QR Code & Post Builder */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* QR Code */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-slate-950 p-4 text-center">
            <div className="mb-3 rounded-xl bg-white p-3 shadow-md">
              <QRCodeSVG
                id="quiz-share-qr"
                value={shareUrl}
                size={110}
                level="M"
              />
            </div>
            <button
              type="button"
              onClick={handleDownloadQR}
              className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-orange-400 hover:text-orange-300 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
            >
              <Download className="size-3.5" />
              <span>{t("manager:share.downloadQr")}</span>
            </button>
          </div>

          {/* Publication réseaux */}
          <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-950 p-3.5">
            <div>
              <span className="mb-1.5 flex items-center gap-1 text-xs font-bold text-gray-300">
                <Sparkles className="size-3.5 text-amber-400" />
                {t("manager:share.postTitle")}
              </span>
              <p className="line-clamp-4 rounded border border-white/5 bg-slate-900 p-2 text-xs whitespace-pre-line text-gray-300 italic">
                {socialPostText}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyPost}
              className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
            >
              <Send className="size-3.5 text-orange-400" />
              <span>{t("manager:share.copyPost")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 justify-end border-t border-white/10 bg-slate-950/40 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
        >
          {t("manager:actions.close")}
        </button>
      </div>
    </Modal>
  )
}
