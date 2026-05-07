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
import { Download, Settings } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import {
  downloadJson,
  exportQuizzWithMedia,
} from "@rahoot/web/features/quizz/utils/export"
import clsx from "clsx"

const QuizzEditorHeader = () => {
  const {
    subject,
    description,
    folder,
    tags,
    salonImage,
    listingImage,
    questions,
    saveQuizz,
    isDirty,
    isSaving,
    lastSaved,
  } = useQuizzEditor()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [showSettings, setShowSettings] = useState(false)

  const handleExport = async () => {
    const loadingToast = toast.loading(
      t("manager:quizz.exporting", "Exportation en cours..."),
    )
    try {
      const payload = {
        subject,
        description: description || undefined,
        folder: folder || undefined,
        tags: tags.length ? tags : undefined,
        salonImage: salonImage || undefined,
        listingImage: listingImage || undefined,
        questions,
      }

      const fullQuizz = await exportQuizzWithMedia(payload)
      downloadJson(fullQuizz, subject || "quizz-export")
      toast.success(t("quizz:quizzExported"), { id: loadingToast })
    } catch (error) {
      console.error("Export failed:", error)
      toast.error(t("errors:quizz.exportFailed", "L'exportation a échoué"), {
        id: loadingToast,
      })
    }
  }

  return (
    <>
      <header className="z-20 flex h-20 items-center justify-between gap-4 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-6">
          <Logo className="h-10" />

          <Button
            type="button"
            onClick={() => setShowSettings(true)}
            className="border-2 border-gray-200 bg-white px-4 py-2 text-gray-700 shadow-none hover:border-gray-300 hover:bg-gray-50"
            classNameContent="gap-3"
          >
            <span className="max-w-64 truncate text-xl font-black">
              {subject || t("quizz:titleQuizzPlaceholder")}
            </span>
            <Settings className="size-6 shrink-0 text-gray-500" />
          </Button>

          {lastSaved && (
            <div className="flex flex-col text-xs text-gray-400">
              <span
                className={clsx(
                  "font-semibold tracking-wider uppercase",
                  isSaving && "animate-pulse text-blue-500",
                )}
              >
                {isSaving
                  ? t("quizz:saving", "Sauvegarde...")
                  : isDirty
                    ? t(
                        "quizz:unsavedChanges",
                        "Modifications non enregistrées",
                      )
                    : t(
                        "quizz:allChangesSaved",
                        "Toutes les modifications sont enregistrées",
                      )}
              </span>
              {!isSaving && (
                <span>
                  {t("quizz:lastSavedAt", "Dernier enregistrement à {{time}}", {
                    time: lastSaved.toLocaleTimeString(i18n.language, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            size="sm"
            className="border-2 border-transparent bg-gray-100 font-semibold text-gray-600 shadow-none hover:border-gray-200"
            onClick={() => navigate({ to: "/manager" })}
          >
            {t("common:exit")}
          </Button>
          <Button
            size="sm"
            className="border-2 border-transparent bg-blue-50 font-bold text-blue-600 shadow-none hover:border-blue-100"
            onClick={handleExport}
          >
            <Download className="mr-2 size-4" />
            {t("common:export")}
          </Button>
          <Button
            size="sm"
            className="bg-primary px-6"
            onClick={() => saveQuizz({ navigate: true })}
          >
            {t("common:save")}
          </Button>
        </div>
      </header>

      <QuizzSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}

export default QuizzEditorHeader
