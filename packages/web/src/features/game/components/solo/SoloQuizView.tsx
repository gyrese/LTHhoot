import { EVENTS } from "@rahoot/common/constants"
import type { Question } from "@rahoot/common/types/game"
import { normalizeAnswer } from "@rahoot/common/utils/normalize-answer"
import { SOLO_DRAW_POOL_SIZE } from "@rahoot/common/utils/result-kind"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
import BackgroundRevealer from "@rahoot/web/features/game/components/BackgroundRevealer"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
import SlideCanvas from "@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"
import AnimatedPoints from "@rahoot/web/features/game/components/AnimatedPoints"
import NotARobotCheck from "@rahoot/web/features/game/components/solo/NotARobotCheck"
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
  Send,
  Share2,
  Sparkles,
  User,
  XCircle,
} from "lucide-react"
import React, { useEffect, useState } from "react"
import Confetti from "react-confetti"
import toast from "react-hot-toast"
import useSound from "use-sound"

type PublicQuizz = {
  id: string
  subject: string
  description?: string
  salonImage?: string
  listingImage?: string
  questions: Question[]
}

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

export const SoloQuizView: React.FC<Props> = ({ quizzId }) => {
  const { socket, isConnected } = useSocket()
  const [quizz, setQuizz] = useState<PublicQuizz | null>(null)
  const [step, setStep] = useState<"START" | "RULES" | "QUESTION" | "FINISHED">(
    "START",
  )
  // Décompte de l'écran de règles affiché entre le formulaire et la 1re question.
  const [rulesCountdown, setRulesCountdown] = useState(RULES_SCREEN_SECONDS)

  const [playerName, setPlayerName] = useState("")
  const [socialContact, setSocialContact] = useState("")
  // Anti-bot : case cochée + honeypot vide + délai minimum (vérifiés serveur).
  const [isHumanChecked, setIsHumanChecked] = useState(false)
  const [honeypot, setHoneypot] = useState("")
  const [startedAt, setStartedAt] = useState<number | null>(null)

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(
    null,
  )
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false)
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null)

  const [textInput, setTextInput] = useState("")

  const [answersRecords, setAnswersRecords] = useState<
    Array<{
      questionIndex: number
      answerId?: number | null
      textAnswer?: string | null
      timeMs?: number
    }>
  >([])

  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  const [timeLeft, setTimeLeft] = useState<number>(20)
  const [progress, setProgress] = useState(100)
  const [userPoints, setUserPoints] = useState(0)
  const [lastPointsAdded, setLastPointsAdded] = useState(0)

  const [resultSummary, setResultSummary] = useState<{
    totalPoints: number
    rank: number
    totalPlayers: number
    correctAnswersCount: number
    totalQuestions: number
  } | null>(null)

  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })
  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, { volume: 0.2 })
  const [sfxCorrect] = useSound(SFX.RESULTS_SOUND, { volume: 0.4 })
  const [sfxWrong] = useSound(SFX.BOUMP_SOUND, { volume: 0.4 })

  // Enchaînement automatique vers la question suivante après 2.2 secondes (animation fluide sans clic)
  useEffect(() => {
    if (!hasSubmittedAnswer || step !== "QUESTION") {
      return
    }

    const timer = setTimeout(() => {
      handleNextQuestion()
    }, 2200)

    return () => clearTimeout(timer)
  }, [hasSubmittedAnswer, step, currentQuestionIdx])

  // Décompte de l'écran de règles → démarrage automatique du quiz
  useEffect(() => {
    if (step !== "RULES") {
      return
    }

    if (rulesCountdown <= 0) {
      launchFirstQuestion()

      return
    }

    const timer = setTimeout(() => setRulesCountdown((n) => n - 1), 1000)

    return () => clearTimeout(timer)
  }, [step, rulesCountdown])

  // Événements socket
  useEvent(EVENTS.ASYNC_QUIZ.DATA, (data: PublicQuizz) => {
    setQuizz(data)
  })

  useEvent(EVENTS.ASYNC_QUIZ.SUBMIT_SUCCESS, (data) => {
    setResultSummary(data)
    setStep("FINISHED")
  })

  useEffect(() => {
    if (isConnected && socket && quizzId) {
      socket.emit(EVENTS.ASYNC_QUIZ.GET_PUBLIC, quizzId)
    }
  }, [isConnected, socket, quizzId])

  // Timer question
  useEffect(() => {
    if (step !== "QUESTION" || hasSubmittedAnswer) {
      return
    }

    const initialTime = currentQuestion?.time || 20
    const endTime = questionStartTime + initialTime * 1000

    const interval = setInterval(() => {
      const now = Date.now()
      const remainingMs = endTime - now
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))
      setTimeLeft(remainingSec)

      const pct = Math.max(
        0,
        Math.min(100, (remainingMs / (initialTime * 1000)) * 100),
      )
      setProgress(pct)

      if (remainingMs <= 0) {
        clearInterval(interval)
        handleTimeOut()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [step, currentQuestionIdx, hasSubmittedAnswer, questionStartTime])

  const currentQuestion = quizz?.questions[currentQuestionIdx]

  const handleTimeOut = () => {
    if (hasSubmittedAnswer) {
      return
    }

    setHasSubmittedAnswer(true)
    setIsCorrectAnswer(false)
    sfxWrong()
    const timeSpent = Date.now() - questionStartTime

    setAnswersRecords((prev) => [
      ...prev,
      { questionIndex: currentQuestionIdx, answerId: null, timeMs: timeSpent },
    ])
  }

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault()

    if (!playerName.trim()) {
      toast.error("Veuillez entrer un pseudo")

      return
    }

    if (!isHumanChecked) {
      toast.error("Merci de confirmer que vous n'êtes pas un robot")

      return
    }

    setStartedAt(Date.now())

    if (quizz?.description?.trim()) {
      setRulesCountdown(RULES_SCREEN_SECONDS)
      setStep("RULES")

      return
    }

    launchFirstQuestion()
  }

  // Démarrage effectif du quiz : depuis le formulaire (pas de règles) ou à la
  // fin du décompte de l'écran de règles.
  const launchFirstQuestion = () => {
    setStep("QUESTION")
    setCurrentQuestionIdx(0)
    setQuestionStartTime(Date.now())
    const firstQTime = quizz?.questions[0]?.time || 20
    setTimeLeft(firstQTime)
    setProgress(100)
    sfxShow()
  }

  const checkIsAnswerCorrect = (q: any, ansIdx: number): boolean => {
    if (!q) {
      return false
    }

    if (q.type === "mcq" || !q.type) {
      if (Array.isArray(q.solutions)) {
        return q.solutions.includes(ansIdx)
      }

      if (typeof q.solution === "number") {
        return q.solution === ansIdx
      }

      if (Array.isArray(q.answers) && q.answers[ansIdx]) {
        return typeof q.answers[ansIdx] === "object"
          ? Boolean(q.answers[ansIdx].correct)
          : false
      }
    }

    if (q.type === "true_false") {
      if (typeof q.solution === "number") {
        return q.solution === ansIdx
      }

      if (Array.isArray(q.answers) && q.answers[ansIdx]) {
        return typeof q.answers[ansIdx] === "object"
          ? Boolean(q.answers[ansIdx].correct)
          : false
      }
    }

    return false
  }

  const handleAnswerSelect = (ansIdx: number) => {
    if (hasSubmittedAnswer || !currentQuestion) {
      return
    }

    sfxPop()
    setSelectedAnswer(ansIdx)
    setHasSubmittedAnswer(true)

    const timeSpent = Date.now() - questionStartTime
    const correct = checkIsAnswerCorrect(currentQuestion, ansIdx)

    setIsCorrectAnswer(correct)

    if (correct) {
      sfxCorrect()
      const timeLimit = (currentQuestion.time || 20) * 1000
      const speedBonus = Math.max(
        0,
        Math.round(500 * (1 - timeSpent / timeLimit)),
      )
      const totalGain = 1000 + speedBonus
      setLastPointsAdded(totalGain)
      setUserPoints((pts) => pts + totalGain)
    } else {
      sfxWrong()
      setLastPointsAdded(0)
    }

    setAnswersRecords((prev) => [
      ...prev,
      {
        questionIndex: currentQuestionIdx,
        answerId: ansIdx,
        timeMs: timeSpent,
      },
    ])
  }

  const handleOpenTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (hasSubmittedAnswer || !currentQuestion) {
      return
    }

    if (!textInput.trim()) {
      return
    }

    sfxPop()
    setSelectedAnswer(textInput)
    setHasSubmittedAnswer(true)

    const timeSpent = Date.now() - questionStartTime
    let correct = false
    const text = normalizeAnswer(textInput)

    if (currentQuestion.type === "open") {
      if (Array.isArray(currentQuestion.correctAnswers)) {
        correct = currentQuestion.correctAnswers.some(
          (ca: string) => normalizeAnswer(ca) === text,
        )
      } else if (typeof (currentQuestion as any).answer === "string") {
        correct = normalizeAnswer((currentQuestion as any).answer) === text
      }
    }

    setIsCorrectAnswer(correct)

    if (correct) {
      sfxCorrect()
      setLastPointsAdded(1000)
      setUserPoints((pts) => pts + 1000)
    } else {
      sfxWrong()
      setLastPointsAdded(0)
    }

    setAnswersRecords((prev) => [
      ...prev,
      {
        questionIndex: currentQuestionIdx,
        textAnswer: textInput,
        timeMs: timeSpent,
      },
    ])
  }

  const handleNextQuestion = () => {
    if (!quizz) {
      return
    }

    setLastPointsAdded(0)

    if (currentQuestionIdx + 1 < quizz.questions.length) {
      const nextIdx = currentQuestionIdx + 1
      setCurrentQuestionIdx(nextIdx)
      setSelectedAnswer(null)
      setHasSubmittedAnswer(false)
      setIsCorrectAnswer(null)
      setTextInput("")
      setQuestionStartTime(Date.now())

      const nextQTime = quizz.questions[nextIdx]?.time || 20
      setTimeLeft(nextQTime)
      setProgress(100)
      sfxShow()
    } else if (socket) {
      socket.emit(EVENTS.ASYNC_QUIZ.SUBMIT, {
        quizzId: quizz.id,
        playerName,
        socialContact,
        answers: answersRecords,
        human: { hp: honeypot, startedAt },
      })
    }
  }

  if (!quizz) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-lg font-medium text-gray-400">
            Chargement du quiz...
          </p>
        </div>
      </div>
    )
  }

  // Calcul du fond d'écran selon l'étape du quiz (couverture du quiz sur l'écran d'accueil)
  const coverImage = quizz.salonImage || quizz.listingImage

  let bgStyle: React.CSSProperties = {}
  let bgOpacity = 0.6
  let bgImageForRevealer: string | undefined = undefined

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
          duration={
            currentQuestion.revealDuration ?? currentQuestion.time ?? 20
          }
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
                  Votre Pseudo *
                </label>
                <div className="relative">
                  <User className="absolute top-3.5 left-3.5 size-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: QuizMaster99"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-black/40 py-3.5 pr-4 pl-11 font-semibold text-white placeholder-gray-400 shadow-inner backdrop-blur-md transition-all focus:border-orange-500 focus:bg-black/60 focus:ring-2 focus:ring-orange-500/40 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-extrabold tracking-wider text-gray-200 uppercase">
                  Identifiant Réseau / Email (Optionnel)
                </label>
                <div className="relative">
                  <AtSign className="absolute top-3.5 left-3.5 size-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Ex: @votre_insta / email@domaine.com"
                    value={socialContact}
                    onChange={(e) => setSocialContact(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-black/40 py-3.5 pr-4 pl-11 text-sm font-semibold text-white placeholder-gray-400 shadow-inner backdrop-blur-md transition-all focus:border-orange-500 focus:bg-black/60 focus:ring-2 focus:ring-orange-500/40 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-left text-[11px] font-medium text-gray-300">
                  Requis si vous gagnez le tirage au sort pour réclamer votre
                  lot !
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
                disabled={!isHumanChecked}
                className="group relative mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-orange-400/30 bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-base font-extrabold text-white shadow-[0_10px_25px_rgba(249,115,22,0.4)] transition-all hover:from-orange-400 hover:to-amber-400 hover:shadow-[0_12px_30px_rgba(249,115,22,0.6)] active:scale-[0.99] disabled:cursor-not-allowed disabled:border-white/10 disabled:from-slate-700 disabled:to-slate-700 disabled:text-gray-400 disabled:shadow-none disabled:active:scale-100"
              >
                <span>Démarrer la partie</span>
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
              Règles du jeu
            </span>

            <p className="text-base leading-relaxed font-medium whitespace-pre-line text-white">
              {quizz.description}
            </p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="flex size-14 items-center justify-center rounded-full border-2 border-orange-500 text-2xl font-black text-orange-400">
                {rulesCountdown}
              </span>
              <span className="text-xs text-gray-400">
                Le quiz démarre dans un instant…
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
                backgroundColor:
                  progress > 50
                    ? "#22c55e"
                    : progress > 25
                      ? "#f59e0b"
                      : "#ef4444",
              }}
            />
          </div>

          {/* Question Header Card */}
          <div className="relative z-20 px-4 pt-6">
            <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-black/60 px-6 py-5 text-center shadow-2xl backdrop-blur-md">
              <h2 className="text-xl font-extrabold text-white drop-shadow-md sm:text-2xl md:text-3xl">
                {currentQuestion.question || (currentQuestion as any).title}
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
            {(currentQuestion.type === "mcq" || !currentQuestion.type) &&
              currentQuestion.answers && (
                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {currentQuestion.answers.map((ans: any, idx: number) => {
                    const Icon = ANSWERS_ICONS[idx % 4]
                    const colorClass = ANSWERS_COLORS[idx % 4]
                    const isSelected = selectedAnswer === idx
                    const isCorrect = checkIsAnswerCorrect(currentQuestion, idx)

                    let btnState: boolean | undefined = undefined

                    if (hasSubmittedAnswer) {
                      if (isCorrect) {
                        btnState = true
                      } else if (isSelected) {
                        btnState = false
                      }
                    }

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
                        {ans.title ||
                          ans.text ||
                          (typeof ans === "string" ? ans : "")}
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
                  correct={
                    hasSubmittedAnswer
                      ? checkIsAnswerCorrect(currentQuestion, 0)
                        ? true
                        : selectedAnswer === 0
                          ? false
                          : undefined
                      : undefined
                  }
                  className="min-h-24 cursor-pointer bg-red-600 text-xl font-black text-white shadow-xl"
                >
                  Faux
                </AnswerButton>

                <AnswerButton
                  index={1}
                  icon={ANSWERS_ICONS[1]}
                  disabled={hasSubmittedAnswer}
                  onClick={() => handleAnswerSelect(1)}
                  correct={
                    hasSubmittedAnswer
                      ? checkIsAnswerCorrect(currentQuestion, 1)
                        ? true
                        : selectedAnswer === 1
                          ? false
                          : undefined
                      : undefined
                  }
                  className="min-h-24 cursor-pointer bg-blue-600 text-xl font-black text-white shadow-xl"
                >
                  Vrai
                </AnswerButton>
              </div>
            )}

            {/* Open Question */}
            {currentQuestion.type === "open" && (
              <form
                onSubmit={handleOpenTextSubmit}
                className="mx-auto mb-3 flex max-w-2xl gap-2"
              >
                <input
                  type="text"
                  disabled={hasSubmittedAnswer}
                  placeholder="Tapez votre réponse ici..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 rounded-2xl border border-white/20 bg-black/70 px-5 py-4 text-lg font-bold text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={hasSubmittedAnswer || !textInput.trim()}
                  className="flex cursor-pointer items-center gap-2 rounded-2xl bg-orange-500 px-6 py-4 text-lg font-extrabold text-white shadow-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  <span>Valider</span>
                  <Send className="size-5" />
                </button>
              </form>
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
                  Question {currentQuestionIdx + 1} / {quizz.questions.length}
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

                {hasSubmittedAnswer && (
                  <button
                    onClick={handleNextQuestion}
                    className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/30 transition-all hover:from-orange-600 hover:to-amber-600"
                  >
                    <span>
                      {currentQuestionIdx + 1 < quizz.questions.length
                        ? "Suivant"
                        : "Terminer"}
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
                        ? "BONNE RÉPONSE !"
                        : "MAUVAISE RÉPONSE !"}
                    </h4>
                    <p className="text-xs font-medium text-gray-300">
                      {isCorrectAnswer
                        ? "Passage automatique à la suite..."
                        : "Suivante dans 2s..."}
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
          <Confetti recycle={false} numberOfPieces={350} />
          <div className="relative z-20 flex flex-1 items-center justify-center p-4">
            <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-white/15 bg-black/70 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
              <img
                src={logoImg}
                alt="L'Apéro Quiz"
                className="mb-4 h-32 w-auto animate-bounce object-contain drop-shadow-[0_10px_25px_rgba(249,115,22,0.5)] sm:h-40"
              />

              <h2 className="mb-1 text-3xl font-black text-white">
                Partie Terminée !
              </h2>
              <p className="mb-6 text-sm text-gray-300">
                Bravo{" "}
                <span className="font-bold text-orange-400">{playerName}</span>{" "}
                !
              </p>

              {/* Box résultats */}
              <div className="mb-6 grid w-full grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-slate-900/90 p-5">
                <div className="flex flex-col items-center border-r border-white/10 pr-2">
                  <span className="text-xs font-semibold text-gray-400">
                    Votre Score
                  </span>
                  <span className="text-2xl font-black text-amber-400">
                    {resultSummary.totalPoints.toLocaleString()} pts
                  </span>
                </div>

                <div className="flex flex-col items-center pl-2">
                  <span className="text-xs font-semibold text-gray-400">
                    Rang Provisoire
                  </span>
                  <span className="text-2xl font-black text-orange-400">
                    #{resultSummary.rank}
                  </span>
                </div>
              </div>

              <p className="mb-6 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-xs text-gray-300">
                Le tirage au sort du gagnant aura lieu en fin de semaine parmi
                le{" "}
                <strong>Top {SOLO_DRAW_POOL_SIZE} des meilleurs scores</strong>.
              </p>

              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: quizz.subject,
                      text: `J'ai fait ${resultSummary.totalPoints} pts sur le quiz "${quizz.subject}" ! Viens tenter ta chance :`,
                      url: window.location.href,
                    })
                  } else {
                    navigator.clipboard.writeText(window.location.href)
                    toast.success("Lien copié dans le presse-papier !")
                  }
                }}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-800 py-3.5 font-bold text-white transition-all hover:bg-slate-700"
              >
                <Share2 className="size-5 text-orange-400" />
                <span>Partager ce Quiz</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
