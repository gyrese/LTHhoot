import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import ConfigToggle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigToggle"
import TimingPresetButtons from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/TimingPresetButtons"
import QuestionEditorAnswerReveal from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorAnswerReveal"
import QuestionEditorTypeSelector from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTypeSelector"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { previousQuestionSettings } from "@rahoot/web/features/quizz/utils/question-settings"
import {
  CheckCircle2,
  Clock,
  Copy,
  Shapes,
  Timer,
  Trophy,
  Zap,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

const SettingsPanel = () => {
  const {
    currentQuestion,
    currentIndex,
    questions,
    updateQuestion,
    applyTimingToSimilarQuestions,
    validationTarget,
  } = useQuizzEditor()
  const { t } = useTranslation()

  if (!currentQuestion) {
    return null
  }

  const isSlide = currentQuestion.type === "title"
  const previousSettings = previousQuestionSettings(questions, currentIndex)
  const hasSimilarQuestions = questions.some(
    (question, index) =>
      index !== currentIndex && (question.type === "title") === isSlide,
  )
  const displayLabel = t(
    isSlide
      ? "quizz:question.config.displayDuration"
      : "quizz:question.config.questionDisplay",
  )
  const answerLabel = t("quizz:question.config.answerTime")

  const handleUpdateQuestion =
    (key: string) => (value: string | number | boolean) => {
      updateQuestion(currentIndex, { [key]: value })
    }

  return (
    <>
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

      {previousSettings && (
        <button
          type="button"
          onClick={() => {
            updateQuestion(currentIndex, previousSettings.patch)
            toast.success(t("quizz:question.config.copiedPreviousSettings"))
          }}
          className="focus-ring border-border text-ink-muted hover:bg-panel hover:text-ink mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors"
        >
          <Copy className="size-3.5 shrink-0" />
          {t("quizz:question.config.copyPreviousSettings", {
            number: previousSettings.sourceIndex + 1,
          })}
        </button>
      )}

      <ConfigSection
        title={t(
          isSlide
            ? "quizz:question.config.titleTimingTitle"
            : "quizz:question.config.questionTimingTitle",
        )}
        revealKey={
          validationTarget && /\.(time|cooldown)$/u.test(validationTarget.path)
            ? validationTarget
            : null
        }
        icon={<Timer className="size-4" />}
        defaultOpen={true}
      >
        <ConfigField>
          <ConfigField.Label
            icon={<Clock className="size-4" />}
            label={displayLabel}
          />
          <ConfigNumberInput
            field="cooldown"
            value={currentQuestion.cooldown}
            min={3}
            max={isSlide ? 120 : 15}
            onChange={(val) => {
              handleUpdateQuestion("cooldown")(val)
            }}
          />
          <TimingPresetButtons
            label={displayLabel}
            value={currentQuestion.cooldown}
            presets={isSlide ? [5, 10, 30, 60] : [3, 5, 10, 15]}
            onSelect={(seconds) =>
              updateQuestion(currentIndex, { cooldown: seconds })
            }
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
              label={answerLabel}
            />
            <ConfigNumberInput
              field="time"
              value={currentQuestion.time}
              min={5}
              max={600}
              onChange={handleUpdateQuestion("time")}
            />
            <TimingPresetButtons
              label={answerLabel}
              value={currentQuestion.time}
              presets={[10, 45, 90, 120]}
              onSelect={(seconds) =>
                updateQuestion(currentIndex, { time: seconds })
              }
            />
            <ConfigField.Description>
              {t("quizz:question.config.answerTimeHint")}
            </ConfigField.Description>
          </ConfigField>
        )}

        {hasSimilarQuestions && (
          <button
            type="button"
            onClick={() => {
              applyTimingToSimilarQuestions(currentIndex)
              toast.success(t("quizz:question.config.appliedTimingToSimilar"))
            }}
            className="focus-ring border-border text-ink-muted hover:bg-panel hover:text-ink mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors"
          >
            <Timer className="size-3.5" />
            {t(
              isSlide
                ? "quizz:question.config.applyTimingToTitles"
                : "quizz:question.config.applyTimingToQuestions",
            )}
          </button>
        )}
      </ConfigSection>

      {!isSlide && (
        <ConfigSection
          title={t("quizz:question.config.scoreTitle")}
          icon={<Trophy className="size-4" />}
          defaultOpen={true}
        >
          <ConfigToggle
            icon={<Trophy className="size-4" />}
            label={t("quizz:question.config.showLeaderboard")}
            checked={Boolean(currentQuestion.showLeaderboard)}
            onChange={(value) =>
              updateQuestion(currentIndex, { showLeaderboard: value })
            }
            description={t("quizz:question.config.showLeaderboardHint")}
          />
          <ConfigToggle
            icon={<Zap className="size-4 text-amber-500" />}
            label={t("game:roundEvent.doublePoints")}
            checked={currentQuestion.pointsMultiplier === 2}
            onChange={(value) =>
              updateQuestion(currentIndex, {
                pointsMultiplier: value ? 2 : undefined,
              })
            }
            description={t("game:roundEvent.doublePointsHint")}
          />
          <ConfigToggle
            icon={<Zap className="size-4" />}
            label={t("quizz:question.config.suddenDeath")}
            checked={Boolean(currentQuestion.suddenDeath)}
            onChange={(value) =>
              updateQuestion(currentIndex, { suddenDeath: value })
            }
            description={t("quizz:question.config.suddenDeathHint")}
          />
        </ConfigSection>
      )}
    </>
  )
}

export default SettingsPanel
