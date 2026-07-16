import Logo from "@rahoot/web/components/Logo"
import Button from "@rahoot/web/components/Button"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import QuizzSettingsModal from "@rahoot/web/features/quizz/components/QuizzSettingsModal"
import AIGeneratorModal from "@rahoot/web/features/quizz/components/AIGeneratorModal"
import SlideToolbar from "@rahoot/web/features/quizz/components/SlideEditor/SlideToolbar"
import useTestDrive from "@rahoot/web/features/quizz/hooks/useTestDrive"
import { useNavigate } from "@tanstack/react-router"
import { Download, PlayCircle, Settings, Upload, Sparkles } from "lucide-react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  downloadJson,
  exportQuizzWithMedia,
} from "@rahoot/web/features/quizz/utils/export"
import {
  downloadCsvTemplate,
  parseQuestionsCsv,
} from "@rahoot/web/features/quizz/utils/import-csv"
import clsx from "clsx"

type SaveStatus = "saving" | "dirty" | "saved"

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
    currentIndex,
    importQuestions,
    saveQuizz,
    isDirty,
    isSaving,
    lastSaved,
  } = useQuizzEditor()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [showSettings, setShowSettings] = useState(false)
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const { startTestDrive, isTestDriving } = useTestDrive()
  const reduceMotion = useReducedMotion()
  const csvInputRef = useRef<HTMLInputElement>(null)

  const handleImportCsv = async (file: File) => {
    try {
      const text = await file.text()
      const { questions: imported, errors } = parseQuestionsCsv(text)

      if (imported.length === 0) {
        toast(
          (tst) => (
            <div className="flex flex-col items-start gap-2">
              <span>
                {t(
                  "quizz:importCsvEmpty",
                  "Aucune question valide trouvée. Vérifiez le format du CSV.",
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  downloadCsvTemplate()
                  toast.dismiss(tst.id)
                }}
                className="text-primary text-sm font-semibold underline"
              >
                {t("quizz:importCsvTemplate", "Télécharger le modèle CSV")}
              </button>
            </div>
          ),
          { duration: 6000 },
        )

        return
      }

      importQuestions(imported)
      toast.success(
        t("quizz:importCsvSuccess", {
          count: imported.length,
          defaultValue: "{{count}} question(s) importée(s)",
        }),
      )

      if (errors.length > 0) {
        toast(
          t("quizz:importCsvIgnored", {
            count: errors.length,
            defaultValue: "{{count}} ligne(s) ignorée(s) (format invalide)",
          }),
          { icon: "⚠️" },
        )
      }
    } catch {
      toast.error(
        t("quizz:importCsvFailed", "Échec de la lecture du fichier CSV"),
      )
    }
  }

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

  let status: SaveStatus = "saved"

  if (isSaving) {
    status = "saving"
  } else if (isDirty) {
    status = "dirty"
  }

  const statusLabel: Record<SaveStatus, string> = {
    saving: t("quizz:saving", "Sauvegarde..."),
    dirty: t("quizz:unsavedChanges", "Modifications non enregistrées"),
    saved: t(
      "quizz:allChangesSaved",
      "Toutes les modifications sont enregistrées",
    ),
  }

  const dotColor: Record<SaveStatus, string> = {
    saving: "bg-primary",
    dirty: "bg-primary-ink",
    saved: "bg-success",
  }

  return (
    <>
      <header className="border-border bg-surface relative z-40 flex h-13 items-center gap-3 border-b px-4">
        {/* Gauche : logo + titre + autosave (tronqué sur petits écrans) */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (isDirty) {
                if (
                  // eslint-disable-next-line no-alert
                  confirm(
                    t(
                      "common:unsavedChangesConfirm",
                      "Attention : vous avez des modifications non enregistrées. Voulez-vous vraiment quitter sans sauvegarder ?",
                    ),
                  )
                ) {
                  navigate({ to: "/manager" })
                }
              } else {
                navigate({ to: "/manager" })
              }
            }}
            className="focus-ring shrink-0 rounded-lg transition-transform active:scale-95"
            title={t("common:backToManager", "Retour au manager")}
          >
            <Logo className="h-8 shrink-0" />
          </button>

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
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, filter: "blur(2px)" }
                  }
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, filter: "blur(2px)" }
                  }
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

        {/* Droite : actions */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]

              if (file) {
                void handleImportCsv(file)
              }

              e.target.value = ""
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-ink-muted h-8 gap-2"
            onClick={() => setShowAIGenerator(true)}
          >
            <Sparkles className="text-primary size-4 animate-pulse" />
            <span className="hidden md:inline">Générer par IA</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-ink-muted h-8 gap-2"
            disabled={!quizzId || questions.length === 0 || isTestDriving}
            onClick={() => startTestDrive(currentIndex)}
            title={
              !quizzId
                ? t(
                    "quizz:testDriveNeedsSave",
                    "Sauvegardez le quiz avant de le tester",
                  )
                : undefined
            }
          >
            <PlayCircle className="size-4" />
            <span className="hidden md:inline">
              {t("quizz:testDrive", "Tester")}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-ink-muted h-8 gap-2"
            onClick={() => csvInputRef.current?.click()}
          >
            <Upload className="size-4" />
            <span className="hidden md:inline">
              {t("quizz:importCsv", "Importer")}
            </span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-8"
            onClick={handleExport}
          >
            <Download className="size-4" />
            <span className="hidden md:inline">{t("common:export")}</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-8 px-5"
            onClick={() => saveQuizz({ navigate: true })}
          >
            {t("common:save")}
          </Button>
        </div>
      </header>

      {/* Barre d'outils dédiée juste en dessous */}
      <div className="border-border bg-surface relative z-30 flex h-10 w-full shrink-0 items-center border-b px-4">
        <SlideToolbar />
      </div>

      <QuizzSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
      <AIGeneratorModal
        open={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
      />
    </>
  )
}

export default QuizzEditorHeader
