import type { McqQuestion, QuestionLayoutBox } from "@rahoot/common/types/game"
import ConfigNumberInput from "@rahoot/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import {
  ANSWERS_HEX,
  DARK_ANSWER_TEXT,
  DEFAULT_TITLE_FILL_HEX,
  DEFAULT_TITLE_FONT_SIZE,
  defaultAnswerFontSize,
  fontFamilyCss,
  type LayoutBoxKey,
  materializeLayout,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  updateLayoutBox,
} from "@rahoot/web/features/game/utils/question-layout"
import { isDarkTextAnswer } from "@rahoot/web/features/game/utils/constants"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import { AVAILABLE_FONTS } from "@rahoot/web/features/quizz/utils/fonts"
import { LayoutTemplate, RotateCcw, X } from "lucide-react"
import type { PropsWithChildren } from "react"
import { useTranslation } from "react-i18next"

const inputClass =
  "border-border text-ink focus:border-primary hover:border-border-strong focus:ring-primary/30 w-full rounded-lg border px-3 py-1.5 text-sm transition-colors outline-none focus:ring-2"

const Field = ({ label, children }: PropsWithChildren<{ label: string }>) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-ink text-sm font-semibold">{label}</span>
    {children}
  </div>
)

// Bouton « revenir à la valeur par défaut » d'un champ surchargé.
const ResetFieldButton = ({
  onClick,
  label,
}: {
  onClick: () => void
  label: string
}) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className="focus-ring text-ink-subtle hover:bg-panel hover:text-ink flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
  >
    <X className="size-4" />
  </button>
)

// Couleur surchargeable : pastille + valeur hexadécimale, bouton de remise à
// zéro quand une couleur personnalisée est définie.
const ColorField = ({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value?: string
  fallback: string
  onChange: (_value: string | undefined) => void
}) => {
  const { t } = useTranslation()

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? fallback}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="border-border size-8 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
        />
        <span className="text-ink-muted flex-1 truncate text-xs">
          {value ?? t("quizz:question.layout.default")}
        </span>
        {value && (
          <ResetFieldButton
            onClick={() => onChange(undefined)}
            label={t("quizz:question.layout.default")}
          />
        )}
      </div>
    </Field>
  )
}

