import type { ImageSequenceQuestion } from "@rahoot/common/types/game"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import {
  useQuizzEditor,
  type QuestionWithId,
} from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { Minus, Plus, GripVertical, Upload } from "lucide-react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type ImageSeqWithId = ImageSequenceQuestion & { id: string }

const QuestionEditorImageSequence = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const q = currentQuestion as QuestionWithId & ImageSeqWithId
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState("")

  // ── Images ──────────────────────────────────────────────────────────────────

  const addImageByUrl = () => {
    const url = urlInput.trim()

    if (!url) {
      return
    }

    updateQuestion(currentIndex, { images: [...q.images, url] })
    setUrlInput("")
  }

  const handleFileUpload = async (file: File) => {
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
      updateQuestion(currentIndex, { images: [...q.images, data.url] })
    } catch {
      toast.error(t("errors:upload.failed"))
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    updateQuestion(currentIndex, {
      images: q.images.filter((_, i) => i !== index),
    })
  }

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= q.images.length) {
      return
    }

    const next = [...q.images]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateQuestion(currentIndex, { images: next })
  }

  // ── Correct answers (mirror open) ──────────────────────────────────────────

  const updateAnswer = (index: number, value: string) => {
    const next = [...q.correctAnswers]
    next[index] = value
    updateQuestion(currentIndex, { correctAnswers: next })
  }

  const addAnswer = () => {
    updateQuestion(currentIndex, {
      correctAnswers: [...q.correctAnswers, ""],
    })
  }

  const removeAnswer = (index: number) => {
    if (q.correctAnswers.length <= 1) {
      return
    }

    updateQuestion(currentIndex, {
      correctAnswers: q.correctAnswers.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="z-10 flex flex-col gap-4">
      {/* ── Liste d'images ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="bg-surface/90 text-ink-muted rounded-lg px-2.5 py-1 text-sm font-semibold shadow-sm backdrop-blur-sm">
            {t("quizz:imageSequence.imagesLabel")}
          </span>
          <span className="text-xs text-white/50">
            {q.images.length} image{q.images.length !== 1 ? "s" : ""}
          </span>
        </div>

        {q.images.map((url, i) => (
          <div
            key={`${i}-${url.slice(-12)}`}
            className="flex items-center gap-2 rounded-xl bg-white/10 p-2 backdrop-blur-sm"
          >
            <GripVertical className="size-4 shrink-0 text-white/40" />
            <img
              src={url}
              alt={`Image ${i + 1}`}
              className="size-12 shrink-0 rounded-lg object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-white/70">
              {i + 1}. {url.split("/").pop()}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveImage(i, i - 1)}
                disabled={i === 0}
                className="flex size-6 items-center justify-center rounded text-white/60 hover:bg-white/10 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveImage(i, i + 1)}
                disabled={i === q.images.length - 1}
                className="flex size-6 items-center justify-center rounded text-white/60 hover:bg-white/10 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="flex size-6 items-center justify-center rounded-full border border-white/30 text-white/60 hover:border-white hover:text-white"
              >
                <Minus className="size-3" />
              </button>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            className="border-border text-ink focus:border-primary flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30"
            placeholder={t("quizz:imageSequence.urlPlaceholder")}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addImageByUrl()
              }
            }}
          />
          <button
            type="button"
            onClick={addImageByUrl}
            disabled={!urlInput.trim()}
            className="focus-ring bg-surface/90 text-ink-muted hover:bg-panel hover:text-ink flex size-8 items-center justify-center rounded-lg shadow-sm backdrop-blur-sm transition-colors active:scale-95 disabled:opacity-30"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]

              if (file) {
                void handleFileUpload(file)
              }

              e.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="focus-ring bg-surface/90 text-ink-muted hover:bg-panel hover:text-ink flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm backdrop-blur-sm transition-colors active:scale-95 disabled:opacity-50"
          >
            <Upload className="size-4" />
            {uploading ? t("quizz:uploading") : t("quizz:uploadFromPC")}
          </button>
        </div>
      </div>

      {/* ── Intervalle ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-1">
        <span className="bg-surface/90 text-ink-muted w-fit rounded-lg px-2.5 py-1 text-sm font-semibold shadow-sm backdrop-blur-sm">
          {t("quizz:imageSequence.intervalLabel")}
        </span>
        <div className="w-24">
          <ConfigNumberInput
            value={q.imageInterval ?? 5}
            min={2}
            max={60}
            onChange={(v) => updateQuestion(currentIndex, { imageInterval: v })}
          />
        </div>
        <p className="text-xs text-white/50">{t("quizz:imageSequence.intervalHint")}</p>
      </div>

      {/* ── Reponses correctes (miroir open) ───────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <span className="bg-surface/90 text-ink-muted rounded-lg px-2.5 py-1 text-sm font-semibold shadow-sm backdrop-blur-sm">
          {t("quizz:correctAnswers")}
        </span>
        <button
          type="button"
          onClick={addAnswer}
          className="focus-ring bg-surface/90 text-ink-muted hover:bg-panel hover:text-ink flex size-7 items-center justify-center rounded-lg shadow-sm backdrop-blur-sm transition-colors active:scale-95"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {q.correctAnswers.map((answer, i) => (
          <div
            key={i}
            className="shadow-inset flex items-center gap-3 rounded bg-green-500 px-4 py-4"
          >
            <input
              className="flex-1 bg-transparent font-semibold text-white placeholder-white/70 outline-none"
              placeholder={t("quizz:addCorrectAnswer")}
              value={answer}
              onChange={(e) => updateAnswer(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeAnswer(i)}
              disabled={q.correctAnswers.length <= 1}
              className="flex size-6 items-center justify-center rounded-full border-2 border-white/60 text-white/80 hover:border-white disabled:opacity-30"
            >
              <Minus className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <p className="px-1 text-xs text-white/70">{t("quizz:openAnswerHint")}</p>
    </div>
  )
}

export default QuestionEditorImageSequence
