import { EVENTS } from "@rahoot/common/constants"
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import type { SlideElement } from "@rahoot/common/types/game"
import type { AnswerAckStatus } from "@rahoot/common/types/game/socket"
import { FREEZE_DURATION_MS } from "@rahoot/common/types/powerup"
import AudioEmbed from "@rahoot/web/features/game/components/AudioEmbed"
import SlideCanvas from "@rahoot/web/features/game/components/LazySlideCanvas"
import { QuestionLayoutOverlay } from "@rahoot/web/features/game/components/QuestionLayoutView"
import {
  fontFamilyCss,
  defaultAnswerBoxes,
  layoutAnswerLabels,
} from "@rahoot/web/features/game/utils/question-layout"
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
  GridAnswer,
  PuzzleAnswer,
} from "@rahoot/web/features/game/components/states/AnswerInputs"
import GridBoard from "@rahoot/web/features/game/components/GridBoard"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { useSoundStore } from "@rahoot/web/features/game/stores/sound"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import {
  HAPTIC_PATTERNS,
  vibrate,
} from "@rahoot/web/features/game/utils/haptics"
import { fadeUp, MOTION_SPRING } from "@rahoot/web/features/game/utils/motion"
import { ROUND_EVENT_META } from "@rahoot/web/features/game/utils/roundEventMeta"
import clsx from "clsx"
import { Check, Loader2, X } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"
import BackgroundRevealer from "@rahoot/web/features/game/components/BackgroundRevealer"
import ImageSequenceReveal from "@rahoot/web/features/game/components/states/ImageSequenceReveal"

const noopChange = (_els: SlideElement[]) => undefined
const noopSelect = (_id: string | undefined) => undefined

// Géométrie du timer circulaire de l'écran principal (viewBox 100×100).
const TIMER_RADIUS = 44
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS
// Secondes restantes annoncées aux lecteurs d'écran.
const ANNOUNCED_SECONDS = [10, 5]
// Délai minimal avant de rouvrir la saisie quand le serveur répond « frozen »
// alors que le gel local est déjà levé (horloges légèrement décalées).
const MIN_FREEZE_RETRY_MS = 300

// Messages affichés quand la saisie est rouverte après un envoi non comptabilisé.
const RETRY_MESSAGE_KEYS = {
  failed: "game:answerSendFailed",
  frozen: "game:answerFrozen",
  invalid: "game:answerInvalid",
} as const

const getRetryMessageKey = (state: string) =>
  Object.hasOwn(RETRY_MESSAGE_KEYS, state)
    ? RETRY_MESSAGE_KEYS[state as keyof typeof RETRY_MESSAGE_KEYS]
    : null

// Statuts d'ack qui clôturent la question côté client sans comptabiliser la
// réponse (trop tard, partie ou joueur introuvable).
const REJECTED_ACK_STATUSES = new Set<AnswerAckStatus>([
  "closed",
  "not_found",
  "no_player",
])

