import React, { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, X, Share2, Download, Sparkles, Send } from "lucide-react"
import toast from "react-hot-toast"

type Props = {
  quizz: {
    id: string
    subject: string
  }
  onClose: () => void
}

export const ShareSocialModal: React.FC<Props> = ({ quizz, onClose }) => {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/solo/${quizz.id}`

  const socialPostText = `🚀 Quiz de la semaine : "${quizz.subject}" !
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
    if (!svg) return

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
        downloadLink.download = `QR_Quiz_${quizz.subject}.png`
        downloadLink.href = pngFile
        downloadLink.click()
      }
    }

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-slate-850">
          <div className="flex items-center gap-2">
            <Share2 className="size-5 text-orange-400" />
            <h3 className="font-bold text-lg">Diffuser sur les Réseaux</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quiz Subject */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
            <span className="text-xs text-orange-300 font-semibold uppercase tracking-wider block mb-1">
              Quiz sélectionné
            </span>
            <p className="font-bold text-lg text-white">{quizz.subject}</p>
          </div>

          {/* Lien Direct */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
              Lien public de réponse (Mode Solo)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer text-sm shrink-0 shadow-md shadow-orange-500/20"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span>{copied ? "Copié" : "Copier"}</span>
              </button>
            </div>
          </div>

          {/* QR Code & Post Builder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* QR Code */}
            <div className="bg-slate-950 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <div className="bg-white p-3 rounded-xl mb-3 shadow-md">
                <QRCodeSVG id="quiz-share-qr" value={shareUrl} size={110} level="M" />
              </div>
              <button
                onClick={handleDownloadQR}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Download className="size-3.5" />
                <span>Télécharger le QR Code</span>
              </button>
            </div>

            {/* Publication réseaux */}
            <div className="bg-slate-950 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1 mb-1.5">
                  <Sparkles className="size-3.5 text-amber-400" />
                  Post prêt à publier
                </span>
                <p className="text-[11px] text-gray-400 line-clamp-4 italic bg-slate-900 p-2 rounded border border-white/5">
                  {socialPostText}
                </p>
              </div>

              <button
                onClick={handleCopyPost}
                className="w-full mt-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="size-3.5 text-orange-400" />
                <span>Copier le texte d'annonce</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-4 bg-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-white/10 transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
