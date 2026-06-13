import type { SlideBackground } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  parseAudio,
  extractYoutubeId,
  mmssToSeconds,
  secondsToMmss,
} from "@rahoot/web/features/game/utils/audio"
import { Image, Music, X } from "lucide-react"
import { useState, useRef, type MouseEvent } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

export const BackgroundButton = () => {
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
      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
        headers: { "x-client-id": localStorage.getItem("client_id") ?? "" },
      })

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

          if (file) {
            void handleFileUpload(file)
          }

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
          <span
            className="size-4 rounded-full border border-gray-300"
            style={{ background: bg.value }}
          />
        )}
        {bg?.type === "image" && (
          <span className="size-4 overflow-hidden rounded border border-gray-300">
            <img src={bg.value} className="h-full w-full object-cover" alt="" />
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
        <div className="absolute top-full left-0 z-50 mt-2 w-76 rounded-xl border border-gray-100 bg-white p-3 shadow-xl">
          <div className="mb-3 flex gap-1">
            <button
              type="button"
              onClick={() => setTab("color")}
              className={`flex-1 rounded py-1 text-xs font-semibold ${tab === "color" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {t("quizz:bgColor")}
            </button>
            <button
              type="button"
              onClick={() => setTab("image")}
              className={`flex-1 rounded py-1 text-xs font-semibold ${tab === "image" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {t("quizz:bgImage")}
            </button>
          </div>

          {tab === "color" ? (
            <div className="flex flex-col gap-2">
              <input
                type="color"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                className="h-12 w-full cursor-pointer rounded border border-gray-200"
              />
              <button
                type="button"
                onClick={handleSaveColor}
                className="w-full rounded bg-yellow-500 py-1.5 text-xs font-semibold text-white hover:bg-yellow-600"
              >
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
                {uploading ? t("quizz:uploading") : t("quizz:uploadFromPC")}
              </button>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1 border-t border-gray-200" />
                {t("quizz:or")}
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
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                >
                  {t("common:cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveUrl}
                  disabled={!urlInput.trim()}
                  className="rounded bg-yellow-500 px-2 py-1 text-xs font-semibold text-white hover:bg-yellow-600 disabled:opacity-40"
                >
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

export const AudioButton = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"file" | "youtube">("file")
  const [fileInput, setFileInput] = useState("")
  const [ytUrl, setYtUrl] = useState("")
  const [ytStart, setYtStart] = useState("00:00")
  const [ytEnd, setYtEnd] = useState("")

  const openPanel = () => {
    const { audio } = currentQuestion

    if (audio?.startsWith("yt:")) {
      const src = parseAudio(audio)

      if (src.type === "youtube") {
        setTab("youtube")
        setYtUrl(`https://www.youtube.com/watch?v=${src.videoId}`)
        setYtStart(src.start > 0 ? secondsToMmss(src.start) : "00:00")
        setYtEnd(src.end > 0 ? secondsToMmss(src.end) : "")
      }
    } else {
      setTab("file")
      setFileInput(audio ?? "")
      setYtUrl("")
      setYtStart("00:00")
      setYtEnd("")
    }

    setOpen((o) => !o)
  }

  const handleSaveFile = () => {
    updateQuestion(currentIndex, { audio: fileInput.trim() || undefined })
    setOpen(false)
  }

  const handleSaveYoutube = () => {
    const videoId = extractYoutubeId(ytUrl.trim())

    if (!videoId) {
      return
    }

    const start = mmssToSeconds(ytStart || "00:00")
    const end = ytEnd.trim() ? mmssToSeconds(ytEnd) : 0

    updateQuestion(currentIndex, { audio: `yt:${videoId}:${start}:${end}` })
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
        onClick={openPanel}
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
        <div className="absolute top-full left-0 z-50 mt-2 w-80 rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
          {/* Onglets */}
          <div className="mb-3 flex gap-1">
            <button
              type="button"
              onClick={() => setTab("file")}
              className={`flex-1 rounded py-1 text-xs font-semibold ${tab === "file" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              URL audio
            </button>
            <button
              type="button"
              onClick={() => setTab("youtube")}
              className={`flex-1 rounded py-1 text-xs font-semibold ${tab === "youtube" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              YouTube
            </button>
          </div>

          {tab === "file" ? (
            <>
              <p className="mb-2 text-xs font-semibold text-gray-500">
                {t("quizz:slideUrlLabel")}
              </p>
              <input
                autoFocus
                type="url"
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-yellow-400"
                placeholder="https://..."
                value={fileInput}
                onChange={(e) => setFileInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveFile()}
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
                  onClick={handleSaveFile}
                  className="rounded bg-yellow-500 px-2 py-1 text-xs font-semibold text-white hover:bg-yellow-600"
                >
                  {t("common:save")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold text-gray-500">
                URL YouTube
              </p>
              <input
                autoFocus
                type="url"
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-red-400"
                placeholder="https://youtube.com/watch?v=..."
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-xs text-gray-400">Début</p>
                  <input
                    type="text"
                    className="w-full rounded border border-gray-200 px-2 py-1.5 font-mono text-sm outline-none focus:border-red-400"
                    placeholder="00:00"
                    value={ytStart}
                    onChange={(e) => setYtStart(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-xs text-gray-400">Fin (optionnel)</p>
                  <input
                    type="text"
                    className="w-full rounded border border-gray-200 px-2 py-1.5 font-mono text-sm outline-none focus:border-red-400"
                    placeholder="mm:ss"
                    value={ytEnd}
                    onChange={(e) => setYtEnd(e.target.value)}
                  />
                </div>
              </div>
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
                  onClick={handleSaveYoutube}
                  disabled={!extractYoutubeId(ytUrl.trim())}
                  className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
                >
                  {t("common:save")}
                </button>
              </div>
            </>
          )}
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
