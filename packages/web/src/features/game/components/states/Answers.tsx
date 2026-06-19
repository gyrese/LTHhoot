import { EVENTS, MEDIA_TYPES } from "@rahoot/common/constants"
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import type { QuestionMediaType, SlideElement } from "@rahoot/common/types/game"
import AudioEmbed from "@rahoot/web/features/game/components/AudioEmbed"
import SlideCanvas from "@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"
import {
  DateAnswer,
  McqAnswers,
  OpenAnswer,
  OpenAnswerPlaceholder,
  SliderAnswer,
  TrueFalseAnswers,
} from "@rahoot/web/features/game/components/AnswersDisplay"
import {
  DropPinAnswer,
  PuzzleAnswer,
} from "@rahoot/web/features/game/components/states/AnswerInputs"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"
import BackgroundRevealer from "@rahoot/web/features/game/components/BackgroundRevealer"



const noopChange = (_els: SlideElement[]) => undefined
const noopSelect = (_id: string | undefined) => undefined

type Props = {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

const Answers = ({
  data: {
    question,
    type,
    answers,
    media,
    background,
    backgroundOpacity,
    elements,
    audio,
    time,
    totalPlayer,
    min,
    max,
    minYear,
    maxYear,
    items,
    pinImage,
    isFrozen,
    isScrambled,
    revelationEnabled,
    revealDuration,
    gridCols,
    gridRows,
    revelationStyle,
  },
  // eslint-disable-next-line complexity
}: Props) => {
  const { socket } = useSocket()
  const { player, gameId } = usePlayerStore()
  const { cooldown: storeCooldown } = useQuestionStore()
  const [answered, setAnswered] = useState(false)

  const [endTime, setEndTime] = useState(() => {
    const initialCooldown = storeCooldown && storeCooldown > 0 ? storeCooldown : time
    return Date.now() + initialCooldown * 1000
  })
  const [cooldown, setCooldown] = useState(() => storeCooldown && storeCooldown > 0 ? storeCooldown : time)
  const [progress, setProgress] = useState(100)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const { t } = useTranslation()
  const slideAudioRef = useRef<HTMLAudioElement>(null)

  const [isFreezeBlocked, setIsFreezeBlocked] = useState(false)
  const [shuffledIndices, setShuffledIndices] = useState<number[] | undefined>(undefined)

  const { isHost } = useGameConfig()
  const isPlayer = !isHost

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (isFrozen && isPlayer) {
      setIsFreezeBlocked(true)
      timer = setTimeout(() => {
        setIsFreezeBlocked(false)
      }, 3000)
    } else {
      setIsFreezeBlocked(false)
    }

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [isFrozen, isPlayer, question])

  useEffect(() => {
    if (isScrambled && isPlayer) {
      let len = 0

      if (type === "mcq" && answers) {
        len = answers.length
      } else if (type === "true_false") {
        len = 2
      }

      if (len > 0) {
        const arr = Array.from({ length: len }, (_, i) => i)
        for (let i = arr.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1))
          const temp = arr[i]!
          arr[i] = arr[j]!
          arr[j] = temp
        }
        setShuffledIndices(arr)
      }
    } else {
      setShuffledIndices(undefined)
    }
  }, [isScrambled, isPlayer, question, type])

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
    if (!player || !gameId || answered || isFreezeBlocked) {
      return
    }

    socket?.emit(EVENTS.PLAYER.SELECTED_ANSWER, { gameId, data: payload })
    setAnswered(true)
  }

  useEffect(() => {
    const disabledMusicMedia = [
      MEDIA_TYPES.AUDIO,
      MEDIA_TYPES.VIDEO,
    ] as QuestionMediaType[]

    const hasYoutube = elements?.some((el) => el.type === "youtube") ?? false

    // Musique autoris├®e uniquement sur Host et si pas d'autre m├®dia audio/vid├®o
    if (!isHost || disabledMusicMedia.includes(media?.type) || audio || hasYoutube) {
      return
    }

    playMusic()

    // eslint-disable-next-line consistent-return
    return () => {
      stopMusic()
    }
  }, [playMusic, isHost])

  const audioCtxRef = useRef<AudioContext | null>(null)

  function playTick(urgent: boolean) {
    // Ticks sonores autorisés uniquement sur le Host
    if (!isHost) {
      return
    }

    try {
      audioCtxRef.current ||= new AudioContext()

      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = urgent ? 1100 : 880
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.start()
      osc.stop(ctx.currentTime + 0.08)
    } catch {
      // AudioContext non support├®
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const remainingMs = endTime - Date.now()
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))
      setCooldown(remainingSec)

      const pct = time > 0 ? Math.max(0, Math.min(100, (remainingMs / (time * 1000)) * 100)) : 0
      setProgress(pct)
    }, 50)

    return () => clearInterval(interval)
  }, [endTime, time])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    // Si dérive significative (> 1.2 seconde), on resynchronise la date de fin
    const currentRemainingMs = endTime - Date.now()
    const targetRemainingMs = sec * 1000
    if (Math.abs(currentRemainingMs - targetRemainingMs) > 1200) {
      setEndTime(Date.now() + targetRemainingMs)
    }

    if (isHost && sec <= 5 && sec > 0) {
      playTick(sec <= 3)
    }
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)

    if (isHost) {
      sfxPop()
    }
  })

  function getProgressColor(pct: number) {
    if (pct > 50) {
      return "#22c55e"
    }

    if (pct > 25) {
      return "#f59e0b"
    }

    return "#ef4444"
  }

  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-hidden">
      {background && background.value ? (
        <>
          <div className="absolute inset-0 bg-black" />
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundColor:
                background.type === "color" ? background.value : undefined,
              backgroundImage:
                background.type === "image"
                  ? `url(${background.value})`
                  : undefined,
              opacity: backgroundOpacity ?? (revelationEnabled ? 1.0 : 1),
            }}
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[#0f172a]" />
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(/bg-salon.png)`,
              opacity: backgroundOpacity ?? (revelationEnabled ? 1.0 : 0.5),
            }}
          />
        </>
      )}

      {revelationEnabled && (
        <BackgroundRevealer
          duration={revealDuration ?? time}
          gridCols={gridCols ?? 8}
          gridRows={gridRows ?? 6}
          seedString={question || background?.value}
          startTimeOffset={0}
          configuredStyle={revelationStyle}
        />
      )}

      {elements && elements.length > 0 && (
        <div className="pointer-events-none absolute inset-0">
          <SlideCanvas
            elements={elements}
            onChange={noopChange}
            selectedId={undefined}
            onSelect={noopSelect}
            readOnly
            noBackground
            hideYoutube
          />
        </div>
      )}

      {/* Barre de progression du temps */}
      <div className="absolute top-0 right-0 left-0 z-20 h-2 bg-white/10">
        <div
          className="h-full rounded-r-full transition-all duration-100 ease-linear"
          style={{
            width: `${progress}%`,
            backgroundColor: getProgressColor(progress),
          }}
        />
      </div>

      {audio && isHost && <AudioEmbed ref={slideAudioRef} audio={audio} />}

      {type !== "title" && (
        <div id="question-container" className="relative z-10 px-4 pt-4">
          <div className="mx-auto max-w-7xl rounded-2xl bg-black/50 px-6 py-4 backdrop-blur-md">
            <h2 className="anim-show text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl">
              {question}
            </h2>
          </div>
        </div>
      )}

      <div className="flex-1" />

      <div className={clsx("relative", isPlayer && "pb-12")}>
        <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
          <div
            className={clsx(
              "flex flex-col items-center rounded-full px-4 text-lg font-bold transition-colors",
              cooldown <= 5 ? "anim-pulse-urgent bg-red-600" : "bg-black/40",
            )}
          >
            <span className="translate-y-1 text-sm">{t("game:hud.time")}</span>
            <span
              id="timer"
              key={cooldown}
              className="anim-pop-in tabular-nums"
            >
              {cooldown}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">
              {t("game:hud.answers")}
            </span>
            <span key={totalAnswer} className="anim-pop-in tabular-nums">
              {totalAnswer}/{totalPlayer}
            </span>
          </div>
        </div>

        {!isPlayer && type === "mcq" && answers && (
          <McqAnswers answers={answers} onAnswer={() => undefined} />
        )}
        {!isPlayer && type === "true_false" && <TrueFalseAnswers />}
        {!isPlayer && type === "open" && <OpenAnswerPlaceholder />}
        {isPlayer && !answered && type === "mcq" && answers && (
          <McqAnswers
            key={question}
            answers={answers}
            iconOnly
            onAnswer={(k) => emit({ answerId: k })}
            shuffledIndices={shuffledIndices}
          />
        )}
        {isPlayer && !answered && type === "true_false" && (
          <TrueFalseAnswers
            key={question}
            onAnswer={(k) => emit({ answerId: k })}
            shuffledIndices={shuffledIndices}
          />
        )}
        {isPlayer && !answered && type === "open" && (
          <OpenAnswer
            key={question}
            onTextAnswer={(text) => emit({ textAnswer: text })}
          />
        )}
        {isPlayer && !answered && type === "date" && (
          <DateAnswer
            key={question}
            minYear={minYear}
            maxYear={maxYear}
            onNumberAnswer={(n) => emit({ numberAnswer: n })}
          />
        )}
        {isPlayer && !answered && type === "slider" && (
          <SliderAnswer
            key={question}
            min={min ?? 0}
            max={max ?? 100}
            onNumberAnswer={(n) => emit({ numberAnswer: n })}
          />
        )}
        {isPlayer && !answered && type === "puzzle" && items && (
          <PuzzleAnswer
            key={question}
            items={items}
            onOrderAnswer={(order) => emit({ orderAnswer: order })}
          />
        )}
        {isPlayer && !answered && type === "drop_pin" && pinImage && (
          <DropPinAnswer
            key={question}
            pinImage={pinImage}
            onTextAnswer={(text) => emit({ textAnswer: text })}
          />
        )}

        {isPlayer && answered && (
          <div className="mx-auto mb-4 flex w-full max-w-7xl justify-center px-2">
            <div className="rounded-xl bg-black/40 px-6 py-3 text-lg font-bold text-white">
              {t("game:answerSent")}
            </div>
          </div>
        )}
      </div>

      {isFreezeBlocked && isPlayer && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-blue-500/10 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/20 bg-blue-900/30 p-8 shadow-2xl backdrop-blur-2xl">
            <svg className="size-16 animate-pulse text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18m-3-6L6 18M6 6l12 12m-6-9l2-2m-2 2l-2-2m2 11l2 2m-2-2l-2 2m-5-5l-2-2m2 2l-2 2m14-2l2-2m-2 2l2 2" />
            </svg>
            <span className="text-2xl font-black uppercase tracking-wider text-blue-200">
              Gel├® !
            </span>
            <span className="text-sm font-semibold text-blue-100/70">
              Vos r├®ponses se d├®bloquent dans 3 secondes...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default Answers
