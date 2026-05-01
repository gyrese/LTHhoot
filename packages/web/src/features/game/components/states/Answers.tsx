import { EVENTS, MEDIA_TYPES } from "@rahoot/common/constants"
import { DropPinAnswer, PuzzleAnswer } from "@rahoot/web/features/game/components/states/AnswerInputs"
import type { QuestionMediaType, SlideElement } from "@rahoot/common/types/game"

const noopChange = (_els: SlideElement[]) => undefined
const noopSelect = (_id: string | undefined) => undefined
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
import SlideCanvas from "@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
  SFX,
} from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

// ── MCQ ──────────────────────────────────────────────────────────────────────

const McqAnswers = ({
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

// ── TRUE / FALSE ──────────────────────────────────────────────────────────────

const TrueFalseAnswers = ({ onAnswer }: { onAnswer?: (_key: number) => void }) => {
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

// ── OPEN ──────────────────────────────────────────────────────────────────────

const OpenAnswer = ({
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

const OpenAnswerPlaceholder = () => {
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

// ── DATE ──────────────────────────────────────────────────────────────────────

const DateAnswer = ({
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

// ── SLIDER ────────────────────────────────────────────────────────────────────

const SliderAnswer = ({
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

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const Answers = ({
  data: { question, type, answers, media, background, backgroundOpacity, elements, audio, time, totalPlayer, min, max, minYear, maxYear, items, pinImage },
}: Props) => {
  const { socket } = useSocket()
  const { player, gameId } = usePlayerStore()
  const [answered, setAnswered] = useState(false)

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const { t } = useTranslation()
  const slideAudioRef = useRef<HTMLAudioElement>(null)

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, { volume: 0.1 })
  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  const emit = (payload: {
    answerId?: number
    textAnswer?: string
    numberAnswer?: number
    orderAnswer?: number[]
  }) => {
    if (!player || !gameId || answered) {
      return
    }

    socket?.emit(EVENTS.PLAYER.SELECTED_ANSWER, { gameId, data: payload })
    setAnswered(true)
    sfxPop()
  }

  useEffect(() => {
    const disabledMusicMedia = [
      MEDIA_TYPES.AUDIO,
      MEDIA_TYPES.VIDEO,
    ] as QuestionMediaType[]

    if (disabledMusicMedia.includes(media?.type) || audio) {
      return
    }

    playMusic()

    // eslint-disable-next-line consistent-return
    return () => {
      stopMusic()
    }
  }, [playMusic])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => setCooldown(sec))
  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  let bgStyle: CSSProperties = {
    backgroundImage: "url(/bg-salon.png)",
    backgroundSize: "cover",
    backgroundPosition: "center",
  }

  if (background?.type === "image") {
    bgStyle = { backgroundImage: `url(${background.value})`, backgroundSize: "cover", backgroundPosition: "center" }
  } else if (background?.type === "color") {
    bgStyle = { backgroundColor: background.value }
  }

  const isPlayer = player !== null

  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-hidden">
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0"
        style={{ ...bgStyle, opacity: backgroundOpacity ?? 0.5 }}
      />
      {elements && elements.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          <SlideCanvas elements={elements} onChange={noopChange} selectedId={undefined} onSelect={noopSelect} />
        </div>
      )}

      {audio && <audio ref={slideAudioRef} src={audio} autoPlay loop hidden />}

      <div className="relative z-10 px-4 pt-4">
        <div className="mx-auto max-w-7xl rounded-2xl bg-black/50 px-6 py-4 backdrop-blur-md">
          <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl">
            {question}
          </h2>
        </div>
      </div>

      <div className="relative mx-auto inline-flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5">
        <QuestionMedia 
          media={type === "drop_pin" && pinImage && !isPlayer ? { type: "image", url: pinImage } : media} 
          alt={question} 
        />
      </div>

      <div className={`relative${isPlayer ? " pb-12" : ""}`}>
        <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
          <div
            className={clsx(
              "flex flex-col items-center rounded-full px-4 text-lg font-bold transition-colors",
              cooldown <= 5 ? "bg-red-600 anim-pulse-urgent" : "bg-black/40",
            )}
          >
            <span className="translate-y-1 text-sm">{t("game:hud.time")}</span>
            <span key={cooldown} className="anim-pop-in tabular-nums">{cooldown}</span>
          </div>
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">{t("game:hud.answers")}</span>
            <span key={totalAnswer} className="anim-pop-in tabular-nums">{totalAnswer}/{totalPlayer}</span>
          </div>
        </div>

        {!isPlayer && type === "mcq" && answers && (
          <McqAnswers answers={answers} onAnswer={() => undefined} />
        )}
        {!isPlayer && type === "true_false" && (
          <TrueFalseAnswers />
        )}
        {!isPlayer && type === "open" && (
          <OpenAnswerPlaceholder />
        )}
        {isPlayer && !answered && type === "mcq" && answers && (
          <McqAnswers answers={answers} iconOnly onAnswer={(k) => emit({ answerId: k })} />
        )}
        {isPlayer && !answered && type === "true_false" && (
          <TrueFalseAnswers onAnswer={(k) => emit({ answerId: k })} />
        )}
        {isPlayer && !answered && type === "open" && (
          <OpenAnswer onTextAnswer={(text) => emit({ textAnswer: text })} />
        )}
        {isPlayer && !answered && type === "date" && (
          <DateAnswer minYear={minYear} maxYear={maxYear} onNumberAnswer={(n) => emit({ numberAnswer: n })} />
        )}
        {isPlayer && !answered && type === "slider" && (
          <SliderAnswer
            min={min ?? 0}
            max={max ?? 100}
            onNumberAnswer={(n) => emit({ numberAnswer: n })}
          />
        )}
        {isPlayer && !answered && type === "puzzle" && items && (
          <PuzzleAnswer items={items} onOrderAnswer={(order) => emit({ orderAnswer: order })} />
        )}
        {isPlayer && !answered && type === "drop_pin" && pinImage && (
          <DropPinAnswer pinImage={pinImage} onTextAnswer={(text) => emit({ textAnswer: text })} />
        )}

        {isPlayer && answered && (
          <div className="mx-auto mb-4 flex w-full max-w-7xl justify-center px-2">
            <div className="rounded-xl bg-black/40 px-6 py-3 text-lg font-bold text-white">
              {t("game:answerSent")}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Answers
