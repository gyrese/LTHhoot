import { Link2, Share2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"
import type { SoloPublicQuizz } from "@rahoot/common/types/solo"

type Props = {
  quizz: SoloPublicQuizz | null
  points: number
}

type SocialApp = "instagram" | "tiktok"

const APP_URLS: Record<SocialApp, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/",
}

const APP_NAMES: Record<SocialApp, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
}

// Téléphone ou tablette : le menu de partage natif y liste les applis
// installées (Instagram, TikTok, Messenger…). Sur ordinateur il ne propose que
// les applis du système (Outlook sous Windows), d'où les boutons dédiés.
const hasMobileShareSheet = () =>
  typeof navigator.share === "function" &&
  window.matchMedia("(pointer: coarse)").matches

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
    <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
  </svg>
)

const InstagramIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
    <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.37-2.48V9.66a5.73 5.73 0 0 0-.77-.05A5.7 5.7 0 0 0 4.17 15.3 5.7 5.7 0 0 0 9.86 21a5.7 5.7 0 0 0 5.69-5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48Z" />
  </svg>
)

const buttonClass =
  "flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"

// Partage du score solo vers les réseaux sociaux. Facebook accepte un lien de
// partage direct ; Instagram et TikTok n'en proposent aucun pour le web.
const SoloSharePanel = ({ quizz, points }: Props) => {
  const { t } = useTranslation()

  if (!quizz) {
    return null
  }

  const title = quizz.subject
  const text = t("game:solo.shareText", {
    points: points.toLocaleString(),
    subject: quizz.subject,
  })
  const url = window.location.href
  const message = `${text} ${url}`

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)

      return true
    } catch {
      return false
    }
  }

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=600",
    )
  }

  // Instagram / TikTok : menu de partage du téléphone (où ces applis
  // apparaissent) ; sinon message copié puis site de l'appli ouvert.
  const shareToApp = async (app: SocialApp) => {
    if (hasMobileShareSheet()) {
      try {
        await navigator.share({ title, text, url })

        return
      } catch {
        // Annulé par l'utilisateur : on retombe sur la copie du message.
      }
    }

    const copied = await copy(message)

    if (copied) {
      toast.success(t("game:solo.sharePasteIn", { app: APP_NAMES[app] }))
    }

    window.open(APP_URLS[app], "_blank", "noopener,noreferrer")
  }

  const copyLink = async () => {
    if (await copy(url)) {
      toast.success(t("game:solo.linkCopied"))
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-orange-400/30 bg-gradient-to-r from-orange-500/20 to-amber-500/20 p-3">
      <p className="flex items-center justify-center gap-2 text-sm font-extrabold text-white">
        <Share2 className="size-4" aria-hidden />
        {t("game:solo.share")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={shareToFacebook}
          className={`${buttonClass} bg-[#1877F2]`}
        >
          <FacebookIcon />
          Facebook
        </button>
        <button
          type="button"
          onClick={() => void shareToApp("instagram")}
          className={`${buttonClass} bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]`}
        >
          <InstagramIcon />
          Instagram
        </button>
        <button
          type="button"
          onClick={() => void shareToApp("tiktok")}
          className={`${buttonClass} border border-white/20 bg-black`}
        >
          <TikTokIcon />
          TikTok
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          className={`${buttonClass} border border-white/20 bg-white/10`}
        >
          <Link2 className="size-5" aria-hidden />
          {t("game:solo.copyLink")}
        </button>
      </div>
    </div>
  )
}

export default SoloSharePanel
