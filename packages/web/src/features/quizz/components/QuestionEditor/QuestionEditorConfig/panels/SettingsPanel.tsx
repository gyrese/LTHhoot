import ConfigField from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import ConfigToggle from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigToggle"
import QuestionEditorAnswerReveal from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorAnswerReveal"
import QuestionEditorTypeSelector from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorTypeSelector"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  CheckCircle2,
  Clock,
  Shapes,
  Timer,
  Trophy,
  Zap,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

const SettingsPanel = () => {
  const { currentQuestion, currentIndex, updateQuestion, applyToAllQuestions } =
    useQuizzEditor()
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
            value={currentQuestion.cooldown}
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
              value={currentQuestion.time}
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
            checked={Boolean(currentQuestion.showLeaderboard)}
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
            checked={Boolean(currentQuestion.suddenDeath)}
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
    </>
  )
}

export default SettingsPanel
