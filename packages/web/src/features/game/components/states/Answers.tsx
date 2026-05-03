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

import {
  DateAnswer,
  McqAnswers,
  OpenAnswer,
  OpenAnswerPlaceholder,
  SliderAnswer,
  TrueFalseAnswers,
} from "@rahoot/web/features/game/components/AnswersDisplay"

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

    const hasYoutube = elements?.some((el) => el.type === "youtube") ?? false

    if (disabledMusicMedia.includes(media?.type) || audio || hasYoutube) {
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
          <SlideCanvas elements={elements} onChange={noopChange} selectedId={undefined} onSelect={noopSelect} readOnly />
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
