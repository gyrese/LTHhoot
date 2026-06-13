import type { AnswerReveal } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  Image as ImageIcon,
  Link,
  Loader2,
  Play,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useRef, useState, type ChangeEvent } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const parseVideoId = (input: string): string | null => {
  const value = input.trim()

  if (!value) {
    return null
  }

  try {
    const url = new URL(value)

    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1) || null
    }

    if (url.hostname.includes("youtube.com")) {
      return (
        url.searchParams.get("v") ||
        (url.pathname.startsWith("/embed/")
          ? url.pathname.slice("/embed/".length)
          : null)
      )
    }
  } catch {
    if (/^[\w-]{11}$/u.test(value)) {
      return value
    }
  }

  return null
}

const QuestionEditorAnswerReveal = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showImageUrl, setShowImageUrl] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [uploading, setUploading] = useState(false)

  const reveal: AnswerReveal = currentQuestion.answerReveal ?? { enabled: false }

  const updateReveal = (patch: Partial<AnswerReveal>) => {
    updateQuestion(currentIndex, {
      answerReveal: { ...reveal, ...patch },
    })
  }

  const handleToggle = () => {
    updateReveal({ enabled: !reveal.enabled })
  }

  const handleUploadImage = async (file: File) => {
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
        headers: { "x-client-id": localStorage.getItem("client_id") ?? "" },
      })

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const data = (await res.json()) as { url: string }
      updateReveal({ image: data.url })
    } catch {
      toast.error(t("errors:upload.failed"))
    } finally {
      setUploading(false)
    }
  }

  const handleAddImageUrl = () => {
    const url = imageUrl.trim()

    if (!url) {
      return
    }

    updateReveal({ image: url })
    setImageUrl("")
    setShowImageUrl(false)
  }

  const handleChangeYoutube = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setYoutubeUrl(value)
    const videoId = parseVideoId(value)
    updateReveal({ videoId: videoId ?? undefined })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          Activer la carte réponse
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={reveal.enabled}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            reveal.enabled ? "bg-primary" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              reveal.enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Affiche une carte (image, vidéo YouTube et/ou texte) centrée sur
        l'écran des résultats.
      </p>

      {reveal.enabled && (
        <div className="flex flex-col gap-4 rounded-xl border-2 border-amber-100 bg-amber-50/40 p-3">
          {/* Image */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <ImageIcon className="size-4" /> Image
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]

                if (file) {
                  void handleUploadImage(file)
                }

                e.target.value = ""
              }}
            />

            {reveal.image ? (
              <div className="relative overflow-hidden rounded-lg border border-gray-200">
                <img
                  src={reveal.image}
                  alt="Aperçu réponse"
                  className="h-28 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => updateReveal({ image: undefined })}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-red-500"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    Importer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImageUrl((v) => !v)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold shadow-sm transition-colors ${
                      showImageUrl
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Link className="size-3.5" /> URL
                  </button>
                </div>

                {showImageUrl && (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddImageUrl()
                        }

                        if (e.key === "Escape") {
                          setShowImageUrl(false)
                        }
                      }}
                      placeholder="https://..."
                      className="focus:border-primary flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      disabled={!imageUrl.trim()}
                      className="bg-primary rounded px-2 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-amber-100" />

          {/* YouTube */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Play className="size-4" /> Vidéo YouTube
            </div>

            {reveal.videoId ? (
              <div className="relative overflow-hidden rounded-lg border border-gray-200">
                <img
                  src={`https://img.youtube.com/vi/${reveal.videoId}/mqdefault.jpg`}
                  alt="Miniature vidéo"
                  className="h-28 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateReveal({ videoId: undefined })
                    setYoutubeUrl("")
                  }}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-red-500"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={youtubeUrl}
                onChange={handleChangeYoutube}
                placeholder="URL ou ID de la vidéo"
                className="focus:border-primary w-full rounded border border-gray-200 px-2 py-1.5 text-xs outline-none"
              />
            )}
          </div>

          <div className="h-px bg-amber-100" />

          {/* Texte */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">Texte</span>
            <textarea
              value={reveal.text ?? ""}
              onChange={(e) => updateReveal({ text: e.target.value })}
              rows={3}
              placeholder="Explication, anecdote, détail de la réponse..."
              className="focus:border-primary w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-xs outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionEditorAnswerReveal
