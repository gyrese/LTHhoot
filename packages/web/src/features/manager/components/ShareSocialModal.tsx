import { EVENTS } from "@rahoot/common/constants"
import { quizzDisplayName } from "@rahoot/common/utils/quizz-name"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import React, { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  Copy,
  Check,
  X,
  Share2,
  Download,
  Sparkles,
  Send,
  Pencil,
} from "lucide-react"
import toast from "react-hot-toast"

type Props = {
  quizz: {
    id: string
    subject: string
    publicName?: string
    description?: string
  }
  onClose: () => void
}

export const ShareSocialModal: React.FC<Props> = ({ quizz, onClose }) => {
  const { socket } = useSocket()
  const [copied, setCopied] = useState(false)
  const [publicName, setPublicName] = useState(quizz.publicName ?? "")
  const [description, setDescription] = useState(quizz.description ?? "")

  // La modale reste montée d'un quiz à l'autre : on resynchronise les champs
  // sur le quiz affiché, et sur les valeurs renvoyées par le serveur.
  useEffect(() => {
    setPublicName(quizz.publicName ?? "")
    setDescription(quizz.description ?? "")
  }, [quizz.id, quizz.publicName, quizz.description])

  // Nom vu par les joueurs : nom public du quiz si renseigné, sinon son titre.
  const displayName = quizzDisplayName({ subject: quizz.subject, publicName })
  const shareUrl = `${window.location.origin}/solo/${quizz.id}`
  const isInfoDirty =
    publicName.trim() !== (quizz.publicName ?? "").trim() ||
    description.trim() !== (quizz.description ?? "").trim()

  const handleSavePublicInfo = () => {
    socket?.emit(EVENTS.QUIZZ.SET_PUBLIC_INFO, {
      id: quizz.id,
      publicName: publicName.trim() || null,
      description: description.trim() || null,
    })
    toast.success("Informations publiques enregistrées !")
  }

  const socialPostText = `🚀 Quiz de la semaine : "${displayName}" !
Testez vos connaissances et tentez de remporter le tirage au sort parmi les 10 meilleurs scores en fin de semaine ! 🏆

👉 Jouez gratuitement ici : ${shareUrl}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success("Lien copié dans le presse-papier !")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyPost = () => {
    navigator.clipboard.writeText(socialPostText)
    toast.success("Texte d'annonce copié pour vos réseaux !")
  }

  const handleDownloadQR = () => {
    const svg = document.getElementById("quiz-share-qr")

    if (!svg) {return}

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

    img.src =
      `data:image/svg+xml;base64,${  btoa(unescape(encodeURIComponent(svgData)))}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl duration-200">
        {/* Header */}
        <div className="bg-slate-850 flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Share2 className="size-5 text-orange-400" />
            <h3 className="text-lg font-bold">Diffuser sur les Réseaux</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Quiz Subject */}
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-center">
            <span className="mb-1 block text-xs font-semibold tracking-wider text-orange-300 uppercase">
              Quiz sélectionné
            </span>
            <p className="text-lg font-bold text-white">{displayName}</p>
            {publicName.trim() && (
              <p className="mt-1 text-xs text-gray-400">
                Titre interne : {quizz.subject}
              </p>
            )}
          </div>

          {/* Nom public — celui que les joueurs verront sur la page solo */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-300 uppercase">
              Nom affiché aux joueurs
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Pencil className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500" />
                <input
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
                  className="w-full rounded-xl border border-white/15 bg-slate-950 py-2.5 pr-3.5 pl-9 text-sm text-white placeholder-gray-500 focus:border-orange-500/60 focus:outline-none"
                />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">
              Laissez vide pour afficher le titre du quiz.
            </p>
          </div>

          {/* Règles — écran de 3 s affiché avant la 1re question */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-300 uppercase">
              Règles du quiz
            </label>
            <textarea
              value={description}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : 10 questions, 20 s par question. Le plus rapide marque le plus de points !"
              className="w-full resize-none rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-orange-500/60 focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">
                Affichées 3 secondes avant la première question. Vide = écran
                passé.
              </p>
              <button
                onClick={handleSavePublicInfo}
                disabled={!isInfoDirty}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-default disabled:bg-slate-800 disabled:text-gray-500"
              >
                <Check className="size-4" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>

          {/* Lien Direct */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-300 uppercase">
              Lien public de réponse (Mode Solo)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-gray-200 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? "Copié" : "Copier"}</span>
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
                onClick={handleDownloadQR}
                className="flex cursor-pointer items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300"
              >
                <Download className="size-3.5" />
                <span>Télécharger le QR Code</span>
              </button>
            </div>

            {/* Publication réseaux */}
            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-950 p-3.5">
              <div>
                <span className="mb-1.5 flex items-center gap-1 text-xs font-bold text-gray-300">
                  <Sparkles className="size-3.5 text-amber-400" />
                  Post prêt à publier
                </span>
                <p className="line-clamp-4 rounded border border-white/5 bg-slate-900 p-2 text-[11px] text-gray-400 italic">
                  {socialPostText}
                </p>
              </div>

              <button
                onClick={handleCopyPost}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
              >
                <Send className="size-3.5 text-orange-400" />
                <span>Copier le texte d'annonce</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-850 flex justify-end border-t border-white/10 px-6 py-4">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
