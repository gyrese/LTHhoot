import { useTranslation } from "react-i18next"
import clsx from "clsx"
import { ANSWERS_COLORS, ANSWERS_ICONS } from "@rahoot/web/features/game/utils/constants"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
import { useState, type FormEvent } from "react"

export const McqAnswers = ({
  answers,
  onAnswer,
  iconOnly,
}: {
  answers: string[]
  onAnswer: (_key: number) => void
  iconOnly?: boolean
}) => (
  <div className="mx-auto mb-4 grid w-full max-w-7xl grid-cols-2 gap-1 px-2">
    {answers.map((answer, key) => (
      <AnswerButton
        key={key}
        index={key}
        className={clsx(ANSWERS_COLORS[key])}
        icon={ANSWERS_ICONS[key]}
        iconOnly={iconOnly}
        onClick={() => onAnswer(key)}
      >
        {answer}
      </AnswerButton>
    ))}
  </div>
)

export const TrueFalseAnswers = ({ onAnswer }: { onAnswer?: (_key: number) => void }) => {
  const { t } = useTranslation()

  return (
    <div className="mx-auto mb-4 grid w-full max-w-7xl grid-cols-2 gap-1 px-2">
      <AnswerButton
        index={0}
        className="bg-red-500"
        icon={ANSWERS_ICONS[0]}
        onClick={() => onAnswer?.(0)}
      >
        {t("game:false")}
      </AnswerButton>
      <AnswerButton
        index={1}
        className="bg-blue-500"
        icon={ANSWERS_ICONS[1]}
        onClick={() => onAnswer?.(1)}
      >
        {t("game:true")}
      </AnswerButton>
    </div>
  )
}

export const OpenAnswer = ({
  onTextAnswer,
}: {
  onTextAnswer: (_text: string) => void
}) => {
  const [value, setValue] = useState("")
  const { t } = useTranslation()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (value.trim()) {
      onTextAnswer(value.trim())
    }
  }

  return (
    <div className="mx-auto mb-4 w-full max-w-lg px-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("game:openAnswerPlaceholder")}
          className="flex-1 rounded-xl bg-white px-4 py-3 text-lg font-semibold text-gray-800 outline-none placeholder-gray-400"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-white hover:bg-yellow-600 disabled:opacity-40"
        >
          {t("common:submit")}
        </button>
      </form>
    </div>
  )
}

export const OpenAnswerPlaceholder = () => {
  const { t } = useTranslation()

  return (
    <div className="mx-auto mb-4 w-full max-w-lg px-2 anim-slide-up">
      <div className="flex gap-2 opacity-60">
        <div className="flex-1 rounded-xl bg-white/10 border-2 border-white/20 px-4 py-3 text-lg font-semibold text-white/40 backdrop-blur-sm">
          {t("game:openAnswerPlaceholder")}
        </div>
        <div className="rounded-xl bg-white/10 border-2 border-white/20 px-5 py-3 font-bold text-white/40 backdrop-blur-sm">
          {t("common:submit")}
        </div>
      </div>
    </div>
  )
}

export const DateAnswer = ({
  minYear,
  maxYear,
  onNumberAnswer,
}: {
  minYear?: number
  maxYear?: number
  onNumberAnswer: (_n: number) => void
}) => {
  const currentYear = new Date().getFullYear()
  const min = minYear ?? 0
  const max = maxYear ?? currentYear
  const [value, setValue] = useState(Math.round((min + max) / 2))
  const [submitted, setSubmitted] = useState(false)
  const { t } = useTranslation()

  const handleSubmit = () => {
    if (!submitted) {
      setSubmitted(true)
      onNumberAnswer(value)
    }
  }

  return (
    <div className="mx-auto mb-4 w-full max-w-lg px-2">
      <div className="flex flex-col items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={submitted}
          onChange={(e) => setValue(parseInt(e.target.value, 10))}
          className="w-full accent-yellow-400"
        />
        <div className="flex w-full items-center justify-between px-1 text-sm text-white/60">
          <span>{min}</span>
          <span className="text-3xl font-bold text-white">{value}</span>
          <span>{max}</span>
        </div>
        <button
          type="button"
          disabled={submitted}
          onClick={handleSubmit}
          className="rounded-xl bg-yellow-500 px-8 py-3 font-bold text-white hover:bg-yellow-600 disabled:opacity-40"
        >
          {submitted ? t("game:answerSent") : t("common:submit")}
        </button>
      </div>
    </div>
  )
}

export const SliderAnswer = ({
  min,
  max,
  onNumberAnswer,
}: {
  min: number
  max: number
  onNumberAnswer: (_n: number) => void
}) => {
  const [value, setValue] = useState(Math.round((min + max) / 2))
  const [submitted, setSubmitted] = useState(false)
  const { t } = useTranslation()

  const handleSubmit = () => {
    if (!submitted) {
      setSubmitted(true)
      onNumberAnswer(value)
    }
  }

  return (
    <div className="mx-auto mb-4 w-full max-w-lg px-2">
      <div className="flex flex-col items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={submitted}
          onChange={(e) => setValue(parseFloat(e.target.value))}
          className="w-full accent-yellow-400"
        />
        <div className="flex w-full items-center justify-between px-1 text-sm text-white/60">
          <span>{min}</span>
          <span className="text-3xl font-bold text-white">{value}</span>
          <span>{max}</span>
        </div>
        <button
          type="button"
          disabled={submitted}
          onClick={handleSubmit}
          className="rounded-xl bg-yellow-500 px-8 py-3 font-bold text-white hover:bg-yellow-600 disabled:opacity-40"
        >
          {submitted ? t("game:answerSent") : t("common:submit")}
        </button>
      </div>
    </div>
  )
}
