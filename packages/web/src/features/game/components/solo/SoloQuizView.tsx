import { EVENTS } from "@rahoot/common/constants"
import type { Question } from "@rahoot/common/types/game"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
// Page publique : c'est la marque de la soirée qui s'affiche, pas celle de
// l'application (le logo LTNHoot reste sur les écrans hôte/joueur en partie).
import logoImg from "@rahoot/web/assets/logo-aperoquiz.png"
import BackgroundRevealer from "@rahoot/web/features/game/components/BackgroundRevealer"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
import SlideCanvas from "@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"
import AnimatedPoints from "@rahoot/web/features/game/components/AnimatedPoints"
import { useEvent, useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { ANSWERS_COLORS, ANSWERS_ICONS, SFX } from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  Send,
  Share2,
  Sparkles,
  User,
  XCircle,
} from "lucide-react"
import React, { useEffect, useState, useRef } from "react"
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

const noopChange = () => undefined
const noopSelect = () => undefined

export const SoloQuizView: React.FC<Props> = ({ quizzId }) => {
  const { socket, isConnected } = useSocket()
  const [quizz, setQuizz] = useState<PublicQuizz | null>(null)
  const [step, setStep] = useState<"START" | "QUESTION" | "FINISHED">("START")

  const [playerName, setPlayerName] = useState("")
  const [socialContact, setSocialContact] = useState("")

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null)
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
    if (!hasSubmittedAnswer || step !== "QUESTION") return

    const timer = setTimeout(() => {
      handleNextQuestion()
    }, 2200)

    return () => clearTimeout(timer)
  }, [hasSubmittedAnswer, step, currentQuestionIdx])

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
    if (step !== "QUESTION" || hasSubmittedAnswer) return

    const initialTime = currentQuestion?.time || 20
    const endTime = questionStartTime + initialTime * 1000

    const interval = setInterval(() => {
      const now = Date.now()
      const remainingMs = endTime - now
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))
      setTimeLeft(remainingSec)

      const pct = Math.max(0, Math.min(100, (remainingMs / (initialTime * 1000)) * 100))
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
    if (hasSubmittedAnswer) return
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
    setStep("QUESTION")
    setCurrentQuestionIdx(0)
    setQuestionStartTime(Date.now())
    const firstQTime = quizz?.questions[0]?.time || 20
    setTimeLeft(firstQTime)
    setProgress(100)
    sfxShow()
  }

  const checkIsAnswerCorrect = (q: any, ansIdx: number): boolean => {
    if (!q) return false
    if (q.type === "mcq" || !q.type) {
      if (Array.isArray(q.solutions)) return q.solutions.includes(ansIdx)
      if (typeof q.solution === "number") return q.solution === ansIdx
      if (Array.isArray(q.answers) && q.answers[ansIdx]) {
        return typeof q.answers[ansIdx] === "object" ? Boolean(q.answers[ansIdx].correct) : false
      }
    }
    if (q.type === "true_false") {
      if (typeof q.solution === "number") return q.solution === ansIdx
      if (Array.isArray(q.answers) && q.answers[ansIdx]) {
        return typeof q.answers[ansIdx] === "object" ? Boolean(q.answers[ansIdx].correct) : false
      }
    }
    return false
  }

  const handleAnswerSelect = (ansIdx: number) => {
    if (hasSubmittedAnswer || !currentQuestion) return
    sfxPop()
    setSelectedAnswer(ansIdx)
    setHasSubmittedAnswer(true)

    const timeSpent = Date.now() - questionStartTime
    const correct = checkIsAnswerCorrect(currentQuestion, ansIdx)

    setIsCorrectAnswer(correct)
    if (correct) {
      sfxCorrect()
      const timeLimit = (currentQuestion.time || 20) * 1000
      const speedBonus = Math.max(0, Math.round(500 * (1 - timeSpent / timeLimit)))
      const totalGain = 1000 + speedBonus
      setLastPointsAdded(totalGain)
      setUserPoints((pts) => pts + totalGain)
    } else {
      sfxWrong()
      setLastPointsAdded(0)
    }

    setAnswersRecords((prev) => [
      ...prev,
      { questionIndex: currentQuestionIdx, answerId: ansIdx, timeMs: timeSpent },
    ])
  }

  const handleOpenTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (hasSubmittedAnswer || !currentQuestion) return
    if (!textInput.trim()) return

    sfxPop()
    setSelectedAnswer(textInput)
    setHasSubmittedAnswer(true)

    const timeSpent = Date.now() - questionStartTime
    let correct = false
    const text = textInput.trim().toLowerCase()

    if (currentQuestion.type === "open") {
      if (Array.isArray(currentQuestion.correctAnswers)) {
        correct = currentQuestion.correctAnswers.some(
          (ca: string) => ca.trim().toLowerCase() === text,
        )
      } else if (typeof (currentQuestion as any).answer === "string") {
        correct = (currentQuestion as any).answer.trim().toLowerCase() === text
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
      { questionIndex: currentQuestionIdx, textAnswer: textInput, timeMs: timeSpent },
    ])
  }

  const handleNextQuestion = () => {
    if (!quizz) return

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
    } else {
      if (socket) {
        socket.emit(EVENTS.ASYNC_QUIZ.SUBMIT, {
          quizzId: quizz.id,
          playerName,
          socialContact,
          answers: answersRecords,
        })
      }
    }
  }

  if (!quizz) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-gray-400 font-medium text-lg">Chargement du quiz...</p>
        </div>
      </div>
    )
  }

  // Calcul du fond d'écran selon l'étape du quiz (couverture du quiz sur l'écran d'accueil)
  const coverImage = quizz.salonImage || quizz.listingImage

  let bgStyle: React.CSSProperties = {}
  let bgOpacity = 0.6
  let bgImageForRevealer: string | undefined = undefined

  if (step === "START" || step === "FINISHED") {
    if (coverImage) {
      bgStyle = { backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      bgOpacity = 0.7
    } else {
      bgStyle = { backgroundImage: `url(/bg-salon.png)`, backgroundSize: "cover", backgroundPosition: "center" }
      bgOpacity = 0.5
    }
  } else {
    // Étape QUESTION : fond spécifique de la slide/question
    const bg = currentQuestion?.background
    bgOpacity = currentQuestion?.backgroundOpacity ?? 0.6

    if (bg?.type === "image" && bg.value) {
      bgStyle = { backgroundImage: `url(${bg.value})`, backgroundSize: "cover", backgroundPosition: "center" }
      bgImageForRevealer = bg.value
    } else if (bg?.type === "color" && bg.value) {
      bgStyle = { backgroundColor: bg.value }
    } else if (coverImage) {
      bgStyle = { backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      bgImageForRevealer = coverImage
    } else {
      bgStyle = { backgroundImage: `url(/bg-salon.png)`, backgroundSize: "cover", backgroundPosition: "center" }
    }
  }

  return (
    <div className="relative h-screen w-screen flex flex-col justify-between overflow-hidden bg-slate-950 text-white select-none">
      {/* Dynamic Background Image */}
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 transition-all duration-500" style={{ ...bgStyle, opacity: bgOpacity }} />

      {/* Révélation d'image si activée */}
      {step === "QUESTION" && currentQuestion?.revelationEnabled && (
        <BackgroundRevealer
          duration={currentQuestion.revealDuration ?? currentQuestion.time ?? 20}
          gridCols={currentQuestion.gridCols ?? 8}
          gridRows={currentQuestion.gridRows ?? 6}
          seedString={currentQuestion.question || bgImageForRevealer}
          startTimeOffset={0}
          configuredStyle={currentQuestion.revelationStyle}
          imageUrl={bgImageForRevealer}
        />
      )}

      {/* Slide Canvas Elements (si le quiz contient des formes/textes personnalisés) */}
      {step === "QUESTION" && currentQuestion?.elements && currentQuestion.elements.length > 0 && (
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
          <div className="w-full max-w-md bg-black/60 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
            <img
              src={logoImg}
              alt="L'Apéro Quiz"
              className="h-32 sm:h-40 w-auto object-contain mb-4 drop-shadow-[0_10px_20px_rgba(249,115,22,0.4)]"
            />

            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              {quizz.subject}
            </h1>
            {quizz.description && (
              <p className="text-gray-300 text-sm mb-6 max-w-sm">{quizz.description}</p>
            )}

            <form onSubmit={handleStart} className="w-full space-y-4 mt-2">
              <div>
                <label className="block text-xs font-bold text-gray-300 text-left mb-1.5 uppercase tracking-wider">
                  Votre Pseudo *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 size-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: QuizMaster99"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-slate-900/90 border border-white/20 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 text-left mb-1.5 uppercase tracking-wider">
                  Identifiant Réseau / Email (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: @votre_insta / email@domaine.com"
                  value={socialContact}
                  onChange={(e) => setSocialContact(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
                <p className="text-[11px] text-gray-400 text-left mt-1">
                  Requis si vous gagnez le tirage au sort pour réclamer votre lot !
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                <span>Démarrer la partie</span>
                <ArrowRight className="size-5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── SCREEN 2: QUESTION ── */}
      {step === "QUESTION" && currentQuestion && (
        <>
          {/* Top Progress Bar */}
          <div className="absolute top-0 left-0 right-0 z-30 h-2 bg-white/10">
            <div
              className="h-full rounded-r-full transition-all duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                backgroundColor: progress > 50 ? "#22c55e" : progress > 25 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>

          {/* Question Header Card */}
          <div className="relative z-20 px-4 pt-6">
            <div className="mx-auto max-w-7xl rounded-2xl bg-black/60 px-6 py-5 backdrop-blur-md border border-white/10 shadow-2xl text-center">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white drop-shadow-md">
                {currentQuestion.question || (currentQuestion as any).title}
              </h2>
            </div>
          </div>

          {/* Question Media (Image / Video) */}
          <div className="relative z-20 flex flex-1 items-center justify-center p-4">
            {currentQuestion.media && (
              <QuestionMedia media={currentQuestion.media} alt={currentQuestion.question} />
            )}
          </div>

          {/* Answer Area (MCQ / TrueFalse / Open) */}
          <div className="relative z-20 w-full max-w-7xl mx-auto px-4 pb-4">
            {/* MCQ / QCM Questions */}
            {(currentQuestion.type === "mcq" || !currentQuestion.type) && currentQuestion.answers && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {currentQuestion.answers.map((ans: any, idx: number) => {
                  const Icon = ANSWERS_ICONS[idx % 4]
                  const colorClass = ANSWERS_COLORS[idx % 4]
                  const isSelected = selectedAnswer === idx
                  const isCorrect = checkIsAnswerCorrect(currentQuestion, idx)

                  let btnState: boolean | undefined = undefined
                  if (hasSubmittedAnswer) {
                    if (isCorrect) btnState = true
                    else if (isSelected) btnState = false
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
                        "min-h-20 sm:min-h-24 text-lg font-bold text-white shadow-xl cursor-pointer",
                        hasSubmittedAnswer && isCorrect && "ring-4 ring-green-400 bg-green-600",
                        hasSubmittedAnswer && isSelected && !isCorrect && "opacity-50 grayscale",
                      )}
                    >
                      {ans.title || ans.text || (typeof ans === "string" ? ans : "")}
                    </AnswerButton>
                  )
                })}
              </div>
            )}

            {/* True / False Questions */}
            {currentQuestion.type === "true_false" && (
              <div className="grid grid-cols-2 gap-4 mb-3">
                <AnswerButton
                  index={0}
                  icon={ANSWERS_ICONS[0]}
                  disabled={hasSubmittedAnswer}
                  onClick={() => handleAnswerSelect(0)}
                  correct={hasSubmittedAnswer ? (checkIsAnswerCorrect(currentQuestion, 0) ? true : selectedAnswer === 0 ? false : undefined) : undefined}
                  className="bg-red-600 min-h-24 text-xl font-black text-white shadow-xl cursor-pointer"
                >
                  Faux
                </AnswerButton>

                <AnswerButton
                  index={1}
                  icon={ANSWERS_ICONS[1]}
                  disabled={hasSubmittedAnswer}
                  onClick={() => handleAnswerSelect(1)}
                  correct={hasSubmittedAnswer ? (checkIsAnswerCorrect(currentQuestion, 1) ? true : selectedAnswer === 1 ? false : undefined) : undefined}
                  className="bg-blue-600 min-h-24 text-xl font-black text-white shadow-xl cursor-pointer"
                >
                  Vrai
                </AnswerButton>
              </div>
            )}

            {/* Open Question */}
            {currentQuestion.type === "open" && (
              <form onSubmit={handleOpenTextSubmit} className="flex gap-2 max-w-2xl mx-auto mb-3">
                <input
                  type="text"
                  disabled={hasSubmittedAnswer}
                  placeholder="Tapez votre réponse ici..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 bg-black/70 border border-white/20 rounded-2xl px-5 py-4 text-white placeholder-gray-400 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                />
                <button
                  type="submit"
                  disabled={hasSubmittedAnswer || !textInput.trim()}
                  className="px-6 py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-lg flex items-center gap-2 cursor-pointer text-lg"
                >
                  <span>Valider</span>
                  <Send className="size-5" />
                </button>
              </form>
            )}

            {/* HUD Footer (Timer, Score, Next Button, App Logo) */}
            <div className="flex items-center justify-between bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3">
              <div className="flex items-center gap-4">
                <img
                  src={logoImg}
                  alt="L'Apéro Quiz"
                  className="h-10 sm:h-12 w-auto object-contain shrink-0 drop-shadow"
                />
                <span className="text-xs font-bold text-orange-400 uppercase tracking-widest bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/30">
                  Question {currentQuestionIdx + 1} / {quizz.questions.length}
                </span>
                <span className="text-sm font-black text-amber-400">
                  <AnimatedPoints from={userPoints - lastPointsAdded} to={userPoints} /> pts
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-900/80 px-3.5 py-1.5 rounded-full border border-white/10">
                  <Clock className="size-4 text-amber-400" />
                  <span className={clsx("font-extrabold text-sm tabular-nums", timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white")}>
                    {timeLeft}s
                  </span>
                </div>

                {hasSubmittedAnswer && (
                  <button
                    onClick={handleNextQuestion}
                    className="py-2.5 px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-orange-500/30 transition-all flex items-center gap-2 cursor-pointer"
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
              className="absolute top-6 left-1/2 -translate-x-1/2 z-40 cursor-pointer animate-in slide-in-from-top-6 fade-in duration-300 px-4 w-full max-w-lg"
            >
              <div
                className={clsx(
                  "flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all scale-100 hover:scale-[1.02]",
                  isCorrectAnswer
                    ? "bg-slate-950/90 border-emerald-500/60 shadow-emerald-500/30"
                    : "bg-slate-950/90 border-rose-500/60 shadow-rose-500/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      "size-11 sm:size-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg animate-bounce",
                      isCorrectAnswer
                        ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/40"
                        : "bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-500/40"
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
                        "font-extrabold text-base sm:text-lg leading-tight",
                        isCorrectAnswer ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {isCorrectAnswer ? "BONNE RÉPONSE !" : "MAUVAISE RÉPONSE !"}
                    </h4>
                    <p className="text-xs text-gray-300 font-medium">
                      {isCorrectAnswer
                        ? "Passage automatique à la suite..."
                        : "Suivante dans 2s..."}
                    </p>
                  </div>
                </div>

                {isCorrectAnswer && lastPointsAdded > 0 && (
                  <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl animate-pulse shrink-0">
                    <Sparkles className="size-4 text-amber-300" />
                    <span className="text-sm sm:text-base font-black text-amber-300">
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
            <div className="w-full max-w-md bg-black/70 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
              <img
                src={logoImg}
                alt="L'Apéro Quiz"
                className="h-32 sm:h-40 w-auto object-contain mb-4 drop-shadow-[0_10px_25px_rgba(249,115,22,0.5)] animate-bounce"
              />

              <h2 className="text-3xl font-black text-white mb-1">Partie Terminée !</h2>
              <p className="text-gray-300 text-sm mb-6">
                Bravo <span className="text-orange-400 font-bold">{playerName}</span> !
              </p>

              {/* Box résultats */}
              <div className="w-full bg-slate-900/90 border border-white/10 rounded-2xl p-5 mb-6 grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center border-r border-white/10 pr-2">
                  <span className="text-xs text-gray-400 font-semibold">Votre Score</span>
                  <span className="text-2xl font-black text-amber-400">
                    {resultSummary.totalPoints.toLocaleString()} pts
                  </span>
                </div>

                <div className="flex flex-col items-center pl-2">
                  <span className="text-xs text-gray-400 font-semibold">Rang Provisoire</span>
                  <span className="text-2xl font-black text-orange-400">
                    #{resultSummary.rank}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-300 mb-6 bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl">
                Le tirage au sort du gagnant aura lieu en fin de semaine parmi le <strong>Top 10 des meilleurs scores</strong>.
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
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
