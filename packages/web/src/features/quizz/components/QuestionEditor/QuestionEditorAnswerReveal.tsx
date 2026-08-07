import { EVENTS } from "@rahoot/common/constants"
import type { AnswerReveal, Question } from "@rahoot/common/types/game"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  Image as ImageIcon,
  Link,
  Loader2,
  Play,
  Sparkles,
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

const getSolutionText = (q: Question): string | undefined => {
  if (q.type === "mcq") {
    const solutions = Array.isArray(q.solutions) ? q.solutions : []

    
return solutions
      .map((i) => q.answers?.[i])
      .filter((a): a is string => Boolean(a && a.trim()))
      .join(", ")
  }

  if (q.type === "true_false") {
    return q.solution === 0 ? "Vrai" : "Faux"
  }

  if (q.type === "open") {
    return q.correctAnswers?.filter(Boolean).join(", ")
  }

  if (q.type === "date") {
    return q.correctYear !== undefined ? String(q.correctYear) : undefined
  }

  if (q.type === "slider") {
    return q.correctValue !== undefined ? String(q.correctValue) : undefined
  }

  if (q.type === "puzzle") {
    return q.items?.filter(Boolean).join(" -> ")
  }

  if (q.type === "drop_pin") {
    return q.zones
      ?.filter((z) => z.isCorrect)
      .map((z) => z.label)
      .filter(Boolean)
      .join(", ")
  }

  if (q.type === "image_sequence") {
    return q.correctAnswers?.filter(Boolean).join(", ")
  }

  
return undefined
}

const QuestionEditorAnswerReveal = () => {
  const { currentQuestion, currentIndex, updateQuestion, questions } =
    useQuizzEditor()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showImageUrl, setShowImageUrl] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [isGeneratingAiExplanation, setIsGeneratingAiExplanation] =
    useState(false)
  const pendingAiRef = useRef<{ index: number; id: string } | null>(null)

  const reveal: AnswerReveal = currentQuestion.answerReveal ?? {
    enabled: false,
  }

  const updateReveal = (patch: Partial<AnswerReveal>) => {
    updateQuestion(currentIndex, {
      answerReveal: { ...reveal, ...patch },
    })
  }

  const handleToggle = () => {
    updateReveal({ enabled: !reveal.enabled })
  }

  const handleGenerateAiExplanation = () => {
    if (
      !socket ||
      isGeneratingAiExplanation ||
      !currentQuestion.question?.trim()
    ) {
      return
    }

    const solutionText = getSolutionText(currentQuestion)
    pendingAiRef.current = { index: currentIndex, id: currentQuestion.id }
    setIsGeneratingAiExplanation(true)

    socket.emit(EVENTS.QUIZZ.AI_GENERATE_EXPLANATION, {
      question: currentQuestion.question,
      solutionText,
      type: currentQuestion.type,
    })
  }

  useEvent(EVENTS.QUIZZ.AI_GENERATE_EXPLANATION_SUCCESS, ({ explanation }) => {
    const req = pendingAiRef.current

    if (!req) {
      return
    }

    pendingAiRef.current = null
    setIsGeneratingAiExplanation(false)

    if (questions[req.index]?.id === req.id) {
      const rev = questions[req.index]?.answerReveal ?? { enabled: true }
      updateQuestion(req.index, {
        answerReveal: {
          ...rev,
          enabled: true,
          text: explanation,
        },
      })
    }
  })

  useEvent(EVENTS.QUIZZ.AI_ERROR, (message) => {
    if (!pendingAiRef.current) {
      return
    }

    pendingAiRef.current = null
    setIsGeneratingAiExplanation(false)
    toast.error(t(message))
  })

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
    const {value} = e.target
    setYoutubeUrl(value)
    const videoId = parseVideoId(value)
    updateReveal({ videoId: videoId ?? undefined })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-ink text-sm font-semibold">
          Activer la carte réponse
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={reveal.enabled}
          onClick={handleToggle}
          className={`focus-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 ${
            reveal.enabled ? "bg-primary" : "bg-border-strong"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-150 ${
              reveal.enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <p className="text-ink-subtle text-xs leading-relaxed">
        Affiche une carte (image, vidéo YouTube et/ou texte) centrée sur l'écran
        des résultats.
      </p>

      {reveal.enabled && (
        <div className="border-border bg-panel flex flex-col gap-4 rounded-xl border p-3">
          {/* Image */}
          <div className="flex flex-col gap-2">
            <div className="text-ink flex items-center gap-2 text-sm font-semibold">
              <ImageIcon className="text-ink-subtle size-4" /> Image
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
              <div className="border-border relative overflow-hidden rounded-lg border">
                <img
                  src={reveal.image}
                  alt="Aperçu réponse"
                  className="h-28 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => updateReveal({ image: undefined })}
                  className="hover:bg-danger absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white transition-colors"
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
                    className="focus-ring border-border bg-surface text-ink-muted hover:bg-panel hover:text-ink flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
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
                    className={`focus-ring flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold shadow-sm transition-colors ${
                      showImageUrl
                        ? "border-primary bg-primary-soft text-primary-ink"
                        : "border-border bg-surface text-ink-muted hover:bg-panel hover:text-ink"
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
                      className="border-border text-ink focus:border-primary focus:ring-primary/30 flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      disabled={!imageUrl.trim()}
                      className="bg-primary text-secondary rounded-lg px-2.5 text-xs font-semibold transition-transform hover:brightness-[0.97] active:scale-95 disabled:opacity-40"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-border h-px" />

          {/* YouTube */}
          <div className="flex flex-col gap-2">
            <div className="text-ink flex items-center gap-2 text-sm font-semibold">
              <Play className="text-ink-subtle size-4" /> Vidéo YouTube
            </div>

            {reveal.videoId ? (
              <div className="border-border relative overflow-hidden rounded-lg border">
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
                  className="hover:bg-danger absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white transition-colors"
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
                className="border-border text-ink focus:border-primary focus:ring-primary/30 w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2"
              />
            )}
          </div>

          <div className="bg-border h-px" />

          {/* Texte */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-ink text-sm font-semibold">Texte</span>
              <button
                type="button"
                onClick={handleGenerateAiExplanation}
                disabled={
                  isGeneratingAiExplanation || !currentQuestion.question?.trim()
                }
                className="text-primary hover:bg-primary-soft focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                title={t(
                  "quizz:question.aiGenerateExplanationTooltip",
                  "Générer une explication automatique d'après la question et la réponse",
                )}
              >
                {isGeneratingAiExplanation ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                <span>
                  {t("quizz:question.aiGenerateExplanation", "Générer par IA")}
                </span>
              </button>
            </div>
            <textarea
              value={reveal.text ?? ""}
              onChange={(e) => updateReveal({ text: e.target.value })}
              rows={3}
              placeholder="Explication, anecdote, détail de la réponse..."
              className="border-border text-ink focus:border-primary focus:ring-primary/30 w-full resize-none rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionEditorAnswerReveal
