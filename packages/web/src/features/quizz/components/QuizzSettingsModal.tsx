import { PODIUM_THEMES } from "@rahoot/common/constants"
import type { PodiumThemeSetting } from "@rahoot/common/types/game"
import { PODIUM_THEME_TOKENS } from "@rahoot/web/features/game/components/states/podium/themes"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { X, Upload, Sparkles, Dices, Trophy } from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

type Props = {
  open: boolean
  onClose: () => void
}

const QuizzSettingsModal = ({ open, onClose }: Props) => {
  const ctx = useQuizzEditor()
  const { t } = useTranslation()

  const [localSubject, setLocalSubject] = useState(ctx.subject)
  const [localDescription, setLocalDescription] = useState(ctx.description)
  const [localFolder, setLocalFolder] = useState(ctx.folder)
  const [localTags, setLocalTags] = useState<string[]>(ctx.tags)
  const [localImage, setLocalImage] = useState<string | undefined>(
    ctx.listingImage,
  )
  const [localSalonImage, setLocalSalonImage] = useState<string | undefined>(
    ctx.salonImage,
  )
  const [localPodiumTheme, setLocalPodiumTheme] = useState<PodiumThemeSetting>(
    ctx.podiumTheme ?? "neutre",
  )
  const [tagInput, setTagInput] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadingSalon, setUploadingSalon] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingSalon, setGeneratingSalon] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const salonFileInputRef = useRef<HTMLInputElement>(null)

  // Le composant reste monté entre deux ouvertures : les champs locaux gardent
  // sinon la valeur capturée au premier rendu. Une modification faite ailleurs
  // (description générée par l'IA, restauration d'un backup) serait invisible
  // ici — et écrasée par « Terminé ». D'où la resynchronisation à l'ouverture.
  useEffect(() => {
    if (!open) {
      return
    }

    setLocalSubject(ctx.subject)
    setLocalDescription(ctx.description)
    setLocalFolder(ctx.folder)
    setLocalTags(ctx.tags)
    setLocalImage(ctx.listingImage)
    setLocalSalonImage(ctx.salonImage)
    setLocalPodiumTheme(ctx.podiumTheme ?? "neutre")
    // Volontairement piloté par la seule ouverture : re-synchroniser à chaque
    // changement du contexte écraserait la saisie en cours.
  }, [open])

  if (!open) {
    return null
  }

  const handleDone = () => {
    if (!localSubject.trim()) {
      toast.error(t("errors:quizz.subjectEmpty"))

      return
    }

    ctx.setSubject(localSubject.trim())
    ctx.setDescription(localDescription)
    ctx.setFolder(localFolder)
    ctx.setTags(localTags)
    ctx.setListingImage(localImage)
    ctx.setSalonImage(localSalonImage)
    // "neutre" est le défaut : on ne stocke rien dans le quiz dans ce cas.
    ctx.setPodiumTheme(
      localPodiumTheme === "neutre" ? undefined : localPodiumTheme,
    )
    onClose()
  }

  const handleCancel = () => {
    setLocalSubject(ctx.subject)
    setLocalDescription(ctx.description)
    setLocalFolder(ctx.folder)
    setLocalTags(ctx.tags)
    setLocalImage(ctx.listingImage)
    setLocalSalonImage(ctx.salonImage)
    setLocalPodiumTheme(ctx.podiumTheme ?? "neutre")
    onClose()
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
        headers: { "x-client-id": localStorage.getItem("client_id") ?? "" },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error("Upload failed with status:", res.status, errorData)
        throw new Error(errorData.error || "Upload failed")
      }

      const data = (await res.json()) as { url: string }

      return data.url
    } catch (error) {
      console.error("Image upload error:", error)
      toast.error(t("errors:upload.failed"))

      return null
    }
  }

  const handleImageUpload = async (file: File) => {
    setUploading(true)
    const url = await uploadImage(file)

    if (url) {
      setLocalImage(url)
    }

    setUploading(false)
  }

  const handleSalonImageUpload = async (file: File) => {
    setUploadingSalon(true)
    const url = await uploadImage(file)

    if (url) {
      setLocalSalonImage(url)
    }

    setUploadingSalon(false)
  }

  const handleAiGenerate = async (
    subject: string,
    setImage: (url: string) => void,
    setBusy: (v: boolean) => void,
  ) => {
    setBusy(true)
    try {
      const res = await fetch("/ai-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": localStorage.getItem("client_id") ?? "",
        },
        body: JSON.stringify({ subject }),
      })

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(errorData.error || `Erreur serveur ${res.status}`)
      }

      const data = (await res.json()) as { url: string }
      if (data.url) {
        setImage(data.url)
      }
    } catch (err) {
      console.error("Génération IA échouée :", err)
      toast.error(t("errors:upload.failed"))
    } finally {
      setBusy(false)
    }
  }

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().replace(/,/gu, "")

      if (!localTags.includes(newTag)) {
        setLocalTags([...localTags, newTag])
      }

      setTagInput("")
    }

    if (e.key === "Backspace" && !tagInput && localTags.length) {
      setLocalTags(localTags.slice(0, -1))
    }
  }

  return (
    <div className="bg-surface text-ink fixed inset-0 z-50 flex flex-col">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-ink text-lg font-bold">
          {t("quizz:settings.title")}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="focus-ring border-border text-ink-muted hover:bg-panel rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
          >
            {t("common:cancel")}
          </button>
          <button
            type="button"
            onClick={handleDone}
            disabled={!localSubject.trim()}
            className="focus-ring bg-primary text-secondary rounded-lg px-4 py-2 text-sm font-semibold transition-transform hover:brightness-[0.97] active:scale-[0.98] disabled:opacity-40"
          >
            {t("common:done")}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="border-border w-52 border-r p-4">
          <button
            type="button"
            className="bg-primary-soft text-primary-ink w-full rounded-lg px-3 py-2 text-left text-sm font-semibold"
          >
            {t("quizz:settings.generalInfo")}
          </button>
        </aside>

        {/* Main content */}
        <main className="flex flex-1 gap-10 overflow-y-auto px-10 py-8">
          {/* Left column */}
          <div className="flex max-w-xl flex-1 flex-col gap-6">
            {/* Titre */}
            <div>
              <label className="text-ink mb-1 block text-sm font-bold">
                {t("quizz:settings.titleLabel")}
              </label>
              <p className="text-ink-subtle mb-2 text-xs">
                {t("quizz:settings.titleHint")}
              </p>
              <div className="relative">
                <input
                  value={localSubject}
                  onChange={(e) => setLocalSubject(e.target.value)}
                  maxLength={90}
                  className="border-border focus:border-primary w-full rounded-lg border px-4 py-3 pr-14 text-sm outline-none"
                  placeholder={t("quizz:titleQuizzPlaceholder")}
                />
                <span className="text-ink-subtle absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                  {localSubject.length}/90
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-ink mb-1 block text-sm font-bold">
                {t("quizz:settings.descriptionLabel")}{" "}
                <span className="text-ink-subtle font-normal">
                  ({t("common:optional")})
                </span>
              </label>
              <p className="text-ink-subtle mb-2 text-xs">
                {t("quizz:settings.descriptionHint")}
              </p>
              <div className="relative">
                <textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="border-border focus:border-primary w-full resize-none rounded-lg border px-4 py-3 pr-14 text-sm outline-none"
                  placeholder={t("quizz:settings.descriptionPlaceholder")}
                />
                <span className="text-ink-subtle absolute right-3 bottom-3 text-xs">
                  {localDescription.length}/500
                </span>
              </div>
            </div>

            {/* Dossier */}
            <div>
              <label className="text-ink mb-1 block text-sm font-bold">
                {t("quizz:settings.folderLabel")}
              </label>
              <input
                type="text"
                value={localFolder}
                onChange={(e) => setLocalFolder(e.target.value)}
                className="border-border focus:border-primary w-full rounded-lg border px-4 py-3 text-sm outline-none"
                placeholder={t("quizz:folderPlaceholder")}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-ink mb-1 block text-sm font-bold">
                {t("quizz:settings.tagsLabel")}
              </label>
              <div className="border-border focus-within:border-primary flex flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2">
                {localTags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-primary-soft text-primary-ink flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                  >
                    {tag}
                    <button
                      type="button"
                      className="text-primary-ink/60 hover:text-danger"
                      onClick={() =>
                        setLocalTags(localTags.filter((t) => t !== tag))
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  className="min-w-24 flex-1 bg-transparent text-sm outline-none"
                  placeholder={t("quizz:tagsPlaceholder")}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex w-72 flex-col gap-6">
            <div>
              <label className="text-ink mb-1 block text-sm font-bold">
                {t("quizz:settings.coverImageLabel")}
              </label>
              <p className="text-ink-subtle mb-3 text-xs">
                {t("quizz:settings.coverImageHint")}
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]

                  if (file) {
                    void handleImageUpload(file)
                  }

                  e.target.value = ""
                }}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || generating}
                  className="border-border-strong text-ink-subtle hover:border-primary hover:text-primary-ink flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed disabled:opacity-50"
                >
                  <Upload className="size-5" />
                  <span className="text-xs">
                    {uploading ? "…" : t("quizz:settings.upload")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleAiGenerate(
                      localSubject,
                      setLocalImage,
                      setGenerating,
                    )
                  }
                  disabled={!localSubject.trim() || generating || uploading}
                  title={t("quizz:settings.aiGenerateTooltip")}
                  className="border-primary/40 text-primary-ink hover:border-primary hover:bg-primary-soft flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed disabled:opacity-50"
                >
                  <Sparkles className="size-5" />
                  <span className="text-xs font-medium">
                    {generating ? "…" : t("quizz:settings.aiGenerate")}
                  </span>
                </button>

                {localImage && (
                  <div className="border-border relative h-24 w-36 overflow-hidden rounded-lg border">
                    <img
                      src={localImage}
                      alt="cover"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setLocalImage(undefined)}
                      className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Salon image */}
            <div>
              <label className="text-ink mb-1 block text-sm font-bold">
                Image du salon{" "}
                <span className="text-ink-subtle font-normal">
                  ({t("common:optional")})
                </span>
              </label>
              <p className="text-ink-subtle mb-3 text-xs">
                Affichée en arrière-plan sur l'écran d'attente des joueurs.
              </p>

              <input
                ref={salonFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]

                  if (file) {
                    void handleSalonImageUpload(file)
                  }

                  e.target.value = ""
                }}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => salonFileInputRef.current?.click()}
                  disabled={uploadingSalon || generatingSalon}
                  className="border-border-strong text-ink-subtle hover:border-primary hover:text-primary-ink flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed disabled:opacity-50"
                >
                  <Upload className="size-5" />
                  <span className="text-xs">
                    {uploadingSalon ? "…" : t("quizz:settings.upload")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleAiGenerate(
                      localSubject,
                      setLocalSalonImage,
                      setGeneratingSalon,
                    )
                  }
                  disabled={
                    !localSubject.trim() || generatingSalon || uploadingSalon
                  }
                  title={t("quizz:settings.aiGenerateTooltip")}
                  className="border-primary/40 text-primary-ink hover:border-primary hover:bg-primary-soft flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed disabled:opacity-50"
                >
                  <Sparkles className="size-5" />
                  <span className="text-xs font-medium">
                    {generatingSalon ? "…" : t("quizz:settings.aiGenerate")}
                  </span>
                </button>

                {localSalonImage && (
                  <div className="border-border relative h-24 w-36 overflow-hidden rounded-lg border">
                    <img
                      src={localSalonImage}
                      alt="salon"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setLocalSalonImage(undefined)}
                      className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Thème du podium */}
            <div>
              <label className="text-ink mb-1 block text-sm font-bold">
                {t("quizz:settings.podiumThemeLabel")}
              </label>
              <p className="text-ink-subtle mb-3 text-xs">
                {t("quizz:settings.podiumThemeHint")}
              </p>

              <div className="grid grid-cols-3 gap-2">
                {/* Neutre (défaut) — aperçu sur la couverture du quiz */}
                <button
                  type="button"
                  onClick={() => setLocalPodiumTheme("neutre")}
                  className={`relative h-16 overflow-hidden rounded-lg border-2 transition-colors ${
                    localPodiumTheme === "neutre"
                      ? "border-primary"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  {localImage || localSalonImage ? (
                    <img
                      src={localImage || localSalonImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover blur-[2px]"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(ellipse at 50% 30%, #26262c 0%, #131317 100%)",
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                  <Trophy className="absolute top-2 left-1/2 size-4 -translate-x-1/2 text-[#f5d67a]" />
                  <span className="absolute inset-x-1 bottom-1 truncate text-center text-[11px] font-semibold text-white">
                    {t("quizz:settings.podiumThemes.neutre")}
                  </span>
                </button>

                {/* Aléatoire — tire un univers au sort à chaque partie */}
                <button
                  type="button"
                  onClick={() => setLocalPodiumTheme("random")}
                  className={`bg-panel flex h-16 flex-col items-center justify-center gap-1 rounded-lg border-2 transition-colors ${
                    localPodiumTheme === "random"
                      ? "border-primary"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <Dices className="text-ink-muted size-5" />
                  <span className="text-ink text-[11px] font-semibold">
                    {t("quizz:settings.podiumThemes.random")}
                  </span>
                </button>

                {PODIUM_THEMES.map((themeId) => {
                  const tokens = PODIUM_THEME_TOKENS[themeId]

                  return (
                    <button
                      key={themeId}
                      type="button"
                      onClick={() => setLocalPodiumTheme(themeId)}
                      className={`relative h-16 overflow-hidden rounded-lg border-2 transition-colors ${
                        localPodiumTheme === themeId
                          ? "border-primary"
                          : "border-border hover:border-border-strong"
                      }`}
                    >
                      {/* Dégradé toujours présent en base, image en CSS
                          background par-dessus si elle existe : un fichier
                          manquant ne casse jamais l'aperçu (pas d'icône
                          "image brisée"). */}
                      <div
                        className="absolute inset-0"
                        style={{ background: tokens.baseGradient }}
                      />
                      {tokens.bgImage && (
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${tokens.bgImage})`,
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                      <span className="absolute inset-x-1 bottom-1 truncate text-center text-[11px] font-semibold text-white">
                        {t(`quizz:settings.podiumThemes.${themeId}`)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default QuizzSettingsModal
