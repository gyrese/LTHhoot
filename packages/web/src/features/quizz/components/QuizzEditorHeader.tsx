import { EVENTS } from "@rahoot/common/constants"
import Logo from "@rahoot/web/components/Logo"
import Button from "@rahoot/web/components/Button"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import QuizzSettingsModal from "@rahoot/web/features/quizz/components/QuizzSettingsModal"
import { useNavigate } from "@tanstack/react-router"
import { Settings } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const QuizzEditorHeader = () => {
  const {
    quizzId,
    subject,
    description,
    folder,
    tags,
    salonImage,
    listingImage,
    questions,
  } = useQuizzEditor()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [showSettings, setShowSettings] = useState(false)

  const handleSave = () => {
    const payload = {
      subject,
      description: description || undefined,
      folder: folder || undefined,
      tags: tags.length ? tags : undefined,
      salonImage: salonImage || undefined,
      listingImage: listingImage || undefined,
      questions,
    }

    if (quizzId) {
      socket?.emit(EVENTS.QUIZZ.UPDATE, { id: quizzId, ...payload })
    } else {
      socket?.emit(EVENTS.QUIZZ.SAVE, payload)
    }
  }

  useEvent(EVENTS.QUIZZ.SAVE_SUCCESS, () => {
    toast.success(t("quizz:quizzSaved"))
    navigate({ to: "/manager/config" })
  })

  useEvent(EVENTS.QUIZZ.UPDATE_SUCCESS, () => {
    toast.success(t("quizz:quizzUpdated"))
    navigate({ to: "/manager/config" })
  })

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    toast.error(t(message))
  })

  return (
    <>
      <header className="z-20 flex h-20 items-center justify-between gap-4 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-6">
          <Logo className="h-10" />

          <Button
            type="button"
            onClick={() => setShowSettings(true)}
            className="border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 shadow-none px-4 py-2"
            classNameContent="gap-3"
          >
            <span className="max-w-64 truncate text-xl font-black">{subject || t("quizz:titleQuizzPlaceholder")}</span>
            <Settings className="size-6 shrink-0 text-gray-500" />
          </Button>
        </div>

        <div className="flex gap-3">
          <Button
            size="sm"
            className="bg-gray-100 font-semibold text-gray-600 shadow-none border-2 border-transparent hover:border-gray-200"
            onClick={() => navigate({ to: "/manager" })}
          >
            {t("common:exit")}
          </Button>
          <Button size="sm" className="bg-primary px-6" onClick={handleSave}>
            {t("common:save")}
          </Button>
        </div>
      </header>

      <QuizzSettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}

export default QuizzEditorHeader
