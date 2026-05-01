import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { X, Upload } from "lucide-react"
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
  const [localImage, setLocalImage] = useState<string | undefined>(ctx.listingImage)
  const [tagInput, setTagInput] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    onClose()
  }

  const handleCancel = () => {
    setLocalSubject(ctx.subject)
    setLocalDescription(ctx.description)
    setLocalFolder(ctx.folder)
    setLocalTags(ctx.tags)
    setLocalImage(ctx.listingImage)
    onClose()
  }

  const handleImageUpload = async (file: File) => {
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/upload", { method: "POST", body: formData })

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const data = (await res.json()) as { url: string }
      setLocalImage(data.url)
    } catch {
      toast.error(t("errors:upload.failed"))
    } finally {
      setUploading(false)
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
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-800">{t("quizz:settings.title")}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t("common:cancel")}
          </button>
          <button
            type="button"
            onClick={handleDone}
            disabled={!localSubject.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {t("common:done")}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-gray-200 p-4">
          <button
            type="button"
            className="w-full rounded-md border-l-4 border-blue-600 bg-blue-50 px-3 py-2 text-left text-sm font-semibold text-blue-700"
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
              <label className="mb-1 block text-sm font-bold text-gray-800">
                {t("quizz:settings.titleLabel")}
              </label>
              <p className="mb-2 text-xs text-gray-500">{t("quizz:settings.titleHint")}</p>
              <div className="relative">
                <input
                  value={localSubject}
                  onChange={(e) => setLocalSubject(e.target.value)}
                  maxLength={90}
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 pr-14 text-sm outline-none focus:border-blue-500"
                  placeholder={t("quizz:titleQuizzPlaceholder")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {localSubject.length}/90
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-800">
                {t("quizz:settings.descriptionLabel")}{" "}
                <span className="font-normal text-gray-400">({t("common:optional")})</span>
              </label>
              <p className="mb-2 text-xs text-gray-500">{t("quizz:settings.descriptionHint")}</p>
              <div className="relative">
                <textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full resize-none rounded-lg border-2 border-gray-300 px-4 py-3 pr-14 text-sm outline-none focus:border-blue-500"
                  placeholder={t("quizz:settings.descriptionPlaceholder")}
                />
                <span className="absolute bottom-3 right-3 text-xs text-gray-400">
                  {localDescription.length}/500
                </span>
              </div>
            </div>

            {/* Dossier */}
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-800">
                {t("quizz:settings.folderLabel")}
              </label>
              <input
                type="text"
                value={localFolder}
                onChange={(e) => setLocalFolder(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                placeholder={t("quizz:folderPlaceholder")}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-800">
                {t("quizz:settings.tagsLabel")}
              </label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border-2 border-gray-300 px-3 py-2 focus-within:border-blue-500">
                {localTags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
                  >
                    {tag}
                    <button
                      type="button"
                      className="text-blue-400 hover:text-red-500"
                      onClick={() => setLocalTags(localTags.filter((t) => t !== tag))}
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
              <label className="mb-1 block text-sm font-bold text-gray-800">
                {t("quizz:settings.coverImageLabel")}
              </label>
              <p className="mb-3 text-xs text-gray-500">{t("quizz:settings.coverImageHint")}</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]

                  if (file) { void handleImageUpload(file) }

                  e.target.value = ""
                }}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 disabled:opacity-50"
                >
                  <Upload className="size-5" />
                  <span className="text-xs">{uploading ? "…" : t("quizz:settings.upload")}</span>
                </button>

                {localImage && (
                  <div className="relative h-24 w-36 overflow-hidden rounded-lg border border-gray-200">
                    <img src={localImage} alt="cover" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setLocalImage(undefined)}
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
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
