import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { X, Upload, Sparkles } from "lucide-react"
import { useRef, useState, type KeyboardEvent } from "react"
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
  const [tagInput, setTagInput] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadingSalon, setUploadingSalon] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingSalon, setGeneratingSalon] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const salonFileInputRef = useRef<HTMLInputElement>(null)

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
    onClose()
  }

  const handleCancel = () => {
    setLocalSubject(ctx.subject)
    setLocalDescription(ctx.description)
    setLocalFolder(ctx.folder)
    setLocalTags(ctx.tags)
    setLocalImage(ctx.listingImage)
    setLocalSalonImage(ctx.salonImage)
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
                  className="w-full rounded-lg border border-border px-4 py-3 pr-14 text-sm outline-none focus:border-primary"
                  placeholder={t("quizz:titleQuizzPlaceholder")}
                />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-subtle">
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
                  className="w-full resize-none rounded-lg border border-border px-4 py-3 pr-14 text-sm outline-none focus:border-primary"
                  placeholder={t("quizz:settings.descriptionPlaceholder")}
                />
                <span className="absolute right-3 bottom-3 text-xs text-ink-subtle">
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
                className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none focus:border-primary"
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
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-strong text-ink-subtle hover:border-primary hover:text-primary-ink disabled:opacity-50"
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
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/40 text-primary-ink hover:border-primary hover:bg-primary-soft disabled:opacity-50"
                >
                  <Sparkles className="size-5" />
                  <span className="text-xs font-medium">
                    {generating ? "…" : t("quizz:settings.aiGenerate")}
                  </span>
                </button>

                {localImage && (
                  <div className="relative h-24 w-36 overflow-hidden rounded-lg border border-border">
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
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-strong text-ink-subtle hover:border-primary hover:text-primary-ink disabled:opacity-50"
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
                  disabled={!localSubject.trim() || generatingSalon || uploadingSalon}
                  title={t("quizz:settings.aiGenerateTooltip")}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/40 text-primary-ink hover:border-primary hover:bg-primary-soft disabled:opacity-50"
                >
                  <Sparkles className="size-5" />
                  <span className="text-xs font-medium">
                    {generatingSalon ? "…" : t("quizz:settings.aiGenerate")}
                  </span>
                </button>

                {localSalonImage && (
                  <div className="relative h-24 w-36 overflow-hidden rounded-lg border border-border">
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
          </div>
        </main>
      </div>
    </div>
  )
}

export default QuizzSettingsModal
