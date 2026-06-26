import { useSocket, useEvent } from "@rahoot/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { EVENTS } from "@rahoot/common/constants"
import { X, Sparkles, AlertTriangle, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

type Props = {
  open: boolean
  onClose: () => void
}

const QUESTION_TYPE_LABELS = {
  mcq: "QCM (Choix multiples)",
  true_false: "Vrai / Faux",
  open: "Réponse libre (Texte)",
  slider: "Curseur (Nombre)",
  date: "Date / Année",
  puzzle: "Ordre (Puzzle)",
}

const AIGeneratorModal = ({ open, onClose }: Props) => {
  const { socket } = useSocket()
  const { importQuestions } = useQuizzEditor()
  const { t } = useTranslation()

  const [prompt, setPrompt] = useState("")
  const [count, setCount] = useState(5)
  const [level, setLevel] = useState("Intermédiaire / Général")
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["mcq", "true_false"])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEvent(EVENTS.QUIZZ.AI_GENERATE_SUCCESS, (data: { questions: any[] }) => {
    if (!loading) return
    setLoading(false)
    if (data.questions && data.questions.length > 0) {
      importQuestions(data.questions)
      toast.success(
        t("quizz:aiGenerateSuccessMsg", {
          count: data.questions.length,
          defaultValue: `{{count}} question(s) générée(s) avec succès !`,
        })
      )
      onClose()
      // Reset form
      setPrompt("")
    } else {
      setErrorMsg("Aucune question n'a pu être générée. Veuillez réessayer.")
    }
  })

  useEvent(EVENTS.QUIZZ.ERROR, (message: string) => {
    if (!loading) return
    setLoading(false)
    // Map backend error messages if translated
    setErrorMsg(message.startsWith("errors:") ? t(message) : message)
  })

  if (!open) return null

  const handleToggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    )
  }

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Veuillez saisir un thème ou sujet.")
      return
    }
    if (selectedTypes.length === 0) {
      toast.error("Veuillez sélectionner au moins un type de question.")
      return
    }

    setLoading(true)
    setErrorMsg(null)

    socket?.emit(EVENTS.QUIZZ.AI_GENERATE, {
      prompt: prompt.trim(),
      count,
      questionTypes: selectedTypes,
      level,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-panel border-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-5 animate-pulse" />
            <h2 className="text-ink text-lg font-bold">Générer des questions par IA</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-ink-subtle hover:text-ink hover:bg-border/40 rounded-lg p-1 transition-colors disabled:opacity-30"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="scrollbar-light flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="bg-danger/10 border-danger/30 text-danger flex items-start gap-2.5 rounded-lg border p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-ink text-sm font-bold block">Sujet ou thème du quiz</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Les capitales européennes, La programmation JavaScript, L'Histoire de l'Egypte Antique..."
              rows={3}
              disabled={loading}
              className="border-border text-ink bg-transparent focus:border-primary w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50"
            />
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Number of questions */}
            <div className="space-y-2">
              <label className="text-ink text-sm font-bold block">Nombre de questions</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={loading}
                className="border-border text-ink bg-transparent focus:border-primary w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50"
              >
                {[3, 5, 8, 10, 15].map((n) => (
                  <option key={n} value={n} className="bg-panel">
                    {n} questions
                  </option>
                ))}
              </select>
            </div>

            {/* Level */}
            <div className="space-y-2">
              <label className="text-ink text-sm font-bold block">Difficulté / Cible</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={loading}
                className="border-border text-ink bg-transparent focus:border-primary w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50"
              >
                {["Facile / Enfants", "Intermédiaire / Général", "Difficile / Experts"].map((l) => (
                  <option key={l} value={l} className="bg-panel">
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Question types */}
          <div className="space-y-2">
            <label className="text-ink text-sm font-bold block">Types de questions souhaités</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => {
                const isSelected = selectedTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleToggleType(type)}
                    disabled={loading}
                    className={`border text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-primary-soft border-primary text-primary-ink"
                        : "border-border hover:bg-border/20 text-ink-muted"
                    } disabled:opacity-50`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-border bg-border/10 flex items-center justify-end gap-3 border-t px-6 py-4">
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
        </div>
      </div>
    </div>
  )
}

export default AIGeneratorModal
