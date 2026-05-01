import type { DropPinZone } from "@rahoot/common/types/game"
import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
  SFX,
} from "@rahoot/web/features/game/utils/constants"
import { calculatePercentages } from "@rahoot/web/features/game/utils/score"
import clsx from "clsx"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

type Props = {
  data: ManagerStatusDataMap["SHOW_RESPONSES"]
}

// ── Open ─────────────────────────────────────────────────────────────────────

const OpenResult = ({ correctAnswers }: { correctAnswers: string[] }) => {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm font-bold uppercase tracking-widest text-white/50">
        {t("game:correctAnswer")}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {correctAnswers.map((answer, i) => (
          <div
            key={i}
            className="anim-show rounded-2xl bg-green-500 px-8 py-5 text-center text-2xl font-black text-white shadow-xl md:text-3xl"
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            ✓ {answer}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Date (slot machine) ───────────────────────────────────────────────────────

const DateResult = ({ correctYear }: { correctYear: number }) => {
  const { t } = useTranslation()
  const [displayed, setDisplayed] = useState(correctYear - 200)
  const [locked, setLocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const duration = 3000
    const startTime = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      if (progress >= 1) {
        setDisplayed(correctYear)
        setLocked(true)

        return
      }

      const range = Math.round(300 * Math.pow(1 - progress, 2.5))
      const offset = range > 0 ? Math.round((Math.random() - 0.5) * range * 2) : 0
      setDisplayed(correctYear + offset)

      const delay = 30 + 200 * Math.pow(progress, 2)
      timerRef.current = setTimeout(tick, delay)
    }

    timerRef.current = setTimeout(tick, 80)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [correctYear])

  const month = new Date().toLocaleString("fr-FR", { month: "long" })

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm font-bold uppercase tracking-widest text-white/50">
        {t("game:correctAnswer")}
      </p>
      <div className="w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-red-500 px-6 py-4 text-center">
          <span className="text-sm font-bold uppercase tracking-widest text-white/80">
            {month}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-100 px-3 py-2 text-center text-xs font-bold text-gray-400">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className={clsx("rounded py-0.5 text-gray-500", i + 1 === 15 && "bg-red-500 font-bold text-white")}
            >
              {i + 1}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-center bg-gray-50 py-6">
          <span
            className={clsx("font-black tabular-nums transition-colors duration-500", locked ? "text-green-500" : "text-gray-800")}
            style={{ fontSize: "clamp(3.5rem, 12vw, 7rem)", lineHeight: 1 }}
          >
            {displayed}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Slider (animation vers la bonne valeur) ───────────────────────────────────

const SliderResult = ({ correctValue, min = 0, max = 100 }: { correctValue: number; min?: number; max?: number }) => {
  const { t } = useTranslation()
  const [displayed, setDisplayed] = useState(min)
  const [locked, setLocked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const duration = 3000
    const startTime = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      if (progress >= 1) {
        setDisplayed(correctValue)
        setLocked(true)

        return
      }

      const base = min + (correctValue - min) * Math.pow(progress, 0.6)
      const range = (max - min) * 0.15 * Math.pow(1 - progress, 2)
      const offset = (Math.random() - 0.5) * range * 2
      const val = Math.round(Math.max(min, Math.min(max, base + offset)))
      setDisplayed(val)

      const delay = 30 + 180 * Math.pow(progress, 2)
      timerRef.current = setTimeout(tick, delay)
    }

    timerRef.current = setTimeout(tick, 100)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [correctValue, min, max])

  const percent = Math.round(((displayed - min) / (max - min)) * 100)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm font-bold uppercase tracking-widest text-white/50">
        {t("game:correctAnswer")}
      </p>
      <div className="w-full rounded-3xl bg-white/10 p-8 backdrop-blur-md">
        <div className="mb-8 text-center">
          <span
            className={clsx("font-black tabular-nums transition-colors duration-500", locked ? "text-green-400" : "text-white")}
            style={{ fontSize: "clamp(3rem, 10vw, 6rem)", lineHeight: 1 }}
          >
            {displayed}
          </span>
        </div>
        <div className="relative h-5 rounded-full bg-white/20">
          <div
            className={clsx("absolute h-full rounded-full transition-colors duration-500", locked ? "bg-green-400" : "bg-primary")}
            style={{ width: `${percent}%` }}
          />
          <div
            className={clsx("absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-lg transition-colors duration-500", locked ? "bg-green-400" : "bg-primary")}
            style={{ left: `${percent}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-sm font-bold text-white/50">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}

// ── MCQ / True-False bar chart ────────────────────────────────────────────────

const McqResult = ({
  answers,
  responses,
  solutions,
  percentages,
}: {
  answers: string[]
  responses: Record<number, number>
  solutions: number[]
  percentages: Record<string, string>
}) => (
  <>
    <div
      className="mt-8 grid h-40 w-full max-w-3xl gap-4 px-2"
      style={{ gridTemplateColumns: `repeat(${answers.length}, 1fr)` }}
    >
      {answers.map((_, key) => (
        <div
          key={key}
          className={clsx(
            "anim-bar-grow flex flex-col justify-end self-end overflow-hidden rounded-md origin-bottom",
            ANSWERS_COLORS[key],
          )}
          style={{ height: percentages[key], animationDelay: `${key * 0.1}s` }}
        >
          <span className="w-full bg-black/10 text-center text-lg font-bold text-white drop-shadow-md">
            {responses[key] || 0}
          </span>
        </div>
      ))}
    </div>

    <div className="mx-auto mb-4 grid w-full max-w-7xl grid-cols-2 gap-1 rounded-full px-2 text-lg font-bold text-white md:text-xl">
      {answers.map((answer, key) => (
        <AnswerButton
          key={key}
          index={key}
          className={clsx(ANSWERS_COLORS[key])}
          icon={ANSWERS_ICONS[key]}
          correct={solutions.includes(key)}
        >
          {answer}
        </AnswerButton>
      ))}
    </div>
  </>
)

// ── True / False ─────────────────────────────────────────────────────────────

const TrueFalseResult = ({
  responses,
  solutions,
  percentages,
}: {
  responses: Record<number, number>
  solutions: number[]
  percentages: Record<string, string>
}) => {
  const { t } = useTranslation()
  const labels = [t("game:false"), t("game:true")]
  const colors = ["bg-red-500", "bg-blue-500"]

  return (
    <>
      <div className="mt-8 grid h-40 w-full max-w-3xl grid-cols-2 gap-4 px-2">
        {labels.map((_, key) => (
          <div
            key={key}
            className={clsx(
              "anim-bar-grow flex flex-col justify-end self-end overflow-hidden rounded-md origin-bottom",
              colors[key],
            )}
            style={{ height: percentages[key], animationDelay: `${key * 0.1}s` }}
          >
            <span className="w-full bg-black/10 text-center text-lg font-bold text-white drop-shadow-md">
              {responses[key] || 0}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-auto mb-4 grid w-full max-w-7xl grid-cols-2 gap-1 px-2 text-lg font-bold text-white md:text-xl">
        {labels.map((label, key) => (
          <AnswerButton
            key={key}
            index={key}
            className={clsx(colors[key])}
            icon={ANSWERS_ICONS[key]}
            correct={solutions.includes(key)}
          >
            {label}
          </AnswerButton>
        ))}
      </div>
    </>
  )
}

// ── Puzzle ────────────────────────────────────────────────────────────────────

const PuzzleResult = ({ items }: { items: string[] }) => {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm font-bold uppercase tracking-widest text-white/50">
        {t("game:correctOrder")}
      </p>
      <div className="flex w-full flex-col gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="anim-show flex items-center gap-3 rounded-2xl bg-green-500 px-5 py-3 shadow-xl"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-black text-white">
              {i + 1}
            </span>
            <span className="text-lg font-bold text-white">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Drop Pin ──────────────────────────────────────────────────────────────────

const DropPinResult = ({ pinImage, zones }: { pinImage: string; zones: DropPinZone[] }) => {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm font-bold uppercase tracking-widest text-white/50">
        {t("game:correctZones")}
      </p>
      <div className="relative w-full overflow-hidden rounded-2xl">
        <img src={pinImage} alt="" className="block w-full object-contain" />
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="absolute"
            style={{
              left: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${zone.width}%`,
              height: `${zone.height}%`,
              backgroundColor: zone.isCorrect ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.20)",
              border: zone.isCorrect ? "2px solid rgba(34,197,94,0.9)" : "2px solid rgba(239,68,68,0.5)",
              borderRadius: "6px",
            }}
          >
            {zone.label && (
              <span className="absolute bottom-0.5 left-1 text-xs font-bold text-white drop-shadow">
                {zone.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

const Responses = ({
  data: { question, type, answers: rawAnswers, responses, solutions: rawSolutions, correctAnswers, correctYear, correctValue, min, max, items, pinImage, zones },
}: Props) => {
  const answers = rawAnswers ?? []
  const solutions = rawSolutions ?? []
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const [sfxResults] = useSound(SFX.RESULTS_SOUND, { volume: 0.2 })
  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, { volume: 0.2 })

  useEffect(() => {
    stopMusic()
    sfxResults()
    setPercentages(calculatePercentages(responses))
    playMusic()

    return () => {
      stopMusic()
    }
  }, [])

  return (
    <div className="flex flex-1 flex-col justify-between">
      <div className="mx-auto inline-flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5">
        <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {question}
        </h2>

        {type === "mcq" && (
          <McqResult
            answers={answers}
            responses={responses}
            solutions={solutions}
            percentages={percentages}
          />
        )}

        {type === "true_false" && (
          <TrueFalseResult
            responses={responses}
            solutions={solutions}
            percentages={percentages}
          />
        )}

        {type === "open" && correctAnswers && correctAnswers.length > 0 && (
          <OpenResult correctAnswers={correctAnswers} />
        )}

        {type === "date" && correctYear !== undefined && (
          <DateResult correctYear={correctYear} />
        )}

        {type === "slider" && correctValue !== undefined && (
          <SliderResult correctValue={correctValue} min={min} max={max} />
        )}

        {type === "puzzle" && items && items.length > 0 && (
          <PuzzleResult items={items} />
        )}

        {type === "drop_pin" && pinImage && zones && (
          <DropPinResult pinImage={pinImage} zones={zones} />
        )}
      </div>
    </div>
  )
}

export default Responses
