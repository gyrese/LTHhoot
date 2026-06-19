import Logo from "@rahoot/web/components/Logo"
import Button from "@rahoot/web/components/Button"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import QuizzSettingsModal from "@rahoot/web/features/quizz/components/QuizzSettingsModal"
import SlideToolbar from "@rahoot/web/features/quizz/components/SlideEditor/SlideToolbar"
import { useNavigate } from "@tanstack/react-router"
import { Download, LogOut, Settings } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  downloadJson,
  exportQuizzWithMedia,
} from "@rahoot/web/features/quizz/utils/export"
import clsx from "clsx"

type SaveStatus = "saving" | "dirty" | "saved"

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
  const reduceMotion = useReducedMotion()

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

  const status: SaveStatus = isSaving ? "saving" : isDirty ? "dirty" : "saved"

  const statusLabel: Record<SaveStatus, string> = {
    saving: t("quizz:saving", "Sauvegarde..."),
    dirty: t("quizz:unsavedChanges", "Modifications non enregistrées"),
    saved: t("quizz:allChangesSaved", "Toutes les modifications sont enregistrées"),
  }

  const dotColor: Record<SaveStatus, string> = {
    saving: "bg-primary",
    dirty: "bg-primary-ink",
    saved: "bg-success",
  }

  return (
    <>
      <header className="border-border bg-surface z-20 flex h-16 items-center gap-3 border-b px-4">
        {/* Gauche : logo + titre + autosave (tronqué sur petits écrans) */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Logo className="h-10 shrink-0" />

          <div className="bg-border-strong/70 h-7 w-px shrink-0" />

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="focus-ring group hover:bg-panel ease-out-soft flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors duration-150"
          >
            <span className="text-ink truncate text-base font-extrabold">
              {subject || t("quizz:titleQuizzPlaceholder")}
            </span>
            <Settings className="text-ink-subtle group-hover:text-ink-muted size-4 shrink-0 transition-colors" />
          </button>

          {lastSaved && (
            <div
              className="flex shrink-0 items-center gap-2 text-xs"
              title={statusLabel[status]}
            >
              <span
                className={clsx(
                  "size-2 shrink-0 rounded-full transition-colors",
                  dotColor[status],
                  isSaving && "animate-pulse",
                )}
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={status}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  className="hidden items-baseline gap-1.5 whitespace-nowrap 2xl:flex"
                >
                  <span className="text-ink-muted font-semibold">
                    {statusLabel[status]}
                  </span>
                  {status === "saved" && (
                    <span className="text-ink-subtle">
                      ·{" "}
                      {lastSaved.toLocaleTimeString(i18n.language, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Centre : barre d'outils intégrée */}
        <div className="shrink-0">
          <SlideToolbar />
        </div>

        {/* Droite : actions */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-ink-muted gap-2"
            onClick={() => navigate({ to: "/manager" })}
          >
            <LogOut className="size-4" />
            <span className="hidden md:inline">{t("common:exit")}</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            <span className="hidden md:inline">{t("common:export")}</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="px-5"
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
