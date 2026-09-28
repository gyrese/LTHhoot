import { EVENTS } from "@rahoot/common/constants"
import type {
  SoloAnswerPayload,
  SoloPublicQuestion,
  SoloPublicQuizz,
  SoloSolution,
  SoloSubmitResult,
} from "@rahoot/common/types/solo"
import { SOLO_DRAW_POOL_SIZE } from "@rahoot/common/utils/result-kind"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
import BackgroundRevealer from "@rahoot/web/features/game/components/BackgroundRevealer"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
import SlideCanvas from "@rahoot/web/features/game/components/LazySlideCanvas"
import AudioEmbed from "@rahoot/web/features/game/components/AudioEmbed"
import AnimatedPoints from "@rahoot/web/features/game/components/AnimatedPoints"
import NotARobotCheck from "@rahoot/web/features/game/components/solo/NotARobotCheck"
import SoloSharePanel from "@rahoot/web/features/game/components/solo/SoloSharePanel"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
  SFX,
} from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  User,
  XCircle,
} from "lucide-react"
import useScreenSize from "@rahoot/web/hooks/useScreenSize"
import React, { useEffect, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import Confetti from "react-confetti"
import toast from "react-hot-toast"
import useSound from "use-sound"

type Props = {
  quizzId: string
}

// Durée de l'écran de règles affiché avant la première question.
const RULES_SCREEN_SECONDS = 3

// Page publique : c'est la marque de la soirée qui s'affiche, pas celle de
// l'application (le logo LTNHoot reste sur les écrans hôte/joueur en partie).
// Servi depuis `public/` et non bundlé : le serveur lit le même fichier pour
// composer la vignette de partage des réseaux sociaux.
const logoImg = "/logo-aperoquiz.png"

const noopChange = () => undefined
const noopSelect = () => undefined

// Vert tant qu'il reste du temps, orange dans le dernier quart, rouge à la fin.
const progressColor = (progress: number): string => {
  if (progress > 50) {
    return "#22c55e"
  }

  if (progress > 25) {
    return "#f59e0b"
  }

  return "#ef4444"
}

// Valeur de départ du curseur (milieu de l'intervalle affiché).
const initialNumber = (question: SoloPublicQuestion | null): number => {
  if (question?.type === "slider") {
    return Math.round((question.min + question.max) / 2)
  }

  if (question?.type === "date") {
    const qMin = question.minYear ?? 0
    const qMax = question.maxYear ?? new Date().getFullYear()

    return Math.round((qMin + qMax) / 2)
  }

  return 0
}

// Fond sonore de la question (fichier ou YouTube), joué sur l'appareil du
// joueur : en solo il n'y a pas d'écran hôte pour le diffuser. La clé relance
// la lecture à chaque question.
const SoloQuestionAudio = ({
  active,
  question,
  questionIndex,
}: {
  active: boolean
  question: SoloPublicQuestion | null
  questionIndex: number
}) =>
  active && question?.audio ? (
    <AudioEmbed key={questionIndex} audio={question.audio} solo />
  ) : null

export const SoloQuizView: React.FC<Props> = ({ quizzId }) => {
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation()

  // Libellé d'une erreur serveur (clé i18n errors:*) pour la page publique ;
  // une clé inconnue retombe sur un message générique.
  const soloErrorMessage = (error: string) =>
    t(error, { defaultValue: t("game:solo.error") })
  const [quizz, setQuizz] = useState<SoloPublicQuizz | null>(null)
  const [step, setStep] = useState<"START" | "RULES" | "QUESTION" | "FINISHED">(
    "START",
  )
  // Décompte de l'écran de règles affiché entre le formulaire et la 1re question.
  const [rulesCountdown, setRulesCountdown] = useState(RULES_SCREEN_SECONDS)

  const [playerName, setPlayerName] = useState("")
  const [socialContact, setSocialContact] = useState("")
  // Anti-bot : case cochée + honeypot vide (vérifiés serveur) ; le délai de
  // jeu est désormais mesuré par le serveur lui-même.
  const [isHumanChecked, setIsHumanChecked] = useState(false)
  const [honeypot, setHoneypot] = useState("")

  // Session solo ouverte par le serveur (ASYNC_QUIZ.START) : les questions
  // sont servies une à une, sans solution, et corrigées côté serveur.
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [isStarting, setIsStarting] = useState(false)
  const [currentQuestion, setCurrentQuestion] =
    useState<SoloPublicQuestion | null>(null)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(
    null,
  )
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false)
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null)
  // Correction renvoyée par le serveur après la réponse.
  const [solution, setSolution] = useState<SoloSolution | null>(null)

  const [textInput, setTextInput] = useState("")
  const [numberInput, setNumberInput] = useState<number>(0)

  // Fin de la question en heure LOCALE : durée serveur (endsAt − servedAt)
  // appliquée à l'instant de réception, insensible au décalage d'horloge.
  const [questionEndTime, setQuestionEndTime] = useState<number>(0)
  const [questionDurationMs, setQuestionDurationMs] = useState<number>(20_000)
  const [timeLeft, setTimeLeft] = useState<number>(20)
  const [progress, setProgress] = useState(100)
  const [userPoints, setUserPoints] = useState(0)
  const [lastPointsAdded, setLastPointsAdded] = useState(0)
  // Verrou anti double-émission (réponse / question suivante en vol).
  const pendingRef = useRef(false)

  const [resultSummary, setResultSummary] = useState<SoloSubmitResult | null>(
    null,
  )

  // Dimensions réelles de la fenêtre : `react-confetti` prend 300×200 par
  // défaut et déborde du flux (barre de défilement) si on ne les lui donne pas.
  const { width: screenWidth, height: screenHeight } = useScreenSize()

  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })
  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, { volume: 0.2 })
  const [sfxCorrect] = useSound(SFX.RESULTS_SOUND, { volume: 0.4 })
  const [sfxWrong] = useSound(SFX.BOUMP_SOUND, { volume: 0.4 })

  const resetQuestionState = () => {
    setSelectedAnswer(null)
    setHasSubmittedAnswer(false)
    setIsCorrectAnswer(null)
    setSolution(null)
    setTextInput("")
    setLastPointsAdded(0)
  }

  const handlePlayAgain = () => {
    setStep("START")
    setSessionId(null)
    setCurrentQuestion(null)
    setCurrentQuestionIdx(0)
    resetQuestionState()
    setNumberInput(0)
    setUserPoints(0)
    setResultSummary(null)
    pendingRef.current = false
  }

  // Enchaînement automatique vers la question suivante après 2.2 secondes (animation fluide sans clic)
  useEffect(() => {
    if (
      !hasSubmittedAnswer ||
      isCorrectAnswer === null ||
      step !== "QUESTION"
    ) {
      return undefined
    }

    const timer = setTimeout(() => {
      handleNextQuestion()
    }, 2200)

    return () => clearTimeout(timer)
  }, [hasSubmittedAnswer, isCorrectAnswer, step, currentQuestionIdx])

  // Décompte de l'écran de règles → démarrage automatique du quiz
  useEffect(() => {
    if (step !== "RULES") {
      return undefined
    }

    if (rulesCountdown <= 0) {
      requestNextQuestion()

      return undefined
    }

    const timer = setTimeout(() => setRulesCountdown((n) => n - 1), 1000)

    return () => clearTimeout(timer)
  }, [step, rulesCountdown])

  // Événements socket
  useEvent(EVENTS.ASYNC_QUIZ.DATA, (data) => {
    setQuizz(data)
    setTotalQuestions(data.totalQuestions)
  })

  useEffect(() => {
    if (isConnected && socket && quizzId) {
      socket.emit(EVENTS.ASYNC_QUIZ.GET_PUBLIC, quizzId)
    }
  }, [isConnected, socket, quizzId])

  // Timer question
  useEffect(() => {
    if (step !== "QUESTION" || hasSubmittedAnswer || !currentQuestion) {
      return undefined
    }

    const interval = setInterval(() => {
      const remainingMs = questionEndTime - Date.now()
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))
      setTimeLeft(remainingSec)

      const pct = Math.max(
        0,
        Math.min(100, (remainingMs / questionDurationMs) * 100),
      )
      setProgress(pct)

      if (remainingMs <= 0) {
        clearInterval(interval)
        handleTimeOut()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [step, currentQuestionIdx, hasSubmittedAnswer, questionEndTime])

  // État d'un bouton après correction : vrai = bonne réponse, faux = le
  // mauvais choix du joueur, indéfini = neutre (avant réponse, ou proposition
  // non choisie).
  const isSolutionIndex = (index: number) =>
    Boolean(solution?.solutions?.includes(index))

  const answerState = (index: number): boolean | undefined => {
    if (!hasSubmittedAnswer || !solution) {
      return undefined
    }

    if (isSolutionIndex(index)) {
      return true
    }

    return selectedAnswer === index ? false : undefined
  }

  // Envoi de la réponse : la correction (juste/faux, points, solution) est
  // calculée et renvoyée par le serveur. Une réponse vide = temps écoulé.
  const submitAnswer = (payload: SoloAnswerPayload) => {
    if (!socket || !sessionId || hasSubmittedAnswer || pendingRef.current) {
      return
    }

    pendingRef.current = true
    setHasSubmittedAnswer(true)

    socket.emit(
      EVENTS.ASYNC_QUIZ.ANSWER,
      { sessionId, questionIndex: currentQuestionIdx, ...payload },
      (res) => {
        pendingRef.current = false

        if (!res.ok) {
          toast.error(soloErrorMessage(res.error))
          setIsCorrectAnswer(false)

          return
        }

        setSolution(res.solution)
        setIsCorrectAnswer(res.correct)
        setLastPointsAdded(res.points)
        setUserPoints(res.totalPoints)

        if (res.correct) {
          sfxCorrect()
        } else {
          sfxWrong()
        }
      },
    )
  }

  const handleTimeOut = () => {
    if (hasSubmittedAnswer) {
      return
    }

    submitAnswer({})
  }

  // Finalisation : le score enregistré est celui calculé par le serveur.
  const submitSession = (id: string) => {
    socket?.emit(EVENTS.ASYNC_QUIZ.SUBMIT, { sessionId: id }, (res) => {
      if (!res.ok) {
        toast.error(soloErrorMessage(res.error))
        handlePlayAgain()

        return
      }

      setResultSummary({
        totalPoints: res.totalPoints,
        rank: res.rank,
        totalPlayers: res.totalPlayers,
        correctAnswersCount: res.correctAnswersCount,
        totalQuestions: res.totalQuestions,
      })
      setStep("FINISHED")
    })
  }

  // Question suivante (ou fin de partie), servie et horodatée par le serveur.
  const requestNextQuestion = (id = sessionId) => {
    if (!socket || !id || pendingRef.current) {
      return
    }

    pendingRef.current = true

    socket.emit(EVENTS.ASYNC_QUIZ.NEXT, { sessionId: id }, (res) => {
      pendingRef.current = false

      if (!res.ok) {
        toast.error(soloErrorMessage(res.error))

        return
      }

      if (res.done) {
        submitSession(id)

        return
      }

      const durationMs = Math.max(1000, res.endsAt - res.servedAt)

      resetQuestionState()
      setStep("QUESTION")
      setCurrentQuestion(res.question)
      setCurrentQuestionIdx(res.questionIndex)
      setTotalQuestions(res.totalQuestions)
      setNumberInput(initialNumber(res.question))
      setQuestionDurationMs(durationMs)
      setQuestionEndTime(Date.now() + durationMs)
      setTimeLeft(Math.ceil(durationMs / 1000))
      setProgress(100)
      sfxShow()
    })
  }

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault()

    if (!playerName.trim()) {
      toast.error(t("game:solo.enterPseudo"))

      return
    }

    if (!isHumanChecked) {
      toast.error(t("game:solo.confirmHuman"))

      return
    }

    if (!socket || !quizz || isStarting) {
      return
    }

    setIsStarting(true)

    socket.emit(
      EVENTS.ASYNC_QUIZ.START,
      {
        quizzId: quizz.id,
        playerName: playerName.trim(),
        socialContact: socialContact.trim() || undefined,
        human: { hp: honeypot },
      },
      (res) => {
        setIsStarting(false)

        if (!res.ok) {
          toast.error(soloErrorMessage(res.error))

          return
        }

        setSessionId(res.sessionId)
        setTotalQuestions(res.totalQuestions)
        setUserPoints(0)

        if (quizz.description?.trim()) {
          setRulesCountdown(RULES_SCREEN_SECONDS)
          setStep("RULES")

          return
        }

        requestNextQuestion(res.sessionId)
      },
    )
  }

  const handleAnswerSelect = (ansIdx: number) => {
    if (hasSubmittedAnswer || !currentQuestion) {
      return
    }

    sfxPop()
    setSelectedAnswer(ansIdx)
    submitAnswer({ answerId: ansIdx })
  }

  const handleNumberSubmit = (val: number) => {
    if (hasSubmittedAnswer || !currentQuestion) {
      return
    }

    sfxPop()
    setSelectedAnswer(val)
    submitAnswer({ numberAnswer: val })
  }

  const handleOpenTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (hasSubmittedAnswer || !currentQuestion || !textInput.trim()) {
      return
    }

    sfxPop()
    setSelectedAnswer(textInput)
    submitAnswer({ textAnswer: textInput })
  }

  const handleNextQuestion = () => {
    if (!hasSubmittedAnswer || isCorrectAnswer === null) {
      return
    }

    setLastPointsAdded(0)
    requestNextQuestion()
  }

  if (!quizz) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-lg font-medium text-gray-400">
            {t("game:solo.loading")}
          </p>
        </div>
      </div>
    )
  }

  // Calcul du fond d'écran selon l'étape du quiz (couverture du quiz sur l'écran d'accueil)
  const coverImage = quizz.salonImage || quizz.listingImage

  let bgStyle: React.CSSProperties = {}
  let bgOpacity = 0.6
  let bgImageForRevealer = ""

  if (step === "START" || step === "RULES" || step === "FINISHED") {
    if (coverImage) {
      bgStyle = {
        backgroundImage: `url(${coverImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
      bgOpacity = 0.7
    } else {
      bgStyle = {
        backgroundImage: `url(/bg-salon.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
      bgOpacity = 0.5
    }
  } else {
    // Étape QUESTION : fond spécifique de la slide/question
    const bg = currentQuestion?.background
    bgOpacity = currentQuestion?.backgroundOpacity ?? 0.6

    if (bg?.type === "image" && bg.value) {
      bgStyle = {
        backgroundImage: `url(${bg.value})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
      bgImageForRevealer = bg.value
    } else if (bg?.type === "color" && bg.value) {
      bgStyle = { backgroundColor: bg.value }
    } else if (coverImage) {
      bgStyle = {
        backgroundImage: `url(${coverImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
      bgImageForRevealer = coverImage
    } else {
      bgStyle = {
        backgroundImage: `url(/bg-salon.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    }
  }

  return (
    <div className="relative flex h-screen w-screen flex-col justify-between overflow-hidden bg-slate-950 text-white select-none">
      {/* Dynamic Background Image */}
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{ ...bgStyle, opacity: bgOpacity }}
      />

      {/* Révélation d'image si activée */}
      {step === "QUESTION" && currentQuestion?.revelationEnabled && (
        <BackgroundRevealer
          duration={currentQuestion.revealDuration ?? currentQuestion.time}
          gridCols={currentQuestion.gridCols ?? 8}
          gridRows={currentQuestion.gridRows ?? 6}
          seedString={currentQuestion.question || bgImageForRevealer}
          startTimeOffset={0}
          configuredStyle={currentQuestion.revelationStyle}
          imageUrl={bgImageForRevealer}
        />
      )}

      {/* Slide Canvas Elements (si le quiz contient des formes/textes personnalisés) */}
      {step === "QUESTION" &&
        currentQuestion?.elements &&
        currentQuestion.elements.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-10">
            <SlideCanvas
              elements={currentQuestion.elements}
              onChange={noopChange}
              selectedId={undefined}
              onSelect={noopSelect}
              readOnly
              noBackground
              hideYoutube={false}
            />
          </div>
        )}

      <SoloQuestionAudio
        active={step === "QUESTION"}
        question={currentQuestion}
        questionIndex={currentQuestionIdx}
      />

      {/* ── SCREEN 1: START ── */}
      {step === "START" && (
        <div className="relative z-20 flex flex-1 items-center justify-center p-4">
          <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-white/20 bg-black/40 p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-8">
            <img
              src={logoImg}
              alt="L'Apéro Quiz"
              className="mb-2 h-28 w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-transform duration-300 hover:scale-105 sm:h-32"
            />

            {/* Title in Crystal Glass 3D Encart */}
            <div className="relative my-4 w-full overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-b from-white/20 via-white/10 to-white/5 px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.7),inset_0_-1px_1px_rgba(255,255,255,0.1)] backdrop-blur-md">
              {/* Glass sheen highlight line */}
              <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

              <h1 className="text-center text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-3xl">
                {quizz.subject}
              </h1>
            </div>

            <form
              onSubmit={handleStart}
              className="mt-1 w-full space-y-4 text-left"
            >
              <div>
                <label className="mb-1.5 block text-xs font-extrabold tracking-wider text-gray-200 uppercase">
                  {t("game:solo.pseudoLabel")}
                </label>
                <div className="relative">
                  <User className="absolute top-3.5 left-3.5 size-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder={t("game:solo.pseudoPlaceholder")}
                    maxLength={30}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-black/40 py-3.5 pr-4 pl-11 font-semibold text-white placeholder-gray-400 shadow-inner backdrop-blur-md transition-all focus:border-orange-500 focus:bg-black/60 focus:ring-2 focus:ring-orange-500/40 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-extrabold tracking-wider text-gray-200 uppercase">
                  {t("game:solo.contactLabel")}
                </label>
                <div className="relative">
                  <AtSign className="absolute top-3.5 left-3.5 size-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t("game:solo.contactPlaceholder")}
                    maxLength={100}
                    value={socialContact}
                    onChange={(e) => setSocialContact(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-black/40 py-3.5 pr-4 pl-11 text-sm font-semibold text-white placeholder-gray-400 shadow-inner backdrop-blur-md transition-all focus:border-orange-500 focus:bg-black/60 focus:ring-2 focus:ring-orange-500/40 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-left text-[11px] font-medium text-gray-300">
                  {t("game:solo.contactHint")}
                </p>
              </div>

              <NotARobotCheck
                checked={isHumanChecked}
                onChange={setIsHumanChecked}
                honeypot={honeypot}
                onHoneypotChange={setHoneypot}
              />

              <button
                type="submit"
                disabled={!isHumanChecked || isStarting}
                className="group relative mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-orange-400/30 bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-base font-extrabold text-white shadow-[0_10px_25px_rgba(249,115,22,0.4)] transition-all hover:from-orange-400 hover:to-amber-400 hover:shadow-[0_12px_30px_rgba(249,115,22,0.6)] active:scale-[0.99] disabled:cursor-not-allowed disabled:border-white/10 disabled:from-slate-700 disabled:to-slate-700 disabled:text-gray-400 disabled:shadow-none disabled:active:scale-100"
              >
                <span>{t("game:solo.start")}</span>
                <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── SCREEN 1bis: RÈGLES (3 s) ── */}
      {step === "RULES" && (
        <div className="relative z-20 flex flex-1 items-center justify-center p-4">
          <div className="animate-in fade-in zoom-in flex w-full max-w-md flex-col items-center rounded-3xl border border-white/15 bg-black/70 p-6 text-center shadow-2xl backdrop-blur-xl duration-300 sm:p-8">
            <img
              src={logoImg}
              alt="L'Apéro Quiz"
              className="mb-3 h-20 w-auto object-contain drop-shadow-[0_10px_20px_rgba(249,115,22,0.4)] sm:h-24"
            />

            <span className="mb-3 rounded-full border border-orange-500/30 bg-orange-500/20 px-3 py-1 text-xs font-bold tracking-widest text-orange-300 uppercase">
              {t("game:solo.rulesTitle")}
            </span>

            <p className="text-base leading-relaxed font-medium whitespace-pre-line text-white">
              {quizz.description}
            </p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="flex size-14 items-center justify-center rounded-full border-2 border-orange-500 text-2xl font-black text-orange-400">
                {rulesCountdown}
              </span>
              <span className="text-xs text-gray-400">
                {t("game:solo.startingSoon")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN 2: QUESTION ── */}
      {step === "QUESTION" && currentQuestion && (
        <>
          {/* Top Progress Bar */}
          <div className="absolute top-0 right-0 left-0 z-30 h-2 bg-white/10">
            <div
              className="h-full rounded-r-full transition-all duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                backgroundColor: progressColor(progress),
              }}
            />
          </div>

          {/* Question Header Card */}
          <div className="relative z-20 px-4 pt-6">
            <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-black/60 px-6 py-5 text-center shadow-2xl backdrop-blur-md">
              <h2 className="text-xl font-extrabold text-white drop-shadow-md sm:text-2xl md:text-3xl">
                {currentQuestion.question}
              </h2>
            </div>
          </div>

          {/* Question Media (Image / Video) */}
          <div className="relative z-20 flex flex-1 items-center justify-center p-4">
            {currentQuestion.media && (
              <QuestionMedia
                media={currentQuestion.media}
                alt={currentQuestion.question}
              />
            )}
          </div>

          {/* Answer Area (MCQ / TrueFalse / Open) */}
          <div className="relative z-20 mx-auto w-full max-w-7xl px-4 pb-4">
            {/* MCQ / QCM Questions */}
            {currentQuestion.type === "mcq" && (
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentQuestion.answers.map((ans, idx) => {
                  const Icon = ANSWERS_ICONS[idx % 4]
                  const colorClass = ANSWERS_COLORS[idx % 4]
                  const isSelected = selectedAnswer === idx
                  const isCorrect = isSolutionIndex(idx)

                  const btnState = answerState(idx)

                  return (
                    <AnswerButton
                      key={idx}
                      index={idx}
                      icon={Icon}
                      correct={btnState}
                      disabled={hasSubmittedAnswer}
                      onClick={() => handleAnswerSelect(idx)}
                      className={clsx(
                        colorClass,
                        "min-h-20 cursor-pointer text-lg font-bold text-white shadow-xl sm:min-h-24",
                        hasSubmittedAnswer &&
                          isCorrect &&
                          "bg-green-600 ring-4 ring-green-400",
                        hasSubmittedAnswer &&
                          isSelected &&
                          !isCorrect &&
                          "opacity-50 grayscale",
                      )}
                    >
                      {ans}
                    </AnswerButton>
                  )
                })}
              </div>
            )}

            {/* True / False Questions */}
            {currentQuestion.type === "true_false" && (
              <div className="mb-3 grid grid-cols-2 gap-4">
                <AnswerButton
                  index={0}
                  icon={ANSWERS_ICONS[0]}
                  disabled={hasSubmittedAnswer}
                  onClick={() => handleAnswerSelect(0)}
                  correct={answerState(0)}
                  className="min-h-24 cursor-pointer bg-red-600 text-xl font-black text-white shadow-xl"
                >
                  {t("game:false")}
                </AnswerButton>

                <AnswerButton
                  index={1}
                  icon={ANSWERS_ICONS[1]}
                  disabled={hasSubmittedAnswer}
                  onClick={() => handleAnswerSelect(1)}
                  correct={answerState(1)}
                  className="min-h-24 cursor-pointer bg-blue-600 text-xl font-black text-white shadow-xl"
                >
                  {t("game:true")}
                </AnswerButton>
              </div>
            )}

            {/* Séquence d'images : les images défilent, réponse libre */}
            {currentQuestion.type === "image_sequence" && (
              <div className="mx-auto mb-3 flex max-w-2xl gap-2 overflow-x-auto">
                {currentQuestion.images.map((image) => (
                  <img
                    key={image}
                    src={image}
                    alt=""
                    className="h-24 w-auto rounded-xl object-cover"
                  />
                ))}
              </div>
            )}

            {/* Grille : le joueur tape la case qu'il pense juste */}
            {currentQuestion.type === "grid" && (
              <div
                className="mx-auto mb-3 grid max-w-2xl gap-2"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, currentQuestion.cellsPerRow)}, minmax(0, 1fr))`,
                }}
              >
                {currentQuestion.cells.map((cell, idx) => (
                  <button
                    key={`${cell.image}-${idx}`}
                    type="button"
                    disabled={hasSubmittedAnswer}
                    onClick={() => handleAnswerSelect(idx)}
                    className={clsx(
                      "relative min-h-[44px] cursor-pointer overflow-hidden rounded-xl border-2 border-white/20 bg-black/40",
                      answerState(idx) === true && "ring-4 ring-green-400",
                      answerState(idx) === false && "opacity-50 grayscale",
                    )}
                  >
                    <img
                      src={cell.image}
                      alt={cell.label ?? ""}
                      className="aspect-square w-full object-cover"
                    />
                    {cell.label && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 text-xs font-bold">
                        {cell.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Open Question */}
            {(currentQuestion.type === "open" ||
              currentQuestion.type === "image_sequence") && (
              <form
                onSubmit={handleOpenTextSubmit}
                className="mx-auto mb-3 flex max-w-2xl gap-2"
              >
                <input
                  type="text"
                  disabled={hasSubmittedAnswer}
                  placeholder={t("game:solo.answerPlaceholder")}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 rounded-2xl border border-white/20 bg-black/70 px-5 py-4 text-lg font-bold text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={hasSubmittedAnswer || !textInput.trim()}
                  className="flex cursor-pointer items-center gap-2 rounded-2xl bg-orange-500 px-6 py-4 text-lg font-extrabold text-white shadow-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  <span>{t("game:solo.submit")}</span>
                  <Send className="size-5" />
                </button>
              </form>
            )}
            {(currentQuestion.type === "open" ||
              currentQuestion.type === "image_sequence") &&
              hasSubmittedAnswer &&
              isCorrectAnswer === false &&
              solution?.correctAnswers && (
                <div className="mx-auto mb-3 max-w-2xl rounded-xl border border-white/10 bg-black/60 p-2.5 text-center text-xs font-semibold text-emerald-400 sm:text-sm">
                  {t("game:solo.expectedAnswerLabel")}{" "}
                  <strong>
                    {solution.correctAnswers.join(` ${t("game:solo.or")} `)}
                  </strong>
                </div>
              )}

            {/* Slider / Curseur & Date Questions */}
            {(currentQuestion.type === "slider" ||
              currentQuestion.type === "date") &&
              (() => {
                const isSlider = currentQuestion.type === "slider"
                const min = isSlider
                  ? currentQuestion.min
                  : (currentQuestion.minYear ?? 0)
                const max = isSlider
                  ? currentQuestion.max
                  : (currentQuestion.maxYear ?? new Date().getFullYear())
                // Cible connue seulement après correction (renvoyée par le serveur).
                const target = isSlider
                  ? solution?.correctValue
                  : solution?.correctYear
                const tol = currentQuestion.tolerance ?? 0

                return (
                  <div className="mx-auto mb-3 w-full max-w-2xl rounded-3xl border border-white/20 bg-black/70 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-black tracking-wider text-orange-400 uppercase">
                        {isSlider ? t("game:solo.slider") : t("game:solo.year")}
                      </span>
                      {tol > 0 && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-300">
                          {t("game:solo.tolerance", { value: tol })}
                        </span>
                      )}
                    </div>

                    {/* Valeur courante affichée en grand */}
                    <div className="mb-4 flex flex-col items-center justify-center">
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-5xl font-black tracking-tight text-amber-400 tabular-nums drop-shadow-[0_4px_12px_rgba(251,191,36,0.35)] sm:text-6xl">
                          {numberInput}
                        </span>
                      </div>
                    </div>

                    {/* Contrôles du curseur (- / slider / +) */}
                    <div className="mb-5 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={hasSubmittedAnswer || numberInput <= min}
                        onClick={() =>
                          setNumberInput((prev) => Math.max(min, prev - 1))
                        }
                        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl font-black text-white shadow-md transition-all hover:bg-white/20 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                        aria-label={t("game:solo.decrease")}
                      >
                        <Minus className="size-5" />
                      </button>

                      <div className="relative flex-1">
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={1}
                          value={numberInput}
                          disabled={hasSubmittedAnswer}
                          onChange={(e) =>
                            setNumberInput(parseInt(e.target.value, 10) || 0)
                          }
                          className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-orange-500 shadow-inner disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <div className="mt-1.5 flex justify-between px-1 text-xs font-bold text-gray-400">
                          <span>{min}</span>
                          <span>{max}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={hasSubmittedAnswer || numberInput >= max}
                        onClick={() =>
                          setNumberInput((prev) => Math.min(max, prev + 1))
                        }
                        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl font-black text-white shadow-md transition-all hover:bg-white/20 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                        aria-label={t("game:solo.increase")}
                      >
                        <Plus className="size-5" />
                      </button>
                    </div>

                    {/* Révélation après correction ou Bouton Valider avant */}
                    {hasSubmittedAnswer ? (
                      solution && (
                        <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-black/60 p-3.5 text-center backdrop-blur-md">
                          {isCorrectAnswer ? (
                            <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-400 sm:text-base">
                              <CheckCircle2 className="size-5" />
                              <span>
                                {target === numberInput
                                  ? t("game:solo.exactValue", { value: target })
                                  : t("game:solo.inTarget", {
                                      value: target,
                                      tolerance: tol,
                                    })}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 text-xs sm:text-sm">
                              {selectedAnswer !== null && (
                                <span className="font-bold text-rose-400">
                                  {t("game:solo.yourChoice", {
                                    value: selectedAnswer,
                                  })}
                                </span>
                              )}
                              <span className="font-extrabold text-emerald-400">
                                {t("game:solo.expectedValue", {
                                  value: target,
                                })}{" "}
                                {tol > 0 &&
                                  `(${t("game:solo.tolerance", { value: tol })})`}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleNumberSubmit(numberInput)}
                        className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-orange-400/30 bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-base font-extrabold text-white shadow-[0_10px_25px_rgba(249,115,22,0.4)] transition-all hover:from-orange-400 hover:to-amber-400 hover:shadow-[0_12px_30px_rgba(249,115,22,0.6)] active:scale-[0.99]"
                      >
                        <span>{t("game:solo.submitAnswer")}</span>
                        <Send className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
                      </button>
                    )}
                  </div>
                )
              })()}

            {/* Types sans saisie solo pour l'instant : le temps s'écoule */}
            {(currentQuestion.type === "puzzle" ||
              currentQuestion.type === "drop_pin") &&
              !hasSubmittedAnswer && (
                <div className="mx-auto mb-3 max-w-2xl rounded-xl border border-white/10 bg-black/60 p-3 text-center text-sm font-semibold text-gray-300">
                  {t("game:solo.notPlayable")}
                  <button
                    type="button"
                    onClick={() => submitAnswer({})}
                    className="ml-3 min-h-[44px] cursor-pointer rounded-xl bg-white/10 px-4 font-bold text-white hover:bg-white/20"
                  >
                    {t("game:solo.skip")}
                  </button>
                </div>
              )}

            {/* HUD Footer (Timer, Score, Next Button, App Logo) */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/60 px-6 py-3 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <img
                  src={logoImg}
                  alt="L'Apéro Quiz"
                  className="h-10 w-auto shrink-0 object-contain drop-shadow sm:h-12"
                />
                <span className="rounded-full border border-orange-500/30 bg-orange-500/20 px-3 py-1 text-xs font-bold tracking-widest text-orange-400 uppercase">
                  {t("game:solo.questionCounter", {
                    current: currentQuestionIdx + 1,
                    total: totalQuestions,
                  })}
                </span>
                <span className="text-sm font-black text-amber-400">
                  <AnimatedPoints
                    from={userPoints - lastPointsAdded}
                    to={userPoints}
                  />{" "}
                  pts
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3.5 py-1.5">
                  <Clock className="size-4 text-amber-400" />
                  <span
                    className={clsx(
                      "text-sm font-extrabold tabular-nums",
                      timeLeft <= 5
                        ? "animate-pulse text-red-400"
                        : "text-white",
                    )}
                  >
                    {timeLeft}s
                  </span>
                </div>

                {hasSubmittedAnswer && isCorrectAnswer !== null && (
                  <button
                    onClick={handleNextQuestion}
                    className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/30 transition-all hover:from-orange-600 hover:to-amber-600"
                  >
                    <span>
                      {currentQuestionIdx + 1 < totalQuestions
                        ? t("game:solo.next")
                        : t("game:solo.finish")}
                    </span>
                    <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bannière d'animation de feedback (Non-bloquante, fluide & automatique) */}
          {hasSubmittedAnswer && isCorrectAnswer !== null && (
            <div
              onClick={handleNextQuestion}
              className="animate-in slide-in-from-top-6 fade-in absolute top-6 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 cursor-pointer px-4 duration-300"
            >
              <div
                className={clsx(
                  "flex scale-100 items-center justify-between gap-4 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all hover:scale-[1.02] sm:p-5",
                  isCorrectAnswer
                    ? "border-emerald-500/60 bg-slate-950/90 shadow-emerald-500/30"
                    : "border-rose-500/60 bg-slate-950/90 shadow-rose-500/30",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      "flex size-11 shrink-0 animate-bounce items-center justify-center rounded-xl shadow-lg sm:size-12",
                      isCorrectAnswer
                        ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/40"
                        : "bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-500/40",
                    )}
                  >
                    {isCorrectAnswer ? (
                      <CheckCircle2 className="size-7 stroke-[2.5]" />
                    ) : (
                      <XCircle className="size-7 stroke-[2.5]" />
                    )}
                  </div>

                  <div className="text-left">
                    <h4
                      className={clsx(
                        "text-base leading-tight font-extrabold sm:text-lg",
                        isCorrectAnswer ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {isCorrectAnswer
                        ? t("game:solo.correct")
                        : t("game:solo.wrong")}
                    </h4>
                    <p className="text-xs font-medium text-gray-300">
                      {isCorrectAnswer
                        ? t("game:solo.autoNext")
                        : t("game:solo.nextSoon")}
                    </p>
                  </div>
                </div>

                {isCorrectAnswer && lastPointsAdded > 0 && (
                  <div className="flex shrink-0 animate-pulse items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-1.5">
                    <Sparkles className="size-4 text-amber-300" />
                    <span className="text-sm font-black text-amber-300 sm:text-base">
                      +{lastPointsAdded.toLocaleString()} PTS
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SCREEN 3: FINISHED ── */}
      {step === "FINISHED" && resultSummary && (
        <>
          <Confetti
            width={screenWidth}
            height={screenHeight}
            className="pointer-events-none"
            recycle={false}
            numberOfPieces={350}
          />
          {/* `items-center` centre tant que la carte tient, `my-auto` sur
              l'enfant prend le relais quand elle dépasse : sans lui, un
              conteneur défilant centré rogne le haut de la carte et le rend
              inatteignable au scroll. */}
          <div className="relative z-20 flex min-h-0 flex-1 justify-center overflow-y-auto overscroll-contain p-4">
            <div className="my-auto flex h-fit w-full max-w-lg flex-col items-center rounded-3xl border border-white/20 bg-black/75 p-5 text-center shadow-2xl backdrop-blur-2xl sm:p-8">
              {/* Échelles fluides plutôt que deux paliers : la carte doit se
                  compacter progressivement, pas basculer d'un coup au point de
                  rupture `sm`. */}
              <img
                src={logoImg}
                alt="L'Apéro Quiz"
                className="mb-3 w-auto object-contain drop-shadow-[0_8px_20px_rgba(249,115,22,0.4)]"
                style={{ height: "clamp(3rem, 9vh, 5rem)" }}
              />

              <h2
                className="font-black text-white"
                style={{ fontSize: "clamp(1.35rem, 5vw, 1.875rem)" }}
              >
                {t("game:solo.finished")}
              </h2>
              <p className="mb-4 text-sm text-gray-300">
                <Trans
                  i18nKey="game:solo.congrats"
                  values={{ name: playerName }}
                  components={{
                    name: <span className="font-bold text-orange-400" />,
                  }}
                />
              </p>

              {/* Tableau de bord des résultats */}
              <div className="mb-5 grid w-full grid-cols-2 gap-3">
                <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-slate-900/80 p-4 shadow-inner">
                  <span className="text-[11px] font-extrabold tracking-wider text-gray-400 uppercase">
                    {t("game:solo.finalScore")}
                  </span>
                  <span className="mt-1 text-2xl font-black text-amber-400 sm:text-3xl">
                    {resultSummary.totalPoints.toLocaleString()}{" "}
                    <span className="text-xs font-bold text-amber-300">
                      pts
                    </span>
                  </span>
                </div>

                <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-slate-900/80 p-4 shadow-inner">
                  <span className="text-[11px] font-extrabold tracking-wider text-gray-400 uppercase">
                    {t("game:solo.provisionalRank")}
                  </span>
                  <span className="mt-1 text-2xl font-black text-orange-400 sm:text-3xl">
                    #{resultSummary.rank}
                    <span className="text-xs font-semibold text-gray-400">
                      {" "}
                      / {resultSummary.totalPlayers}
                    </span>
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
                  <span className="text-xs font-semibold text-gray-300">
                    {t("game:solo.correctAnswers")}
                  </span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {resultSummary.correctAnswersCount} /{" "}
                    {resultSummary.totalQuestions} (
                    {Math.round(
                      (resultSummary.correctAnswersCount /
                        Math.max(1, resultSummary.totalQuestions)) *
                        100,
                    )}
                    %)
                  </span>
                </div>
              </div>

              {/* Encart Tirage au Sort de la Semaine */}
              <div className="mb-6 w-full rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-transparent p-4 text-left shadow-lg">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
                    <Trophy className="size-4" />
                  </div>
                  <h4 className="text-xs font-black tracking-wider text-orange-300 uppercase">
                    {t("game:solo.drawTitle")}
                  </h4>
                </div>
                <p className="text-xs leading-relaxed text-gray-200">
                  <Trans
                    i18nKey="game:solo.drawText"
                    values={{ count: SOLO_DRAW_POOL_SIZE }}
                    components={{ top: <strong className="text-amber-300" /> }}
                  />
                </p>
              </div>

              {/* Actions Joueur */}
              <div className="flex w-full flex-col gap-2.5">
                <SoloSharePanel
                  quizz={quizz}
                  points={resultSummary.totalPoints}
                />

                <button
                  onClick={handlePlayAgain}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-800/90 py-3 text-sm font-bold text-white transition-all hover:bg-slate-700 active:scale-[0.99]"
                >
                  <RotateCcw className="size-4 text-gray-300" />
                  <span>{t("game:solo.playAgain")}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
