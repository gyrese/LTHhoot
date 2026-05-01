import type { SlideBackground } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { Image, Music, X } from "lucide-react"
import { useState, useRef, type MouseEvent } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const BackgroundButton = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"color" | "image">("color")
  const [urlInput, setUrlInput] = useState("")
  const [colorInput, setColorInput] = useState("#ffffff")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bg = currentQuestion.background

  const applyBackground = (background: SlideBackground) => {
    updateQuestion(currentIndex, { background })
    setOpen(false)
  }

  const handleSaveUrl = () => {
    if (!urlInput.trim()) {
      return
    }

    applyBackground({ type: "image", value: urlInput.trim() })
  }

  const handleSaveColor = () => {
    applyBackground({ type: "color", value: colorInput })
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/upload", { method: "POST", body: formData })

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const data = (await res.json()) as { url: string }
      applyBackground({ type: "image", value: data.url })
    } catch {
      toast.error(t("errors:upload.failed"))
    } finally {
      setUploading(false)
    }
  }

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation()
    updateQuestion(currentIndex, { background: undefined })
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]

          if (file) { void handleFileUpload(file) }

          e.target.value = ""
        }}
      />

      <button
        type="button"
        onClick={() => {
          setTab(bg?.type ?? "color")
          setUrlInput(bg?.type === "image" ? bg.value : "")
          setColorInput(bg?.type === "color" ? bg.value : "#ffffff")
          setOpen((o) => !o)
        }}
        className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-gray-700 shadow hover:bg-white"
      >
        {bg?.type === "color" && (
          <span className="size-4 rounded-full border border-gray-300" style={{ background: bg.value }} />
        )}
        {bg?.type === "image" && (
          <span className="size-4 rounded overflow-hidden border border-gray-300">
            <img src={bg.value} className="w-full h-full object-cover" alt="" />
          </span>
        )}
        {!bg && <Image className="size-4" />}
        {t("quizz:slideBackground")}
        {bg && (
          <span
            className="flex size-4 items-center justify-center rounded-full bg-yellow-500 text-white"
            onClick={handleClear}
          >
            <X className="size-3" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-76 rounded-xl bg-white p-3 shadow-xl border border-gray-100">
          <div className="mb-3 flex gap-1">
            <button type="button" onClick={() => setTab("color")}
              className={`flex-1 rounded py-1 text-xs font-semibold ${tab === "color" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-600"}`}>
              {t("quizz:bgColor")}
            </button>
            <button type="button" onClick={() => setTab("image")}
              className={`flex-1 rounded py-1 text-xs font-semibold ${tab === "image" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-600"}`}>
              {t("quizz:bgImage")}
            </button>
          </div>

          {tab === "color" ? (
            <div className="flex flex-col gap-2">
              <input
                type="color"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                className="w-full h-12 rounded border border-gray-200 cursor-pointer"
              />
              <button type="button" onClick={handleSaveColor}
                className="w-full rounded bg-yellow-500 py-1.5 text-xs font-semibold text-white hover:bg-yellow-600">
                {t("common:save")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded border-2 border-dashed border-gray-300 py-3 text-xs text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-50"
              >
                {uploading ? "Importation…" : "📁 Importer depuis le PC (image / GIF)"}
              </button>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1 border-t border-gray-200" />
                ou
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <input
                autoFocus
                type="text"
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-yellow-400"
                placeholder="https://..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveUrl()}
              />

              {urlInput && (
                <img
                  src={urlInput}
                  alt="preview"
                  className="h-20 w-full rounded object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                />
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
                  {t("common:cancel")}
                </button>
                <button type="button" onClick={handleSaveUrl} disabled={!urlInput.trim()}
                  className="rounded bg-yellow-500 px-2 py-1 text-xs font-semibold text-white hover:bg-yellow-600 disabled:opacity-40">
                  {t("common:save")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const AudioButton = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(currentQuestion.audio ?? "")

  const handleSave = () => {
    updateQuestion(currentIndex, { audio: input || undefined })
    setOpen(false)
  }

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation()
    updateQuestion(currentIndex, { audio: undefined })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setInput(currentQuestion.audio ?? "")
          setOpen((o) => !o)
        }}
        className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-gray-700 shadow hover:bg-white"
      >
        <Music className="size-4" />
        {t("quizz:slideAudio")}
        {currentQuestion.audio && (
          <span
            className="flex size-4 items-center justify-center rounded-full bg-yellow-500 text-white"
            onClick={handleClear}
          >
            <X className="size-3" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-500">
            {t("quizz:slideUrlLabel")}
          </p>
          <input
            autoFocus
            type="url"
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-yellow-400"
            placeholder="https://..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              {t("common:cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-yellow-500 px-2 py-1 text-xs font-semibold text-white hover:bg-yellow-600"
            >
              {t("common:save")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const QuestionEditorSlideToolbar = () => (
    <div className="z-10 flex flex-wrap gap-2 border-t border-white/20 pt-3">
      <BackgroundButton />
      <AudioButton />
    </div>
  )

export default QuestionEditorSlideToolbar
