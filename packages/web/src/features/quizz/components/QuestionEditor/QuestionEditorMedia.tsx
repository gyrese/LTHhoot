import { useState, type ChangeEvent } from "react"
import type { QuestionMediaType } from "@rahoot/common/types/game"
import { questionMediaValidator } from "@rahoot/common/validators/quizz"
import Button from "@rahoot/web/components/Button"
import Card from "@rahoot/web/components/Card"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import MediaSearchModal from "@rahoot/web/features/quizz/components/MediaSearchModal"
import { Image, ImageOff, Music, Video, FolderOpen, RefreshCw } from "lucide-react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const QuestionEditorMedia = () => {
  const { updateQuestion, currentIndex, currentQuestion } = useQuizzEditor()
  const questionMedia = currentQuestion.media
  const { t } = useTranslation()
  const [showMediaModal, setShowMediaModal] = useState(false)

  const hadnleChangeMediaType = (type: QuestionMediaType) => () => {
    const result = questionMediaValidator.safeParse({
      type,
      url: questionMedia?.url,
    })

    if (!result.success) {
      toast.error(result.error.issues[0].message)

      return
    }

    updateQuestion(currentIndex, { media: result.data })
  }

  const handleRemoveMedia = () => {
    if (!questionMedia) {
      return
    }

    updateQuestion(currentIndex, { media: undefined })
  }

  const handleChangeMedia = (e: ChangeEvent<HTMLInputElement>) => {
    updateQuestion(currentIndex, {
      media: { url: e.target.value },
    })
  }

  const handleSelectMedia = (url: string, type: "image" | "video") => {
    updateQuestion(currentIndex, {
      media: { url, type },
    })
    setShowMediaModal(false)
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-4">
      <div>
        <QuestionMedia media={currentQuestion.media} alt="Question Media" />
      </div>

      {!questionMedia?.type && (
        <Card className="ring-border bg-surface my-14 flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 p-6 shadow-lg ring-1 shadow-black/5">
          <ImageOff className="stroke-ink-subtle size-16" />
          <p className="text-ink-muted text-center text-sm">
            {t("quizz:question.addMediaHint")}
          </p>

          <div className="flex w-full max-w-md flex-col gap-2">
            <input
              className="border-border text-ink focus:border-primary focus:ring-primary/30 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              placeholder={t("quizz:question.mediaUrlPlaceholder")}
              value={questionMedia?.url || ""}
              onChange={handleChangeMedia}
            />

            <Button
              onClick={() => setShowMediaModal(true)}
              variant="secondary"
              className="w-full py-2.5"
            >
              <div className="flex items-center justify-center gap-2">
                <FolderOpen className="size-4" />
                <p>Parcourir la bibliothèque de médias</p>
              </div>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={hadnleChangeMediaType("image")}
              variant="secondary"
            >
              <div className="flex items-center gap-1.5">
                <Image className="size-6" />
                <p>{t("quizz:question.media.image")}</p>
              </div>
            </Button>
            <Button
              onClick={hadnleChangeMediaType("video")}
              variant="secondary"
            >
              <div className="flex items-center gap-1.5">
                <Video className="size-6" />
                <p>{t("quizz:question.media.video")}</p>
              </div>
            </Button>
            <Button
              onClick={hadnleChangeMediaType("audio")}
              variant="secondary"
            >
              <div className="flex items-center gap-1.5">
                <Music className="size-6" />
                <p>{t("quizz:question.media.audio")}</p>
              </div>
            </Button>
          </div>
        </Card>
      )}

      {questionMedia?.type && (
        <div className="absolute bottom-4 flex gap-2">
          <Button
            variant="secondary"
            className="px-4 py-2"
            onClick={() => setShowMediaModal(true)}
          >
            <div className="flex items-center gap-1.5">
              <RefreshCw className="size-4" />
              <p>Remplacer le média</p>
            </div>
          </Button>
          <Button
            variant="secondary"
            className="px-4 py-2 text-red-500 hover:text-red-400"
            onClick={handleRemoveMedia}
          >
            {t("common:delete")}
          </Button>
        </div>
      )}

      <MediaSearchModal
        open={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onSelect={handleSelectMedia}
        allowedTypes={["image", "video"]}
      />
    </div>
  )
}

export default QuestionEditorMedia
