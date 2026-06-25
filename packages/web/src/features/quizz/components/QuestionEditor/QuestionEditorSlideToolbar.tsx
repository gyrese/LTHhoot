import type { SlideBackground } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  parseAudio,
  extractYoutubeId,
  mmssToSeconds,
  secondsToMmss,
} from "@rahoot/web/features/game/utils/audio"
import { Image, Layers, Music, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState, useRef, type MouseEvent, type ReactNode } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

const triggerClass =
  "focus-ring text-ink-muted hover:bg-panel hover:text-ink flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98]"

const clearBadgeClass =
  "bg-primary text-secondary flex size-4 items-center justify-center rounded-full"

const saveClass =
  "bg-primary text-secondary rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform duration-150 hover:brightness-[0.97] active:scale-95 disabled:opacity-40"

const cancelClass =
  "text-ink-muted hover:bg-panel rounded-lg px-2.5 py-1.5 text-xs transition-colors"

const inputClass =
  "border-border text-ink focus:border-primary w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30"

const tabClass = (active: boolean) =>
  clsx(
    "focus-ring flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
    active
      ? "bg-primary text-secondary"
      : "bg-panel text-ink-muted hover:text-ink",
  )

/** Conteneur popover commun : surface élevée + apparition origin-aware. */
const Popover = ({
  width,
  children,
  reduceMotion,
}: {
  width: string
  children: ReactNode
  reduceMotion: boolean | null
}) => (
  <motion.div
    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
    transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
    style={{ transformOrigin: "top left" }}
    className={clsx(
      "border-border bg-elevated absolute top-full left-0 z-50 mt-2 rounded-xl border p-3 shadow-xl shadow-black/10",
      width,
    )}
  >
    {children}
  </motion.div>
)

export const BackgroundButton = () => {
  const { currentQuestion, currentIndex, updateQuestion, applyToAllQuestions } =
    useQuizzEditor()
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
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
        className={triggerClass}
      >
        {bg?.type === "color" && (
          <span
            className="border-border-strong size-4 rounded-full border"
            style={{ background: bg.value }}
          />
        )}
        {bg?.type === "image" && (
          <span className="border-border-strong size-4 overflow-hidden rounded border">
            <img src={bg.value} className="h-full w-full object-cover" alt="" />
          </span>
        )}
        {!bg && <Image className="size-4" />}
        {t("quizz:slideBackground")}
        {bg && (
          <span className={clearBadgeClass} onClick={handleClear}>
            <X className="size-3" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <Popover width="w-76" reduceMotion={reduceMotion}>
            <div className="mb-3 flex gap-1">
              <button
                type="button"
                onClick={() => setTab("color")}
                className={tabClass(tab === "color")}
              >
                {t("quizz:bgColor")}
              </button>
              <button
                type="button"
                onClick={() => setTab("image")}
                className={tabClass(tab === "image")}
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
                  className="border-border h-12 w-full cursor-pointer rounded-lg border"
                />
                <button
                  type="button"
                  onClick={handleSaveColor}
                  className={clsx(saveClass, "w-full")}
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
                  className="border-border-strong text-ink-subtle hover:border-primary hover:text-primary-ink w-full rounded-lg border-2 border-dashed py-3 text-xs transition-colors disabled:opacity-50"
                >
                  {uploading ? t("quizz:uploading") : t("quizz:uploadFromPC")}
                </button>

                <div className="text-ink-subtle flex items-center gap-2 text-xs">
                  <div className="border-border flex-1 border-t" />
                  {t("quizz:or")}
                  <div className="border-border flex-1 border-t" />
                </div>

                <input
                  autoFocus
                  type="text"
                  className={inputClass}
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveUrl()}
                />

                {urlInput && (
                  <img
                    src={urlInput}
                    alt="preview"
                    className="h-20 w-full rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={cancelClass}
                  >
                    {t("common:cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUrl}
                    disabled={!urlInput.trim()}
                    className={saveClass}
                  >
                    {t("common:save")}
                  </button>
                </div>
              </div>
            )}

            {bg && (
              <div className="border-border mt-3 border-t pt-3">
                <button
                  type="button"
                  onClick={() => {
                    applyToAllQuestions({
                      background: currentQuestion.background,
                      backgroundOpacity: currentQuestion.backgroundOpacity,
                    })
                    toast.success(t("quizz:question.config.appliedToAll"))
                    setOpen(false)
                  }}
                  className="text-ink-muted hover:bg-panel hover:text-ink flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors"
                >
                  <Layers className="size-3.5" />
                  {t("quizz:question.config.applyBackgroundToAll")}
                </button>
              </div>
            )}
          </Popover>
        )}
      </AnimatePresence>
    </div>
  )
}

export const AudioButton = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
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
      <button type="button" onClick={openPanel} className={triggerClass}>
        <Music className="size-4" />
        {t("quizz:slideAudio")}
        {currentQuestion.audio && (
          <span className={clearBadgeClass} onClick={handleClear}>
            <X className="size-3" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <Popover width="w-80" reduceMotion={reduceMotion}>
            <div className="mb-3 flex gap-1">
              <button
                type="button"
                onClick={() => setTab("file")}
                className={tabClass(tab === "file")}
              >
                URL audio
              </button>
              <button
                type="button"
                onClick={() => setTab("youtube")}
                className={tabClass(tab === "youtube")}
              >
                YouTube
              </button>
            </div>

            {tab === "file" ? (
              <>
                <p className="text-ink-muted mb-2 text-xs font-semibold">
                  {t("quizz:slideUrlLabel")}
                </p>
                <input
                  autoFocus
                  type="url"
                  className={inputClass}
                  placeholder="https://..."
                  value={fileInput}
                  onChange={(e) => setFileInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveFile()}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={cancelClass}
                  >
                    {t("common:cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFile}
                    className={saveClass}
                  >
                    {t("common:save")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-ink-muted mb-2 text-xs font-semibold">
                  URL YouTube
                </p>
                <input
                  autoFocus
                  type="url"
                  className={inputClass}
                  placeholder="https://youtube.com/watch?v=..."
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <p className="text-ink-subtle mb-1 text-xs">Début</p>
                    <input
                      type="text"
                      className={clsx(inputClass, "font-mono")}
                      placeholder="00:00"
                      value={ytStart}
                      onChange={(e) => setYtStart(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-ink-subtle mb-1 text-xs">
                      Fin (optionnel)
                    </p>
                    <input
                      type="text"
                      className={clsx(inputClass, "font-mono")}
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
                    className={cancelClass}
                  >
                    {t("common:cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveYoutube}
                    disabled={!extractYoutubeId(ytUrl.trim())}
                    className={saveClass}
                  >
                    {t("common:save")}
                  </button>
                </div>
              </>
            )}
          </Popover>
        )}
      </AnimatePresence>
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
