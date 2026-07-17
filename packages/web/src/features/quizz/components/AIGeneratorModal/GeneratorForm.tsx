import { distributeDifficulties } from "@rahoot/common/utils/difficulty"
import type { QuestionDifficulty } from "@rahoot/common/types/game"
import {
  AI_QUESTION_TYPES,
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  LANGUAGE_OPTIONS,
  MAX_COUNT,
  MIN_COUNT,
  TIME_OPTIONS,
  TONE_OPTIONS,
  type GeneratorSettings,
} from "@rahoot/web/features/quizz/components/AIGeneratorModal/options"
import { ChevronDown, Minus, Plus, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

type Props = {
  prompt: string
  onPromptChange: (_value: string) => void
  settings: GeneratorSettings
  onSettingsChange: (_updates: Partial<GeneratorSettings>) => void
  loading: boolean
}

const selectClasses =
  "border-border text-ink focus:border-primary w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-colors outline-none disabled:opacity-50"

const GeneratorForm = ({
  prompt,
  onPromptChange,
  settings,
  onSettingsChange,
  loading,
}: Props) => {
  const { t } = useTranslation()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const toggleDifficulty = (value: QuestionDifficulty) => {
    const isSelected = settings.difficulties.includes(value)

    // Au moins un niveau doit rester coché : sans ça, le mix n'a plus de sens
    // et le bouton Générer se bloquerait sans explication.
    if (isSelected && settings.difficulties.length === 1) {
      return
    }

    onSettingsChange({
      difficulties: isSelected
        ? settings.difficulties.filter((d) => d !== value)
        : [...settings.difficulties, value],
    })
  }

  const toggleType = (value: string) => {
    const isSelected = settings.questionTypes.includes(value)

    onSettingsChange({
      questionTypes: isSelected
        ? settings.questionTypes.filter((t) => t !== value)
        : [...settings.questionTypes, value],
    })
  }

  const slices = distributeDifficulties(settings.count, settings.difficulties)
  const mixSummary = slices
    .map(
      ({ difficulty, count }) => `${count} × ${DIFFICULTY_LABELS[difficulty]}`,
    )
    .join(" · ")

  return (
    <div className="space-y-6">
      {/* Sujet */}
      <div className="space-y-2">
        <label className="text-ink block text-sm font-bold">
          Sujet ou thème du quiz
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Ex: Les capitales européennes, La programmation JavaScript, L'Histoire de l'Egypte Antique..."
          rows={3}
          disabled={loading}
          className="border-border text-ink focus:border-primary w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm transition-colors outline-none disabled:opacity-50"
        />
      </div>

      {/* Ton */}
      <div className="space-y-2">
        <label className="text-ink block text-sm font-bold">
          Ton des questions
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TONE_OPTIONS.map(({ value, label, hint }) => {
            const isSelected = settings.tone === value

            return (
              <button
                key={value}
                type="button"
                onClick={() => onSettingsChange({ tone: value })}
                disabled={loading}
                title={hint}
                aria-pressed={isSelected}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-primary-soft border-primary text-primary-ink"
                    : "border-border hover:bg-border/20 text-ink-muted"
                } disabled:opacity-50`}
              >
                <span className="block text-xs font-semibold">{label}</span>
                <span className="mt-0.5 block text-[10px] leading-tight opacity-70">
                  {hint}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Difficultés (mix) */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-ink block text-sm font-bold">Difficulté</label>
          <span className="text-ink-subtle text-[11px]">
            Plusieurs niveaux = quiz mélangé
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {DIFFICULTY_OPTIONS.map(({ value, label, hint }) => {
            const isSelected = settings.difficulties.includes(value)

            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDifficulty(value)}
                disabled={loading}
                title={hint}
                aria-pressed={isSelected}
                className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                  isSelected
                    ? "bg-primary-soft border-primary text-primary-ink"
                    : "border-border hover:bg-border/20 text-ink-muted"
                } disabled:opacity-50`}
              >
                <span className="block text-xs font-semibold">{label}</span>
                <span className="mt-0.5 block text-[10px] leading-tight opacity-70">
                  {hint}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-ink-subtle text-[11px]">
          Répartition prévue : {mixSummary}
          {slices.length > 1 && " — de la plus facile à la plus difficile"}
        </p>
      </div>

      {/* Nombre de questions */}
      <div className="space-y-2">
        <label className="text-ink block text-sm font-bold">
          Nombre de questions
        </label>
        <div className="border-border flex w-fit items-center gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() =>
              onSettingsChange({
                count: Math.max(MIN_COUNT, settings.count - 1),
              })
            }
            disabled={loading || settings.count <= MIN_COUNT}
            aria-label="Retirer une question"
            className="text-ink-muted hover:bg-border/40 hover:text-ink rounded-md p-1.5 transition-colors disabled:opacity-30"
          >
            <Minus className="size-4" />
          </button>
          <span className="text-ink w-10 text-center text-sm font-bold tabular-nums">
            {settings.count}
          </span>
          <button
            type="button"
            onClick={() =>
              onSettingsChange({
                count: Math.min(MAX_COUNT, settings.count + 1),
              })
            }
            disabled={loading || settings.count >= MAX_COUNT}
            aria-label="Ajouter une question"
            className="text-ink-muted hover:bg-border/40 hover:text-ink rounded-md p-1.5 transition-colors disabled:opacity-30"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* Types de questions */}
      <div className="space-y-2">
        <label className="text-ink block text-sm font-bold">
          Types de questions souhaités
        </label>
        <div className="grid grid-cols-2 gap-2">
          {AI_QUESTION_TYPES.map(({ type, key }) => {
            const isSelected = settings.questionTypes.includes(type)

            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                disabled={loading}
                aria-pressed={isSelected}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-primary-soft border-primary text-primary-ink"
                    : "border-border hover:bg-border/20 text-ink-muted"
                } disabled:opacity-50`}
              >
                {t(key)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Carte réponse (answerReveal) */}
      <div className="border-border flex items-start justify-between gap-4 rounded-lg border p-3">
        <div>
          <span className="text-ink block text-sm font-bold">
            Explications de réponse
          </span>
          <span className="text-ink-subtle mt-0.5 block text-[11px] leading-tight">
            Génère la carte réponse de chaque question, affichée sur l'écran des
            résultats.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.withExplanations}
          aria-label="Générer les explications de réponse"
          disabled={loading}
          onClick={() =>
            onSettingsChange({ withExplanations: !settings.withExplanations })
          }
          className={`focus-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 disabled:opacity-50 ${
            settings.withExplanations ? "bg-primary" : "bg-border-strong"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-150 ${
              settings.withExplanations ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Options avancées */}
      <div className="border-border border-t pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="text-ink-muted hover:text-ink flex w-full items-center gap-2 text-sm font-semibold transition-colors"
        >
          <SlidersHorizontal className="size-4" />
          Options avancées
          <ChevronDown
            className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-ink block text-sm font-bold">
                  Langue
                </label>
                <select
                  value={settings.language}
                  onChange={(e) =>
                    onSettingsChange({ language: e.target.value })
                  }
                  disabled={loading}
                  className={selectClasses}
                >
                  {LANGUAGE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value} className="bg-panel">
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-ink block text-sm font-bold">
                  Temps par question
                </label>
                <select
                  value={settings.time}
                  onChange={(e) =>
                    onSettingsChange({ time: Number(e.target.value) })
                  }
                  disabled={loading}
                  className={selectClasses}
                >
                  {TIME_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value} className="bg-panel">
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-ink block text-sm font-bold">
                Consignes supplémentaires
              </label>
              <textarea
                value={settings.instructions}
                onChange={(e) =>
                  onSettingsChange({ instructions: e.target.value })
                }
                placeholder="Ex: Évite les questions sur les dates. Insiste sur la culture pop des années 90."
                rows={2}
                disabled={loading}
                className="border-border text-ink focus:border-primary w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm transition-colors outline-none disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GeneratorForm