// Réglages de la boîte sélectionnée sur la slide (titre ou case de réponse) :
// texte, couleurs, taille, police de la question, géométrie, remise à zéro.
const LayoutBoxPanel = ({ boxKey }: { boxKey: LayoutBoxKey }) => {
  const {
    currentQuestion: q,
    currentIndex,
    updateQuestion,
    fontFamily: quizzFont,
    setSelectedLayoutKey,
  } = useQuizzEditor()
  const { t } = useTranslation()

  const full = materializeLayout(q)
  const box = boxKey === "title" ? full.title : full.answers?.[boxKey]

  if (!box) {
    return null
  }

  const isTitle = boxKey === "title"
  const answerIndex = isTitle ? 0 : boxKey
  const isMcq = q.type === "mcq"
  const answerText = isMcq
    ? ((q as McqQuestion).answers[answerIndex] ?? "")
    : ""

  const patchBox = (patch: Partial<QuestionLayoutBox>) =>
    updateQuestion(currentIndex, {
      layout: updateLayoutBox(q, boxKey, patch),
    })

  const defaultFill = isTitle
    ? DEFAULT_TITLE_FILL_HEX
    : (ANSWERS_HEX[answerIndex % ANSWERS_HEX.length] ?? "#000000")
  const defaultTextColor =
    !isTitle && !box.fill && isDarkTextAnswer(answerIndex)
      ? DARK_ANSWER_TEXT
      : "#ffffff"
  const defaultFontSize = isTitle
    ? DEFAULT_TITLE_FONT_SIZE
    : defaultAnswerFontSize(answerText)

  const handleReset = () => {
    updateQuestion(currentIndex, { layout: undefined })
    setSelectedLayoutKey(undefined)
  }

  const quizzFontLabel = t("quizz:question.layout.fontQuizDefault", {
    font: quizzFont ?? t("quizz:question.layout.interfaceFont"),
  })

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* En-tête de la sélection */}
      <div className="border-border bg-panel flex items-start gap-2 rounded-xl border p-3">
        <LayoutTemplate className="text-primary mt-0.5 size-4 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-ink truncate text-sm font-bold">
            {isTitle
              ? t("quizz:question.layout.titleBox")
              : t("quizz:question.layout.answerBox", {
                  number: answerIndex + 1,
                })}
          </span>
          <span className="text-ink-subtle text-xs leading-relaxed">
            {t("quizz:question.layout.hint")}
          </span>
        </div>
      </div>

      {/* Texte : titre ou réponse de QCM (le vrai-faux a des libellés fixes) */}
      {isTitle && (
        <Field label={t("quizz:question.layout.text")}>
          <textarea
            rows={3}
            value={q.question}
            placeholder={t("quizz:question.placeholder")}
            onChange={(e) =>
              updateQuestion(currentIndex, { question: e.target.value })
            }
            className={`${inputClass} resize-y`}
          />
        </Field>
      )}
      {!isTitle && isMcq && (
        <Field label={t("quizz:question.layout.text")}>
          <input
            type="text"
            value={answerText}
            placeholder={t("quizz:addAnswerPlaceholder")}
            onChange={(e) => {
              const next = [...(q as McqQuestion).answers]
              next[answerIndex] = e.target.value
              updateQuestion(currentIndex, { answers: next })
            }}
            className={inputClass}
          />
        </Field>
      )}

      <ColorField
        label={t("quizz:question.layout.fill")}
        value={box.fill}
        fallback={defaultFill}
        onChange={(fill) => patchBox({ fill })}
      />
      <ColorField
        label={t("quizz:question.layout.textColor")}
        value={box.textColor}
        fallback={defaultTextColor}
        onChange={(textColor) => patchBox({ textColor })}
      />

      <Field label={t("quizz:question.layout.fontSize")}>
        <div className="flex items-center gap-2">
          <ConfigNumberInput
            value={box.fontSize ?? defaultFontSize}
            min={8}
            max={300}
            onChange={(fontSize) => patchBox({ fontSize })}
          />
          {box.fontSize === undefined ? (
            <span className="text-ink-subtle w-8 shrink-0 text-center text-xs">
              {t("quizz:question.layout.auto")}
            </span>
          ) : (
            <ResetFieldButton
              onClick={() => patchBox({ fontSize: undefined })}
              label={t("quizz:question.layout.auto")}
            />
          )}
        </div>
      </Field>

      {/* Police : propre à la question (titre + réponses), sinon celle du quiz */}
      <Field label={t("quizz:question.layout.font")}>
        <select
          value={q.fontFamily ?? ""}
          onChange={(e) =>
            updateQuestion(currentIndex, {
              fontFamily: e.target.value || undefined,
            })
          }
          className={inputClass}
          style={{ fontFamily: fontFamilyCss(q.fontFamily ?? quizzFont) }}
        >
          <option value="">{quizzFontLabel}</option>
          {AVAILABLE_FONTS.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("quizz:question.layout.geometry")}>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["x", -SLIDE_WIDTH, SLIDE_WIDTH * 2],
              ["y", -SLIDE_WIDTH, SLIDE_WIDTH * 2],
              ["width", 1, SLIDE_WIDTH * 2],
              ["height", 1, SLIDE_HEIGHT * 2],
            ] as const
          ).map(([key, min, max]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-ink-subtle text-[11px] font-semibold">
                {t(`quizz:question.layout.${key}`)}
              </span>
              <ConfigNumberInput
                value={Math.round(box[key])}
                min={min}
                max={max}
                onChange={(value) => patchBox({ [key]: value })}
              />
            </label>
          ))}
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleReset}
          disabled={!q.layout}
          className="focus-ring border-border text-ink hover:bg-panel flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          {t("quizz:question.layout.reset")}
        </button>
        <p className="text-ink-subtle text-xs leading-relaxed">
          {t("quizz:question.layout.resetHint")}
        </p>
      </div>
    </div>
  )
}

export default LayoutBoxPanel
