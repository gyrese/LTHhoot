import type { SlideBackground } from "@rahoot/common/types/game"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { useQuestionImagePicker } from "./useQuestionImagePicker"
import {
  parseAudio,
  extractYoutubeId,
  mmssToSeconds,
  secondsToMmss,
} from "@rahoot/web/features/game/utils/audio"
import { Image, Layers, Music, X } from "lucide-react"
import { useId, useState } from "react"
import { ToolbarPopover } from "../SlideEditor/ToolbarControls"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

const triggerClass =
  "focus-ring text-ink-muted hover:bg-panel hover:text-ink flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98]"

const clearBadgeClass =
  "focus-ring bg-primary text-secondary hover:brightness-95 flex size-6 items-center justify-center rounded-full"

const saveClass =
  "focus-ring bg-primary text-secondary rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform duration-150 hover:brightness-[0.97] active:scale-95 disabled:opacity-40"

const cancelClass =
  "focus-ring text-ink-muted hover:bg-panel rounded-lg px-2.5 py-1.5 text-xs transition-colors"

const inputClass =
  "border-border text-ink focus:border-primary w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30"

const tabClass = (active: boolean) =>
  clsx(
    "focus-ring flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
    active
      ? "bg-primary text-secondary"
      : "bg-panel text-ink-muted hover:text-ink",
  )

export const BackgroundButton = () => {
  const { currentQuestion, currentIndex, updateQuestion, applyToAllQuestions } =
    useQuizzEditor()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"color" | "image">("color")
  const [colorInput, setColorInput] = useState("#ffffff")
  const { openPicker, picker } = useQuestionImagePicker(
    (questionIndex, _target, url) => {
      updateQuestion(questionIndex, {
        background: { type: "image", value: url },
      })
      setOpen(false)
    },
  )

  const bg = currentQuestion.background

  const applyBackground = (background: SlideBackground) => {
    updateQuestion(currentIndex, { background })
    setOpen(false)
  }

  const handleSaveColor = () => {
    applyBackground({ type: "color", value: colorInput })
  }

  const handleClear = () => {
    updateQuestion(currentIndex, { background: undefined })
  }

  return (
    <div className="relative">
      {bg && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t("quizz:media.removeBackground")}
          title={t("quizz:media.removeBackground")}
          className={clsx(
            clearBadgeClass,
            "absolute top-1/2 -right-2 -translate-y-1/2",
          )}
        >
          <X className="size-3" />
        </button>
      )}

      <ToolbarPopover
        label={t("quizz:slideBackground")}
        icon={
          <>
            {bg?.type === "color" && (
              <span
                className="border-border-strong size-4 rounded-full border"
                style={{ background: bg.value }}
              />
            )}
            {bg?.type === "image" && (
              <img
                src={bg.value}
                className="size-4 rounded object-cover"
                alt=""
              />
            )}
            {!bg && <Image className="size-4" />}
          </>
        }
        open={open}
        resetKey={currentQuestion.id}
        triggerClassName={clsx(triggerClass, bg && "pr-5")}
        onOpenChange={(next) => {
          if (next) {
            setTab(bg?.type ?? "color")
            setColorInput(bg?.type === "color" ? bg.value : "#ffffff")
          }
          setOpen(next)
        }}
      >
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
              aria-label={t("quizz:bgColor")}
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
          <div className="flex flex-col gap-3">
            {bg?.type === "image" && (
              <img
                src={bg.value}
                alt=""
                className="h-20 w-full rounded-lg object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openPicker(currentQuestion.id)
              }}
              className="focus-ring border-border-strong text-ink-muted hover:border-primary hover:text-ink w-full rounded-lg border-2 border-dashed py-3 text-xs font-semibold transition-colors"
            >
              {t(
                bg?.type === "image"
                  ? "quizz:media.replaceImage"
                  : "quizz:media.chooseImage",
              )}
            </button>
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
      </ToolbarPopover>
      {picker}
    </div>
  )
}

export const AudioButton = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"file" | "youtube">("file")
  const [fileInput, setFileInput] = useState("")
  const [ytUrl, setYtUrl] = useState("")
  const [ytStart, setYtStart] = useState("00:00")
  const [ytEnd, setYtEnd] = useState("")

  const openPanel = (next: boolean) => {
    if (!next) {
      setOpen(false)
      return
    }
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

    setOpen(true)
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

  const handleClear = () => {
    updateQuestion(currentIndex, { audio: undefined })
  }

  return (
    <div className="relative">
      {currentQuestion.audio && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t("quizz:media.removeAudio")}
          title={t("quizz:media.removeAudio")}
          className={clsx(
            clearBadgeClass,
            "absolute top-1/2 -right-2 -translate-y-1/2",
          )}
        >
          <X className="size-3" />
        </button>
      )}

      <ToolbarPopover
        label={t("quizz:slideAudio")}
        icon={<Music className="size-4" />}
        open={open}
        onOpenChange={openPanel}
        resetKey={currentQuestion.id}
        triggerClassName={clsx(triggerClass, currentQuestion.audio && "pr-5")}
      >
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
            <label
              htmlFor={`${id}-file`}
              className="text-ink-muted mb-2 block text-xs font-semibold"
            >
              {t("quizz:slideUrlLabel")}
            </label>
            <input
              id={`${id}-file`}
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
            <label
              htmlFor={`${id}-youtube`}
              className="text-ink-muted mb-2 block text-xs font-semibold"
            >
              URL YouTube
            </label>
            <input
              id={`${id}-youtube`}
              autoFocus
              type="url"
              className={inputClass}
              placeholder="https://youtube.com/watch?v=..."
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <div className="flex-1">
                <label
                  htmlFor={`${id}-start`}
                  className="text-ink-subtle mb-1 block text-xs"
                >
                  Début
                </label>
                <input
                  id={`${id}-start`}
                  type="text"
                  className={clsx(inputClass, "font-mono")}
                  placeholder="00:00"
                  value={ytStart}
                  onChange={(e) => setYtStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor={`${id}-end`}
                  className="text-ink-subtle mb-1 block text-xs"
                >
                  Fin (optionnel)
                </label>
                <input
                  id={`${id}-end`}
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
      </ToolbarPopover>
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
