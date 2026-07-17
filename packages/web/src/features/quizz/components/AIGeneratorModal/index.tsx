import type { Question } from "@rahoot/common/types/game"
import { EVENTS } from "@rahoot/common/constants"
import {
  useSocket,
  useEvent,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import GeneratorForm from "@rahoot/web/features/quizz/components/AIGeneratorModal/GeneratorForm"
import QuestionsPreview from "@rahoot/web/features/quizz/components/AIGeneratorModal/QuestionsPreview"
import {
  loadSettings,
  saveSettings,
  type GeneratorSettings,
} from "@rahoot/web/features/quizz/components/AIGeneratorModal/options"
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

type Props = {
  open: boolean
  onClose: () => void
}

const AIGeneratorModal = ({ open, onClose }: Props) => {
  const { socket } = useSocket()
  const { importQuestions, description, setDescription } = useQuizzEditor()
  const { t } = useTranslation()

  const [prompt, setPrompt] = useState("")
  const [settings, setSettings] = useState<GeneratorSettings>(loadSettings)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Non nul = on est à l'étape de relecture, plus à l'étape de réglages.
  const [generated, setGenerated] = useState<Question[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [suggestedDescription, setSuggestedDescription] = useState("")
  // Coché d'office seulement si le quiz n'a pas encore de description : on
  // n'écrase jamais une saisie de l'auteur sans un geste explicite.
  const [useDescription, setUseDescription] = useState(false)

  const updateSettings = (updates: Partial<GeneratorSettings>) =>
    setSettings((prev) => ({ ...prev, ...updates }))

  useEvent(
    EVENTS.QUIZZ.AI_GENERATE_SUCCESS,
    (data: { questions: Question[]; description: string }) => {
      if (!loading) {
        return
      }

      setLoading(false)

      if (data.questions.length > 0) {
        setGenerated(data.questions)
        setSelected(new Set(data.questions.map((_, index) => index)))
        setSuggestedDescription(data.description)
        setUseDescription(!description.trim() && Boolean(data.description))
      } else {
        setErrorMsg("Aucune question n'a pu être générée. Veuillez réessayer.")
      }
    },
  )

  // Canal AI_ERROR dédié : les erreurs IA ne transitent plus par QUIZZ.ERROR
  // (partagé avec la sauvegarde de l'éditeur → toasts/reset croisés).
  useEvent(EVENTS.QUIZZ.AI_ERROR, (message: string) => {
    if (!loading) {
      return
    }

    setLoading(false)
    // Map backend error messages if translated
    setErrorMsg(message.startsWith("errors:") ? t(message) : message)
  })

  // Fermeture au clavier. Inactive pendant la génération, comme la croix et le
  // clic sur le fond : une requête IA est en vol.
  useEffect(() => {
    if (!open || loading) {
      return undefined
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, loading, onClose])

  if (!open) {
    return null
  }

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Veuillez saisir un thème ou sujet.")

      return
    }

    if (settings.questionTypes.length === 0) {
      toast.error("Veuillez sélectionner au moins un type de question.")

      return
    }

    saveSettings(settings)
    setLoading(true)
    setErrorMsg(null)
    setGenerated(null)

    socket?.emit(EVENTS.QUIZZ.AI_GENERATE, {
      prompt: prompt.trim(),
      count: settings.count,
      questionTypes: settings.questionTypes,
      difficulties: settings.difficulties,
      tone: settings.tone,
      language: settings.language,
      // 0 dans le select = « Auto » : le serveur attend null pour laisser
      // l'IA moduler la durée selon la difficulté.
      time: settings.time === 0 ? null : settings.time,
      withExplanations: settings.withExplanations,
      instructions: settings.instructions.trim() || undefined,
    })
  }

  const handleToggle = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev)

      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }

      return next
    })

  const handleToggleAll = (selectAll: boolean) =>
    setSelected(
      selectAll
        ? new Set((generated ?? []).map((_, index) => index))
        : new Set(),
    )

  const handleImport = () => {
    if (!generated) {
      return
    }

    const kept = generated.filter((_, index) => selected.has(index))

    importQuestions(kept)

    if (useDescription && suggestedDescription) {
      setDescription(suggestedDescription)
    }

    toast.success(
      t("quizz:aiGenerateSuccessMsg", {
        count: kept.length,
        defaultValue: `{{count}} question(s) générée(s) avec succès !`,
      }),
    )
    onClose()
    setPrompt("")
    setGenerated(null)
  }

  const isPreview = generated !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !loading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Générer des questions par IA"
        onClick={(e) => e.stopPropagation()}
        className="bg-panel border-border animate-in fade-in zoom-in-95 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl duration-200"
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="text-primary flex items-center gap-2">
            <Sparkles className={`size-5 ${loading ? "animate-pulse" : ""}`} />
            <h2 className="text-ink text-lg font-bold">
              {isPreview
                ? "Relire les questions"
                : "Générer des questions par IA"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fermer"
            className="text-ink-subtle hover:text-ink hover:bg-border/40 rounded-lg p-1 transition-colors disabled:opacity-30"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="scrollbar-light flex-1 space-y-6 overflow-y-auto p-6">
          {errorMsg && (
            <div className="bg-danger/10 border-danger/30 text-danger flex items-start gap-2.5 rounded-lg border p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isPreview ? (
            <QuestionsPreview
              questions={generated}
              selected={selected}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              suggestedDescription={suggestedDescription}
              useDescription={useDescription}
              onToggleDescription={() => setUseDescription((v) => !v)}
              hasExistingDescription={Boolean(description.trim())}
            />
          ) : (
            <GeneratorForm
              prompt={prompt}
              onPromptChange={setPrompt}
              settings={settings}
              onSettingsChange={updateSettings}
              loading={loading}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-border bg-border/10 flex items-center justify-end gap-3 border-t px-6 py-4">
          {isPreview ? (
            <>
              <button
                type="button"
                onClick={() => setGenerated(null)}
                className="focus-ring border-border text-ink-muted hover:bg-border/30 flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
              >
                <ArrowLeft className="size-4" />
                Réglages
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                className="focus-ring border-border text-ink-muted hover:bg-border/30 flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
              >
                <RefreshCw className="size-4" />
                Régénérer
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={selected.size === 0}
                className="focus-ring bg-primary text-secondary flex items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:brightness-[0.97] active:scale-[0.98] disabled:opacity-40"
              >
                Importer ({selected.size})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="focus-ring border-border text-ink-muted hover:bg-border/30 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-30"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="focus-ring bg-primary text-secondary flex items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:brightness-[0.97] active:scale-[0.98] disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Générer
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIGeneratorModal
