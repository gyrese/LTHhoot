import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import ConfigToggle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigToggle"
import QuestionEditorAnswerReveal from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorAnswerReveal"
import QuestionEditorTypeSelector from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTypeSelector"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  Clock,
  Contrast,
  Timer,
  Trophy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Volume2,
  Repeat,
  Settings,
  Play,
  Grid,
  Columns,
  Shapes,
  Layers,
  Sparkles,
  CheckCircle2,
  MessageSquareReply,
  Lock,
  Unlock,
  Zap,
} from "lucide-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"
import clsx from "clsx"

const QuestionEditorConfig = () => {
  const {
    currentQuestion,
    currentIndex,
    updateQuestion,
    applyToAllQuestions,
    selectedId,
    setSelectedId,
  } = useQuizzEditor()
  const { t } = useTranslation()

  const handleUpdateQuestion =
    (key: string) => (value: string | number | boolean) => {
      updateQuestion(currentIndex, { [key]: value })
    }

  const handleUpdateElement = (id: string, updates: any) => {
    const elements = (currentQuestion?.elements || []).map((el) =>
      el.id === id ? { ...el, ...updates } : el,
    )
    updateQuestion(currentIndex, { elements })
  }

  const handleDeleteLayer = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const elements = (currentQuestion?.elements || []).filter(
      (el) => el.id !== id,
    )
    updateQuestion(currentIndex, { elements })

    if (selectedId === id) {
      setSelectedId(undefined)
    }
  }

  const handleMoveLayer =
    (id: string, direction: "up" | "down") => (e: React.MouseEvent) => {
      e.stopPropagation()
      const elements = [...(currentQuestion?.elements || [])]
      const index = elements.findIndex((el) => el.id === id)

      if (index === -1) {
        return
      }

      if (direction === "up" && index < elements.length - 1) {
        ;[elements[index], elements[index + 1]] = [
          elements[index + 1],
          elements[index],
        ]
      } else if (direction === "down" && index > 0) {
        ;[elements[index], elements[index - 1]] = [
          elements[index - 1],
          elements[index],
        ]
      }

      updateQuestion(currentIndex, { elements })
    }

  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [editingLayerName, setEditingLayerName] = useState("")

  const handleToggleLock = (id: string, isLocked: boolean) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const elements = (currentQuestion?.elements || []).map((el) =>
      el.id === id ? { ...el, isLocked } : el,
    )
    updateQuestion(currentIndex, { elements })
  }

  const handleStartRename = (id: string, currentName: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingLayerId(id)
    setEditingLayerName(currentName)
  }

  const handleFinishRename = (id: string) => {
    const elements = (currentQuestion?.elements || []).map((el) =>
      el.id === id ? { ...el, name: editingLayerName.trim() || undefined } : el,
    )
    updateQuestion(currentIndex, { elements })
    setEditingLayerId(null)
  }

  const isSlide = currentQuestion?.type === "title"
  const selectedElement = currentQuestion?.elements?.find(
    (el) => el.id === selectedId,
  )
  const isYoutube = selectedElement?.type === "youtube"

  if (!currentQuestion) {
    return null
  }

  const ytChip = (active: boolean) =>
    clsx(
      "focus-ring flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase transition-all duration-150",
      active
        ? "border-primary bg-primary text-secondary"
        : "border-border bg-surface text-ink-muted hover:bg-panel hover:text-ink",
    )

  return (
    <aside className="border-border bg-surface scrollbar-light z-10 flex w-68 shrink-0 flex-col overflow-auto border-l">
      <div className="border-border/70 bg-surface sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
        <span className="text-ink-muted text-xs font-bold">Inspecteur</span>
      </div>

      <div className="flex flex-col px-4 pb-4">
        {isYoutube && (
          <ConfigSection
            title="Vidéo YouTube"
            icon={<Play className="size-4" />}
            defaultOpen={true}
          >
            <div className="border-border bg-panel flex flex-col gap-4 rounded-xl border p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    handleUpdateElement(selectedId!, {
                      autoplay: !selectedElement!.autoplay,
                    })
                  }
                  className={ytChip(Boolean(selectedElement!.autoplay))}
                >
                  <Play className="size-3" /> Autoplay
                </button>
                <button
                  onClick={() =>
                    handleUpdateElement(selectedId!, {
                      mute: !selectedElement!.mute,
                    })
                  }
                  className={ytChip(Boolean(selectedElement!.mute))}
                >
                  <Volume2 className="size-3" /> Muet
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    handleUpdateElement(selectedId!, {
                      loop: !selectedElement!.loop,
                    })
                  }
                  className={ytChip(Boolean(selectedElement!.loop))}
                >
                  <Repeat className="size-3" /> Boucle
                </button>
                <button
                  onClick={() =>
                    handleUpdateElement(selectedId!, {
                      controls: !selectedElement!.controls,
                    })
                  }
                  className={ytChip(Boolean(selectedElement!.controls))}
                >
                  <Settings className="size-3" /> Contrôles
                </button>
              </div>

              <div className="bg-border my-1 h-px" />

              <div className="flex flex-col gap-3">
                <ConfigField>
                  <ConfigField.Label
                    icon={<Clock className="size-4" />}
                    label="Début (sec)"
                  />
                  <ConfigNumberInput
                    value={(selectedElement as any).startTime || 0}
                    min={0}
                    onChange={(val) =>
                      handleUpdateElement(selectedId!, { startTime: val })
                    }
                  />
                </ConfigField>

                <ConfigField>
                  <ConfigField.Label
                    icon={<Clock className="size-4" />}
                    label="Fin (sec)"
                  />
                  <ConfigNumberInput
                    value={(selectedElement as any).endTime || 0}
                    min={0}
                    onChange={(val) =>
                      handleUpdateElement(selectedId!, { endTime: val })
                    }
                  />
                  <ConfigField.Description>
                    0 pour désactiver
                  </ConfigField.Description>
                </ConfigField>
              </div>
            </div>
          </ConfigSection>
        )}

        <ConfigSection
          title={t("quizz:question.config.typeTitle", "Type de question")}
          icon={<Shapes className="size-4" />}
          defaultOpen={false}
        >
          <QuestionEditorTypeSelector />
        </ConfigSection>

        {!isSlide && (
          <ConfigSection
            title={t("quizz:question.config.answerTitle", "Réponse")}
            icon={<CheckCircle2 className="size-4" />}
            defaultOpen={false}
          >
            <QuestionEditorAnswerReveal />
          </ConfigSection>
        )}

        <ConfigSection
          title={t("quizz:question.config.timingTitle", "Minutage & score")}
          icon={<Timer className="size-4" />}
          defaultOpen={true}
        >
          <ConfigField>
            <ConfigField.Label
              icon={<Clock className="size-4" />}
              label={t(
                isSlide
                  ? "quizz:question.config.displayDuration"
                  : "quizz:question.config.questionDisplay",
              )}
            />
            <ConfigNumberInput
              value={currentQuestion?.cooldown}
              min={3}
              onChange={(val) => {
                handleUpdateQuestion("cooldown")(val)
              }}
            />
            <ConfigField.Description>
              {t(
                isSlide
                  ? "quizz:question.config.displayDurationHint"
                  : "quizz:question.config.questionDisplayHint",
              )}
            </ConfigField.Description>
          </ConfigField>

          {!isSlide && (
            <ConfigField>
              <ConfigField.Label
                icon={<Timer className="size-4" />}
                label={t("quizz:question.config.answerTime")}
              />
              <ConfigNumberInput
                value={currentQuestion?.time}
                min={5}
                onChange={handleUpdateQuestion("time")}
              />
              <ConfigField.Description>
                {t("quizz:question.config.answerTimeHint")}
              </ConfigField.Description>
            </ConfigField>
          )}

          {!isSlide && (
            <ConfigToggle
              icon={<Trophy className="size-4" />}
              label={t("quizz:question.config.showLeaderboard")}
              checked={Boolean(currentQuestion?.showLeaderboard)}
              onChange={(value) =>
                updateQuestion(currentIndex, { showLeaderboard: value })
              }
              description={t("quizz:question.config.showLeaderboardHint")}
            />
          )}

          {!isSlide && (
            <ConfigToggle
              icon={<Zap className="size-4" />}
              label={t("quizz:question.config.suddenDeath", "Mort subite")}
              checked={Boolean(currentQuestion?.suddenDeath)}
              onChange={(value) =>
                updateQuestion(currentIndex, { suddenDeath: value })
              }
              description={t(
                "quizz:question.config.suddenDeathHint",
                "La manche s'arrête dès la première bonne réponse.",
              )}
            />
          )}

          <button
            type="button"
            onClick={() => {
              applyToAllQuestions({
                time: currentQuestion.time,
                cooldown: currentQuestion.cooldown,
              })
              toast.success(t("quizz:question.config.appliedToAll"))
            }}
            className="border-border text-ink-muted hover:bg-panel hover:text-ink mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors"
          >
            <Timer className="size-3.5" />
            {t("quizz:question.config.applyTimingToAll")}
          </button>
        </ConfigSection>

        <ConfigSection
          title={t("quizz:question.config.appearanceTitle", "Apparence & révélation")}
          icon={<Sparkles className="size-4" />}
          defaultOpen={false}
        >
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
                value={(currentQuestion?.backgroundOpacity ?? 0.5) * 100}
                onChange={(e) =>
                  handleUpdateQuestion("backgroundOpacity")(
                    Number(e.target.value) / 100,
                  )
                }
                className="accent-primary bg-border h-1.5 w-full cursor-pointer appearance-none rounded-lg"
              />
              <span className="text-ink-muted w-8 text-right text-xs font-medium tabular-nums">
                {Math.round((currentQuestion?.backgroundOpacity ?? 0.5) * 100)}%
              </span>
            </div>
            <ConfigField.Description>
              {t("quizz:question.config.opacityHint")}
            </ConfigField.Description>
          </ConfigField>

          <ConfigToggle
            icon={<Grid className="size-4" />}
            label={t("quizz:question.config.revelationEnabled", "Activer l'effet")}
            checked={Boolean(currentQuestion?.revelationEnabled)}
            onChange={(value) =>
              updateQuestion(currentIndex, { revelationEnabled: value })
            }
            description={t(
              "quizz:question.config.revelationEnabledHint",
              "Dévoile progressivement l'image d'arrière-plan.",
            )}
          />

          {currentQuestion?.revelationEnabled && (
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

              <ConfigField>
                <ConfigField.Label
                  icon={<Settings className="size-4" />}
                  label={t(
                    "quizz:question.config.revealStyle",
                    "Type d'apparition",
                  )}
                />
                <select
                  value={currentQuestion.revelationStyle ?? "random"}
                  onChange={(e) =>
                    handleUpdateQuestion("revelationStyle")(e.target.value)
                  }
                  className="border-border bg-surface text-ink focus:border-primary focus:ring-primary/30 w-full cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold outline-none transition-all hover:border-border-strong focus:ring-2"
                >
                  <option value="random">
                    {t("quizz:question.config.revealStyleOpt.random", "Aléatoire")}
                  </option>
                  <option value="blur">
                    {t(
                      "quizz:question.config.revealStyleOpt.blur",
                      "Défloutage progressif",
                    )}
                  </option>
                  <option value="random-grid">
                    {t(
                      "quizz:question.config.revealStyleOpt.randomGrid",
                      "Cases aléatoires",
                    )}
                  </option>
                  <option value="center-out">
                    {t(
                      "quizz:question.config.revealStyleOpt.centerOut",
                      "Centre vers bords",
                    )}
                  </option>
                  <option value="diagonal-wave">
                    {t(
                      "quizz:question.config.revealStyleOpt.diagonalWave",
                      "Vague diagonale",
                    )}
                  </option>
                  <option value="spiral">
                    {t("quizz:question.config.revealStyleOpt.spiral", "Spirale")}
                  </option>
                  <option value="left-to-right">
                    {t(
                      "quizz:question.config.revealStyleOpt.leftToRight",
                      "Gauche à droite",
                    )}
                  </option>
                  <option value="top-to-bottom">
                    {t(
                      "quizz:question.config.revealStyleOpt.topToBottom",
                      "Haut en bas",
                    )}
                  </option>
                </select>
              </ConfigField>
            </>
          )}
        </ConfigSection>

        <ConfigSection
          title={t("quizz:question.config.layersTitle")}
          icon={<Layers className="size-4" />}
          defaultOpen={true}
        >
          <div className="flex flex-col gap-1.5">
            {[...(currentQuestion?.elements || [])]
              .reverse()
              .map((el, i, arr) => {
                const isSelected = selectedId === el.id
                const originalIndex = arr.length - 1 - i

                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={clsx(
                      "ease-out-soft flex cursor-pointer items-center justify-between rounded-lg border p-2 text-[11px] transition-all duration-150",
                      isSelected
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-surface hover:bg-panel",
                    )}
                  >
                    {editingLayerId === el.id ? (
                      <input
                        type="text"
                        value={editingLayerName}
                        onChange={(e) => setEditingLayerName(e.target.value)}
                        onBlur={() => handleFinishRename(el.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleFinishRename(el.id)
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent text-ink border-primary focus:border-primary border-b outline-none font-medium flex-1 text-[11px] py-0.5"
                        autoFocus
                      />
                    ) : (
                      <div
                        className="flex flex-1 items-center gap-2 overflow-hidden"
                        onDoubleClick={handleStartRename(el.id, el.name || el.type)}
                      >
                        <div
                          className={clsx(
                            "size-1.5 rounded-full",
                            isSelected ? "bg-primary" : "bg-border-strong",
                          )}
                        />
                        <span
                          className={clsx(
                            "shrink-0 font-bold capitalize truncate max-w-[90px]",
                            isSelected ? "text-primary-ink" : "text-ink",
                          )}
                          title="Double-cliquer pour renommer"
                        >
                          {el.name || el.type}
                        </span>
                        {el.type === "text" && !el.name && (
                          <span className="text-ink-subtle truncate italic">
                            "{el.text}"
                          </span>
                        )}
                      </div>
                    )}

                    <div className="ml-2 flex items-center gap-0.5">
                      <button
                        onClick={handleToggleLock(el.id, !el.isLocked)}
                        className={clsx(
                          "rounded p-1 hover:bg-white",
                          el.isLocked
                            ? "text-primary"
                            : "text-ink-subtle hover:text-primary-ink",
                        )}
                        title={el.isLocked ? "Déverrouiller" : "Verrouiller"}
                      >
                        {el.isLocked ? (
                          <Lock className="size-3.5" />
                        ) : (
                          <Unlock className="size-3.5" />
                        )}
                      </button>
                      <button
                        onClick={handleMoveLayer(el.id, "up")}
                        disabled={originalIndex === arr.length - 1}
                        className="text-ink-subtle hover:text-primary-ink rounded p-1 hover:bg-white disabled:opacity-20"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        onClick={handleMoveLayer(el.id, "down")}
                        disabled={originalIndex === 0}
                        className="text-ink-subtle hover:text-primary-ink rounded p-1 hover:bg-white disabled:opacity-20"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                      <button
                        onClick={handleDeleteLayer(el.id)}
                        className="text-ink-subtle hover:text-danger ml-1 rounded p-1 hover:bg-white"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            {(!currentQuestion?.elements ||
              currentQuestion.elements.length === 0) && (
              <div className="text-ink-subtle flex flex-col items-center gap-2 py-6 text-center">
                <MessageSquareReply className="size-5 opacity-50" />
                <p className="text-xs">{t("quizz:question.config.noLayers")}</p>
              </div>
            )}
          </div>
        </ConfigSection>
      </div>
    </aside>
  )
}

export default QuestionEditorConfig
