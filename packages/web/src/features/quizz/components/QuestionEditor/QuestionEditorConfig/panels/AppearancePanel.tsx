import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigToggle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigToggle"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { Clock, Columns, Contrast, Grid, Settings, Shapes } from "lucide-react"
import { useTranslation } from "react-i18next"

const AppearancePanel = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  if (!currentQuestion) {
    return null
  }

  const isSlide = currentQuestion.type === "title"

  const handleUpdateQuestion =
    (key: string) => (value: string | number | boolean) => {
      updateQuestion(currentIndex, { [key]: value })
    }

  return (
    <div className="flex flex-col gap-4 py-4">
      <ConfigField>
        <ConfigField.Label
          icon={<Contrast className="size-4" />}
          label={t("quizz:question.config.opacity")}
          unit=""
        />
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            value={(currentQuestion.backgroundOpacity ?? 0.5) * 100}
            onChange={(e) =>
              handleUpdateQuestion("backgroundOpacity")(
                Number(e.target.value) / 100,
              )
            }
            className="accent-primary bg-border h-1.5 w-full cursor-pointer appearance-none rounded-lg"
          />
          <span className="text-ink-muted w-8 text-right text-xs font-medium tabular-nums">
            {Math.round((currentQuestion.backgroundOpacity ?? 0.5) * 100)}%
          </span>
        </div>
        <ConfigField.Description>
          {t("quizz:question.config.opacityHint")}
        </ConfigField.Description>
      </ConfigField>

      <ConfigToggle
        icon={<Grid className="size-4" />}
        label={t("quizz:question.config.revelationEnabled", "Activer l'effet")}
        checked={Boolean(currentQuestion.revelationEnabled)}
        onChange={(value) =>
          updateQuestion(currentIndex, { revelationEnabled: value })
        }
        description={t(
          "quizz:question.config.revelationEnabledHint",
          "Dévoile progressivement l'image d'arrière-plan.",
        )}
      />

      {currentQuestion.revelationEnabled &&
        (() => {
          const currentStyle = currentQuestion.revelationStyle ?? "random-grid"
          const nonGridStyles = [
            "blur",
            "iris",
            "spotlight",
            "thermal",
            "pixelate",
            "glitch",
            "printer",
            "burn",
            "ink",
          ]
          const isNonGrid = nonGridStyles.includes(currentStyle)
          const mainType = isNonGrid ? currentStyle : "grid"
          const gridPattern = isNonGrid ? "random-grid" : currentStyle

          return (
            <>
              <ConfigField>
                <ConfigField.Label
                  icon={<Clock className="size-4" />}
                  label={t(
                    "quizz:question.config.revealDuration",
                    "Durée de révélation",
                  )}
                />
                <ConfigNumberInput
                  value={
                    currentQuestion.revealDuration ??
                    (isSlide
                      ? currentQuestion.cooldown
                      : currentQuestion.cooldown + currentQuestion.time)
                  }
                  min={3}
                  max={
                    isSlide
                      ? currentQuestion.cooldown
                      : currentQuestion.cooldown + currentQuestion.time
                  }
                  onChange={handleUpdateQuestion("revealDuration")}
                />
                <ConfigField.Description>
                  {t(
                    "quizz:question.config.revealDurationHint",
                    "Temps (sec) pour dévoiler complètement l'image.",
                  )}
                </ConfigField.Description>
              </ConfigField>

              <ConfigField>
                <ConfigField.Label
                  icon={<Settings className="size-4" />}
                  label={t(
                    "quizz:question.config.revealStyle",
                    "Catégorie & Mode d'effet",
                  )}
                />
                <select
                  value={mainType}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "grid") {
                      handleUpdateQuestion("revelationStyle")(gridPattern)
                    } else {
                      handleUpdateQuestion("revelationStyle")(val)
                    }
                  }}
                  className="border-border bg-surface text-ink focus:border-primary focus:ring-primary/30 hover:border-border-strong w-full cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition-all outline-none focus:ring-2"
                >
                  <optgroup label="🟩 Grilles & Tuiles">
                    <option value="grid">
                      {t(
                        "quizz:question.config.revealStyleOpt.grid",
                        "🟩 Révélation par cases",
                      )}
                    </option>
                  </optgroup>
                  <optgroup label="🔬 Optique & Spéciaux">
                    <option value="blur">
                      {t(
                        "quizz:question.config.revealStyleOpt.blur",
                        "🌫️ Défloutage progressif",
                      )}
                    </option>
                    <option value="iris">
                      {t(
                        "quizz:question.config.revealStyleOpt.iris",
                        "👁️ Diaphragme / Zoom optique",
                      )}
                    </option>
                    <option value="spotlight">
                      {t(
                        "quizz:question.config.revealStyleOpt.spotlight",
                        "🔦 Projecteur / Torche Scanner",
                      )}
                    </option>
                    <option value="thermal">
                      {t(
                        "quizz:question.config.revealStyleOpt.thermal",
                        "🕶️ Infrarouge → Couleurs",
                      )}
                    </option>
                  </optgroup>
                  <optgroup label="📺 Médias & Rétro Tech">
                    <option value="pixelate">
                      {t(
                        "quizz:question.config.revealStyleOpt.pixelate",
                        "👾 Dépixélisation progressive",
                      )}
                    </option>
                    <option value="glitch">
                      {t(
                        "quizz:question.config.revealStyleOpt.glitch",
                        "📺 Neige TV & Scanlines CRT",
                      )}
                    </option>
                    <option value="printer">
                      {t(
                        "quizz:question.config.revealStyleOpt.printer",
                        "🖨️ Impression Ligne par Ligne",
                      )}
                    </option>
                  </optgroup>
                  <optgroup label="🔥 Éléments & Matières">
                    <option value="burn">
                      {t(
                        "quizz:question.config.revealStyleOpt.burn",
                        "🔥 Combustion / Papier brûlé",
                      )}
                    </option>
                    <option value="ink">
                      {t(
                        "quizz:question.config.revealStyleOpt.ink",
                        "🎨 Diffusion d'Encre",
                      )}
                    </option>
                  </optgroup>
                </select>
              </ConfigField>

              {mainType === "grid" && (
                <>
                  <ConfigField>
                    <ConfigField.Label
                      icon={<Shapes className="size-4" />}
                      label={t(
                        "quizz:question.config.gridPattern",
                        "Sens d'apparition (Pattern)",
                      )}
                    />
                    <select
                      value={gridPattern}
                      onChange={(e) =>
                        handleUpdateQuestion("revelationStyle")(e.target.value)
                      }
                      className="border-border bg-surface text-ink focus:border-primary focus:ring-primary/30 hover:border-border-strong w-full cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition-all outline-none focus:ring-2"
                    >
                      <option value="random-grid">
                        {t(
                          "quizz:question.config.revealStyleOpt.randomGrid",
                          "Mosaïque aléatoire",
                        )}
                      </option>
                      <option value="center-out">
                        {t(
                          "quizz:question.config.revealStyleOpt.centerOut",
                          "Explosion du centre",
                        )}
                      </option>
                      <option value="diagonal-wave">
                        {t(
                          "quizz:question.config.revealStyleOpt.diagonalWave",
                          "Vague diagonale",
                        )}
                      </option>
                      <option value="spiral">
                        {t(
                          "quizz:question.config.revealStyleOpt.spiral",
                          "Spirale vortex",
                        )}
                      </option>
                      <option value="venetian">
                        {t(
                          "quizz:question.config.revealStyleOpt.venetian",
                          "Persiennes 3D (Volets)",
                        )}
                      </option>
                      <option value="curtain-horizontal">
                        {t(
                          "quizz:question.config.revealStyleOpt.curtainHorizontal",
                          "Rideau double latéral",
                        )}
                      </option>
                      <option value="left-to-right">
                        {t(
                          "quizz:question.config.revealStyleOpt.leftToRight",
                          "Balayage gauche à droite",
                        )}
                      </option>
                      <option value="top-to-bottom">
                        {t(
                          "quizz:question.config.revealStyleOpt.topToBottom",
                          "Chute haut en bas",
                        )}
                      </option>
                      <option value="honeycomb">
                        {t(
                          "quizz:question.config.revealStyleOpt.honeycomb",
                          "Nid d'abeille Hexagonal",
                        )}
                      </option>
                      <option value="puzzle">
                        {t(
                          "quizz:question.config.revealStyleOpt.puzzle",
                          "Pièces de Puzzle",
                        )}
                      </option>
                    </select>
                  </ConfigField>

                  <ConfigField>
                    <ConfigField.Label
                      icon={<Columns className="size-4" />}
                      label={t(
                        "quizz:question.config.revealCols",
                        "Colonnes (largeur)",
                      )}
                    />
                    <ConfigNumberInput
                      value={currentQuestion.gridCols ?? 8}
                      min={2}
                      max={30}
                      onChange={handleUpdateQuestion("gridCols")}
                    />
                  </ConfigField>

                  <ConfigField>
                    <ConfigField.Label
                      icon={<Grid className="size-4" />}
                      label={t(
                        "quizz:question.config.revealRows",
                        "Lignes (hauteur)",
                      )}
                    />
                    <ConfigNumberInput
                      value={currentQuestion.gridRows ?? 6}
                      min={2}
                      max={30}
                      onChange={handleUpdateQuestion("gridRows")}
                    />
                  </ConfigField>
                </>
              )}
            </>
          )
        })()}
    </div>
  )
}

export default AppearancePanel