type Props = {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

const Answers = ({
  data: {
    question,
    type,
    answers,
    background,
    backgroundOpacity,
    elements,
    layout,
    fontFamily,
    audio,
    time,
    totalPlayer,
    min,
    max,
    minYear,
    maxYear,
    items,
    pinImage,
    cells,
    cellsPerRow,
    isFrozen,
    isScrambled,
    roundEvent,
    revelationEnabled,
    revealDuration,
    gridCols,
    gridRows,
    revelationStyle,
    images,
    imageInterval,
    endsAt,
    startedAt,
  },
  // eslint-disable-next-line complexity
}: Props) => {
  const { socket, getServerTime } = useSocket()
  const { player, gameId, hasAnswered } = usePlayerStore()
  const { cooldown: storeCooldown } = useQuestionStore()
  const [answered, setAnswered] = useState(() => hasAnswered)
  // Cycle visuel d'envoi piloté par l'ack serveur (cf. sendAnswer) : on
  // n'affiche « Réponse envoyée ! » qu'à la confirmation, pas à l'émission.
  //  - failed   : aucun ack après les retries → saisie rouverte
  //  - frozen   : refus serveur pendant le gel FREEZE → saisie rouverte après le gel
  //  - invalid  : payload refusé par la validation serveur → saisie rouverte
  //  - rejected : fenêtre fermée / partie ou joueur introuvable → saisie close
  const [sendState, setSendState] = useState<
    "idle" | "sending" | "sent" | "failed" | "frozen" | "invalid" | "rejected"
  >(() => (hasAnswered ? "sent" : "idle"))

  useEffect(() => {
    if (hasAnswered) {
      setAnswered(true)
      setSendState("sent")
    }
  }, [hasAnswered])

  const [endTime, setEndTime] = useState(() => {
    if (endsAt && endsAt > 0) {
      return endsAt
    }

    const initialCooldown =
      storeCooldown && storeCooldown > 0 ? storeCooldown : time

    return getServerTime() + initialCooldown * 1000
  })
  const [cooldown, setCooldown] = useState(() =>
    storeCooldown && storeCooldown > 0 ? storeCooldown : time,
  )
  const [progress, setProgress] = useState(100)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const { t } = useTranslation()
  const slideAudioRef = useRef<HTMLAudioElement>(null)

  const [isFreezeBlocked, setIsFreezeBlocked] = useState(false)
  const freezeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (freezeRetryTimerRef.current) {
        clearTimeout(freezeRetryTimerRef.current)
      }
    },
    [],
  )
  const [shuffledIndices, setShuffledIndices] = useState<number[] | undefined>(
    undefined,
  )

  const { isHost, isFreezeRound } = useGameConfig()
  const isPlayer = !isHost
  const muted = useSoundStore((state) => state.muted)
  const eventMeta = roundEvent ? ROUND_EVENT_META[roundEvent] : null

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (isFrozen && isPlayer) {
      setIsFreezeBlocked(true)
      timer = setTimeout(() => {
        setIsFreezeBlocked(false)
      }, FREEZE_DURATION_MS)
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

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
    soundEnabled: !muted,
  })

  // Musique d'ambiance de la phase de réponses, jouée sur l'écran principal
  // uniquement. Pas de musique par-dessus un son ou une vidéo propre à la
  // question, pour ne pas couvrir le média.
  const hasOwnMedia =
    Boolean(audio) || Boolean(elements?.some((el) => el.type === "youtube"))
  const [, { sound: musicSound }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    loop: true,
  })

  useEffect(() => {
    if (!musicSound || !isHost || hasOwnMedia || muted) {
      return undefined
    }

    musicSound.play()

    return () => {
      musicSound.stop()
    }
  }, [musicSound, isHost, hasOwnMedia, muted])

  // Envoi fiabilisé d'une réponse : accusé de réception serveur + retry borné.
  // L'ancien envoi était « fire-and-forget » + `setAnswered(true)` inconditionnel :
  // si le paquet ne partait pas (socket null, reconnexion en cours, perte réseau),
  // la réponse disparaissait silencieusement mais l'UI restait verrouillée sur
  // « répondu ». Désormais on ne verrouille que sur confirmation, et un échec
  // définitif rouvre la saisie avec une bannière d'erreur.
  const ANSWER_ACK_TIMEOUT = 4000
  const MAX_ANSWER_RETRIES = 2
  const sendingRef = useRef(false)

  const sendAnswer = (
    payload: {
      answerId?: number
      textAnswer?: string
      numberAnswer?: number
      orderAnswer?: number[]
    },
    attempt: number,
  ) => {
    if (!socket || !gameId) {
      return
    }

    socket
      .timeout(ANSWER_ACK_TIMEOUT)
      .emit(
        EVENTS.PLAYER.SELECTED_ANSWER,
        { gameId, data: payload },
        (err, res) => {
          if (err) {
            // Pas d'accusé reçu (réseau coupé ou serveur indisponible).
            if (attempt < MAX_ANSWER_RETRIES) {
              sendAnswer(payload, attempt + 1)

              return
            }

            // Échec définitif : on rouvre la saisie pour permettre un nouvel essai.
            sendingRef.current = false
            setAnswered(false)
            setSendState("failed")

            return
          }

          sendingRef.current = false
          handleAck(res?.status)
        },
      )
  }

  // Gel serveur encore actif : on rebloque la saisie jusqu'à la fin de la
  // fenêtre de gel (début de la manche + FREEZE_DURATION_MS, heure serveur).
  const blockUntilFreezeEnds = () => {
    const remaining =
      startedAt && startedAt > 0
        ? startedAt + FREEZE_DURATION_MS - getServerTime()
        : FREEZE_DURATION_MS
    const delay = Math.min(
      FREEZE_DURATION_MS,
      Math.max(MIN_FREEZE_RETRY_MS, remaining),
    )

    if (freezeRetryTimerRef.current) {
      clearTimeout(freezeRetryTimerRef.current)
    }

    setIsFreezeBlocked(true)
    freezeRetryTimerRef.current = setTimeout(() => {
      setIsFreezeBlocked(false)
      freezeRetryTimerRef.current = null
    }, delay)
  }

  // Accusé reçu : seuls ok / duplicate confirment la réponse. Les autres
  // statuts sont terminaux (plus de retry) mais ne doivent jamais afficher
  // « Réponse envoyée ».
  const handleAck = (status: AnswerAckStatus | undefined) => {
    if (status === "ok" || status === "duplicate") {
      setSendState("sent")
      vibrate(HAPTIC_PATTERNS.ANSWER_CONFIRMED)

      return
    }

    if (status === "frozen") {
      setAnswered(false)
      setSendState("frozen")
      blockUntilFreezeEnds()

      return
    }

    if (status && REJECTED_ACK_STATUSES.has(status)) {
      setSendState("rejected")

      return
    }

    // « invalid » (ou ack illisible) : on rouvre la saisie pour un nouvel essai.
    setAnswered(false)
    setSendState("invalid")
  }

  const retryMessageKey = getRetryMessageKey(sendState)

  const emit = (payload: {
    answerId?: number
    textAnswer?: string
    numberAnswer?: number
    orderAnswer?: number[]
  }) => {
    if (
      !player ||
      !gameId ||
      answered ||
      sendingRef.current ||
      isFreezeBlocked
    ) {
      return
    }

    vibrate(HAPTIC_PATTERNS.TAP)
    sendingRef.current = true
    setSendState("sending")
    // Verrouillage immédiat de la saisie ; rouvert (answered=false) si échec définitif.
    setAnswered(true)
    sendAnswer(payload, 0)
  }

  const audioCtxRef = useRef<AudioContext | null>(null)

  function playTick(urgent: boolean) {
    // Ticks sonores autorisés uniquement sur le Host, et jamais son coupé
    if (!isHost || muted) {
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
      // AudioContext non supporté
    }
  }

  // Durée de référence de la barre de progression. Elle suit `time` sauf si la
  // manche a été étendue pour couvrir un média plus long que le temps imparti.
  const [totalTime, setTotalTime] = useState(time)

  useEffect(() => {
    setTotalTime(time)
  }, [time])

  // Le serveur a rallongé la manche pour laisser la vidéo se terminer : on
  // recale la fin ET la référence de progression sur les nouvelles valeurs.
  useEvent(EVENTS.GAME.ROUND_EXTENDED, ({ time: extended, endsAt: newEnd }) => {
    setTotalTime((prev) => Math.max(prev, extended))
    setEndTime((prev) => Math.max(prev, newEnd))
  })

  // Toutes les comparaisons se font sur l'horloge serveur (`getServerTime`) :
  // `endTime` provient du serveur, le comparer à `Date.now()` faussait le
  // décompte sur un téléphone dont l'horloge est décalée.
  useEffect(() => {
    const interval = setInterval(() => {
      const remainingMs = endTime - getServerTime()
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))
      setCooldown(remainingSec)

      const pct =
        totalTime > 0
          ? Math.max(0, Math.min(100, (remainingMs / (totalTime * 1000)) * 100))
          : 0
      setProgress(pct)
    }, 50)

    return () => clearInterval(interval)
  }, [endTime, totalTime, getServerTime])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    // Si dérive significative (> 1.2 seconde), on resynchronise la date de fin
    const currentRemainingMs = endTime - getServerTime()
    const targetRemainingMs = sec * 1000

    if (Math.abs(currentRemainingMs - targetRemainingMs) > 1200) {
      setEndTime(getServerTime() + targetRemainingMs)
    }

    if (isHost && sec <= 5 && sec > 0) {
      playTick(sec <= 3)
    }
  })

  // Indicateur FREEZE sur le timer de l'écran principal, le temps du gel.
  const [freezeVisible, setFreezeVisible] = useState(false)

  useEffect(() => {
    if (!isHost || !isFreezeRound) {
      setFreezeVisible(false)

      return undefined
    }

    setFreezeVisible(true)
    const timer = setTimeout(() => setFreezeVisible(false), FREEZE_DURATION_MS)

    return () => clearTimeout(timer)
  }, [isHost, isFreezeRound, question])

  const [timeAnnouncement, setTimeAnnouncement] = useState("")

  useEffect(() => {
    if (ANNOUNCED_SECONDS.includes(cooldown)) {
      setTimeAnnouncement(t("game:a11y.timeLeft", { count: cooldown }))
    }
  }, [cooldown, t])

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)

    if (isHost) {
      sfxPop()
    }
  })

  // Mise en page libre et police : écran hôte uniquement (les téléphones des
  // joueurs gardent leur affichage habituel).
  const hostFont = isHost ? fontFamily : undefined
  const answerLabels = layoutAnswerLabels(type, answers, [
    t("game:false"),
    t("game:true"),
  ])
  // Sans mise en page personnalisée, les cases QCM / Vrai-Faux prennent les
  // boîtes par défaut de l'éditeur : mêmes proportions que dans l'éditeur,
  // quelle que soit la taille de l'écran (et non plus toute la largeur).
  const hostLayout = isHost
    ? {
        ...layout,
        answers:
          layout?.answers ??
          (answerLabels ? defaultAnswerBoxes(answerLabels.length) : undefined),
      }
    : undefined

  const hasTitleBox = Boolean(hostLayout?.title)
  const hasAnswerBoxes = Boolean(hostLayout?.answers && answerLabels)

  // Types dont les propositions occupent la zone centrale de l'écran hôte.
  const hostVisual =
    !isPlayer &&
    ((type === "drop_pin" && Boolean(pinImage)) ||
      (type === "grid" && Boolean(cells?.length)))

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
          imageUrl={background?.type === "image" ? background.value : undefined}
        />
      )}

      {elements && elements.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <SlideCanvas
            elements={elements}
            onChange={noopChange}
            selectedId={undefined}
            onSelect={noopSelect}
            readOnly
            noBackground
            hideYoutube={isPlayer}
          />
        </div>
      )}

      {/* Titre / réponses positionnés librement (mise en page de l'éditeur),
          dans le même repère 1920×1080 que les éléments. Sous le HUD : le
          chrono et le compteur restent toujours lisibles. */}
      {type !== "title" && (
        <QuestionLayoutOverlay
          layout={hostLayout}
          title={question}
          answerLabels={answerLabels}
          fontFamily={hostFont}
          animated
        />
      )}

      {type === "image_sequence" && images && images.length > 0 && (
        <ImageSequenceReveal
          images={images}
          imageInterval={imageInterval ?? 5}
        />
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

      {eventMeta && (
        <div className="relative z-10 flex justify-center px-4 pt-4">
          <div
            className={clsx(
              "flex items-center gap-2 rounded-full border px-4 py-1.5 backdrop-blur-md",
              eventMeta.accent,
              eventMeta.border,
            )}
          >
            <span className="text-base">{eventMeta.icon}</span>
            <span
              className={clsx(
                "text-sm font-black tracking-wide uppercase",
                eventMeta.text,
              )}
            >
              {t(eventMeta.labelKey)}
            </span>
          </div>
        </div>
      )}

      {type !== "title" && !hasTitleBox && (
        <div id="question-container" className="relative z-10 px-4 pt-4">
          <div className="mx-auto max-w-7xl rounded-2xl bg-black/50 px-6 py-4 backdrop-blur-md">
            <h2
              className="anim-show text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl"
              style={{ fontFamily: fontFamilyCss(hostFont) }}
            >
              {question}
            </h2>
          </div>
        </div>
      )}

      {/* Zone centrale de l'écran hôte : l'image cible de l'épingle ou la grille
          de propositions, qui doivent être lisibles au vidéoprojecteur. Les
          joueurs retrouvent la même grille, cliquable, dans le bloc du bas. */}
      {hostVisual ? (
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-4">
          {type === "drop_pin" ? (
            <img
              src={pinImage}
              alt={question}
              draggable={false}
              className="max-h-[74vh] w-auto max-w-7xl rounded-2xl object-contain shadow-2xl"
            />
          ) : (
            <GridBoard
              cells={cells!}
              cellsPerRow={cellsPerRow ?? 3}
              fitHeight="58vh"
              className="max-w-5xl"
            />
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Annonce discrète du temps restant pour les lecteurs d'écran : à 10 s
          et 5 s seulement, pas à chaque seconde. */}
      <p className="sr-only" role="status" aria-live="polite">
        {timeAnnouncement}
      </p>

      <div
        className="relative z-10"
        // Réserve la hauteur réelle de la barre joueur (safe-area incluse),
        // mesurée par GameWrapper : plus de boutons de réponse masqués.
        style={
          isPlayer ? { paddingBottom: "var(--player-bar-h, 5rem)" } : undefined
        }
      >
        {isHost ? (
          <div className="mx-auto mb-4 flex w-full max-w-7xl items-end justify-between gap-4 px-4 text-white">
            {/* Timer circulaire géant, lisible depuis le fond de la salle */}
            <div
              className={clsx(
                "relative flex size-24 shrink-0 items-center justify-center rounded-full border-4 bg-black/50 backdrop-blur-md transition-colors md:size-32",
                freezeVisible
                  ? "animate-pulse border-cyan-400"
                  : "border-white/10",
                cooldown <= 5 && "anim-pulse-urgent",
              )}
              aria-label={t("game:hud.time")}
            >
              <svg
                className="absolute inset-0 size-full -rotate-90"
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                <circle
                  cx="50"
                  cy="50"
                  r={TIMER_RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={TIMER_RADIUS}
                  fill="none"
                  stroke={getProgressColor(progress)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={TIMER_CIRCUMFERENCE}
                  strokeDashoffset={
                    TIMER_CIRCUMFERENCE * (1 - Math.max(0, progress) / 100)
                  }
                  className="transition-[stroke-dashoffset] duration-100 ease-linear"
                />
              </svg>
              <span
                id="timer"
                key={cooldown}
                className="anim-pop-in relative text-4xl font-black tabular-nums drop-shadow-lg md:text-5xl"
              >
                {cooldown}
              </span>
            </div>

            {/* Compteur de réponses */}
            <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-black/50 px-6 py-3 backdrop-blur-md md:px-8">
              <span className="text-sm font-bold tracking-widest text-white/70 uppercase md:text-base">
                {t("game:hud.answers")}
              </span>
              <span
                key={totalAnswer}
                className="anim-pop-in text-4xl font-black tabular-nums md:text-6xl"
              >
                {totalAnswer}
                <span className="text-2xl text-white/60 md:text-4xl">
                  /{totalPlayer}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
            <div
              className={clsx(
                "flex flex-col items-center rounded-full px-4 text-lg font-bold transition-colors",
                cooldown <= 5 ? "anim-pulse-urgent bg-red-600" : "bg-black/40",
              )}
            >
              <span className="translate-y-1 text-sm">
                {t("game:hud.time")}
              </span>
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
        )}

        {isPlayer && !answered && retryMessageKey && (
          <div className="mx-auto mb-3 w-full max-w-7xl px-2" role="alert">
            <div
              className={clsx(
                "rounded-xl border px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur-sm",
                sendState === "frozen"
                  ? "border-cyan-300/40 bg-cyan-600/30"
                  : "border-red-400/40 bg-red-600/30",
              )}
            >
              {t(retryMessageKey)}
            </div>
          </div>
        )}

        {/* Écran hôte : les cases arrivent l'une après l'autre (« glissé +
            rebond »). Purement visuel : chrono et téléphones déjà actifs.
            Cases positionnées librement : la grille habituelle reste en place
            mais invisible, pour que le HUD garde sa position au-dessus. */}
        {!isPlayer && answerLabels && (
          <div
            className={clsx(hasAnswerBoxes && "invisible")}
            aria-hidden={hasAnswerBoxes || undefined}
          >
            {type === "mcq" ? (
              <McqAnswers
                key={question}
                answers={answerLabels}
                onAnswer={() => undefined}
                fontFamily={hostFont}
                hostEntrance={!hasAnswerBoxes}
              />
            ) : (
              <TrueFalseAnswers
                key={question}
                fontFamily={hostFont}
                hostEntrance={!hasAnswerBoxes}
              />
            )}
          </div>
        )}
        {!isPlayer && type === "open" && <OpenAnswerPlaceholder />}
        {!isPlayer && type === "image_sequence" && <OpenAnswerPlaceholder />}
        {isPlayer && !answered && type === "mcq" && answers && (
          <McqAnswers
            key={question}
            answers={answers}
            iconOnly
            onAnswer={(k) => emit({ answerId: k })}
            shuffledIndices={shuffledIndices}
            answerBoxes={layout?.answers}
          />
        )}
        {isPlayer && !answered && type === "true_false" && (
          <TrueFalseAnswers
            key={question}
            onAnswer={(k) => emit({ answerId: k })}
            shuffledIndices={shuffledIndices}
            answerBoxes={layout?.answers}
          />
        )}
        {isPlayer && !answered && type === "open" && (
          <OpenAnswer
            key={question}
            onTextAnswer={(text) => emit({ textAnswer: text })}
          />
        )}
        {isPlayer && !answered && type === "image_sequence" && (
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
        {isPlayer && !answered && type === "grid" && cells && (
          <GridAnswer
            key={question}
            cells={cells}
            cellsPerRow={cellsPerRow ?? 3}
            onAnswer={(index) => emit({ answerId: index })}
          />
        )}

        {isPlayer && answered && (
          <div
            className="mx-auto mb-4 flex w-full max-w-7xl justify-center px-2"
            role="status"
            aria-live="polite"
          >
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-3 rounded-xl bg-black/40 px-6 py-3 text-lg font-bold text-white"
            >
              {sendState === "rejected" && (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-500">
                  <X
                    className="size-4 stroke-4 text-white"
                    aria-hidden="true"
                  />
                </span>
              )}
              {sendState === "sent" && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={MOTION_SPRING}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500"
                >
                  <Check className="size-4 stroke-4 text-white" />
                </motion.span>
              )}
              {sendState !== "sent" && sendState !== "rejected" && (
                <Loader2
                  className="size-5 shrink-0 animate-spin text-white/70"
                  aria-hidden="true"
                />
              )}
              {sendState === "sent" && t("game:answerSent")}
              {sendState === "rejected" && t("game:answerRejected")}
              {sendState !== "sent" &&
                sendState !== "rejected" &&
                t("game:answerSending")}
            </motion.div>
          </div>
        )}
      </div>

      {isFreezeBlocked && isPlayer && (
        <div className="animate-in fade-in pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center bg-blue-500/10 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/20 bg-blue-900/30 p-8 shadow-2xl backdrop-blur-2xl">
            <svg
              className="size-16 animate-pulse text-blue-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v18M3 12h18m-3-6L6 18M6 6l12 12m-6-9l2-2m-2 2l-2-2m2 11l2 2m-2-2l-2 2m-5-5l-2-2m2 2l-2 2m14-2l2-2m-2 2l2 2"
              />
            </svg>
            <span className="text-2xl font-black tracking-wider text-blue-200 uppercase">
              {t("game:freeze.title")}
            </span>
            <span className="text-sm font-semibold text-blue-100/70">
              {t("game:freeze.subtitle")}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default Answers
