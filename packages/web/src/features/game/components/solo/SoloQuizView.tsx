import { EVENTS } from "@rahoot/common/constants"
import { useEvent, useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { ANSWERS_COLORS, ANSWERS_ICONS } from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import { CheckCircle2, Trophy, User, Share2, ArrowRight, Sparkles, XCircle, Clock } from "lucide-react"
import React, { useEffect, useState } from "react"
import Confetti from "react-confetti"
import toast from "react-hot-toast"

type PublicQuizz = {
  id: string
  subject: string
  description?: string
  salonImage?: string
  listingImage?: string
  questions: any[]
}

type Props = {
  quizzId: string
}

export const SoloQuizView: React.FC<Props> = ({ quizzId }) => {
  const { socket, isConnected } = useSocket()
  const [quizz, setQuizz] = useState<PublicQuizz | null>(null)
  const [step, setStep] = useState<"START" | "QUESTION" | "FINISHED">("START")

  const [playerName, setPlayerName] = useState("")
  const [socialContact, setSocialContact] = useState("")

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null)
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false)

  const [answers, setAnswers] = useState<
    Array<{
      questionIndex: number
      answerId?: number | null
      textAnswer?: string | null
      timeMs?: number
    }>
  >([])

  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  const [timeLeft, setTimeLeft] = useState<number>(20)

  const [resultSummary, setResultSummary] = useState<{
    totalPoints: number
    rank: number
    totalPlayers: number
    correctAnswersCount: number
    totalQuestions: number
  } | null>(null)

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

  // Chronomètre de question
  useEffect(() => {
    if (step !== "QUESTION" || hasSubmittedAnswer) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleTimeOut()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [step, currentQuestionIdx, hasSubmittedAnswer])

  const handleTimeOut = () => {
    if (hasSubmittedAnswer) return
    setHasSubmittedAnswer(true)
    const timeSpent = Date.now() - questionStartTime
    setAnswers((prev) => [
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
    setTimeLeft(20)
  }

  const handleAnswerSelect = (ansIdx: number | string) => {
    if (hasSubmittedAnswer) return
    setSelectedAnswer(ansIdx)
    setHasSubmittedAnswer(true)
    const timeSpent = Date.now() - questionStartTime

    const answerRecord =
      typeof ansIdx === "number"
        ? { questionIndex: currentQuestionIdx, answerId: ansIdx, timeMs: timeSpent }
        : { questionIndex: currentQuestionIdx, textAnswer: String(ansIdx), timeMs: timeSpent }

    setAnswers((prev) => [...prev, answerRecord])
  }

  const handleNextQuestion = () => {
    if (!quizz) return

    if (currentQuestionIdx + 1 < quizz.questions.length) {
      setCurrentQuestionIdx((prev) => prev + 1)
      setSelectedAnswer(null)
      setHasSubmittedAnswer(false)
      setQuestionStartTime(Date.now())
      setTimeLeft(20)
    } else {
      // Soumission finale du quiz au backend
      if (socket) {
        socket.emit(EVENTS.ASYNC_QUIZ.SUBMIT, {
          quizzId: quizz.id,
          playerName,
          socialContact,
          answers,
        })
      }
    }
  }

  if (!quizz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-gray-400 font-medium">Chargement du quiz...</p>
        </div>
      </div>
    )
  }

  const currentQuestion = quizz.questions[currentQuestionIdx]

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 -left-20 size-80 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 size-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

      {step === "START" && (
        <div className="w-full max-w-lg bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl z-10 flex flex-col items-center text-center">
          {quizz.salonImage ? (
            <img
              src={quizz.salonImage}
              alt={quizz.subject}
              className="w-full h-44 object-cover rounded-xl mb-6 shadow-md"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30">
              <Trophy className="size-8 text-white" />
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
            {quizz.subject}
          </h1>
          {quizz.description && (
            <p className="text-gray-300 text-sm mb-6 max-w-md">{quizz.description}</p>
          )}

          <div className="w-full bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-6 text-xs text-orange-300 flex items-center justify-center gap-2">
            <Sparkles className="size-4 shrink-0" />
            <span>Répondez pour participer au tirage au sort parmi les meilleurs scores !</span>
          </div>

          <form onSubmit={handleStart} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 text-left mb-1.5 uppercase tracking-wider">
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
                  className="w-full bg-slate-900/80 border border-white/15 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 text-left mb-1.5 uppercase tracking-wider">
                Identifiant Réseau ou Email (Optionnel)
              </label>
              <input
                type="text"
                placeholder="Ex: @votre_insta / email@domaine.com"
                value={socialContact}
                onChange={(e) => setSocialContact(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/15 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
              />
              <p className="text-[11px] text-gray-400 text-left mt-1">
                Utilisé pour vous contacter si vous gagnez le tirage au sort !
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <span>Commencer le Quiz</span>
              <ArrowRight className="size-5" />
            </button>
          </form>
        </div>
      )}

      {step === "QUESTION" && currentQuestion && (
        <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl z-10 flex flex-col">
          {/* Header question */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-widest bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
              Question {currentQuestionIdx + 1} / {quizz.questions.length}
            </span>

            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-white/10">
              <Clock className="size-4 text-amber-400" />
              <span className={clsx("font-bold text-sm", timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white")}>
                {timeLeft}s
              </span>
            </div>
          </div>

          {/* Intitulé */}
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
            {currentQuestion.question || currentQuestion.title}
          </h2>

          {/* Media de question s'il existe */}
          {currentQuestion.media?.url && (
            <div className="mb-6 overflow-hidden rounded-xl border border-white/10 max-h-56 flex items-center justify-center">
              <img
                src={currentQuestion.media.url}
                alt="Media question"
                className="max-h-56 w-auto object-contain"
              />
            </div>
          )}

          {/* Choix de réponses (MCQ ou Vrai/Faux) */}
          {currentQuestion.answers && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {currentQuestion.answers.map((ans: any, idx: number) => {
                const Icon = ANSWERS_ICONS[idx % 4]
                const colorClass = ANSWERS_COLORS[idx % 4]
                const isSelected = selectedAnswer === idx
                const isCorrect = ans.correct

                return (
                  <button
                    key={idx}
                    disabled={hasSubmittedAnswer}
                    onClick={() => handleAnswerSelect(idx)}
                    className={clsx(
                      "flex items-center gap-3 p-4 rounded-xl text-left font-semibold transition-all border cursor-pointer",
                      colorClass,
                      hasSubmittedAnswer && isCorrect && "ring-4 ring-green-400 border-green-500",
                      hasSubmittedAnswer && isSelected && !isCorrect && "opacity-60 border-red-500",
                      !hasSubmittedAnswer && "hover:scale-[1.02] active:scale-[0.98]",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="flex-1 text-sm sm:text-base">{ans.title || ans.text || ans}</span>
                    {hasSubmittedAnswer && isCorrect && (
                      <CheckCircle2 className="size-5 text-white ml-auto" />
                    )}
                    {hasSubmittedAnswer && isSelected && !isCorrect && (
                      <XCircle className="size-5 text-white ml-auto" />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Footer d'avancement */}
          {hasSubmittedAnswer && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleNextQuestion}
                className="py-3 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {currentQuestionIdx + 1 < quizz.questions.length
                    ? "Question Suivante"
                    : "Voir mes résultats"}
                </span>
                <ArrowRight className="size-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {step === "FINISHED" && resultSummary && (
        <>
          <Confetti recycle={false} numberOfPieces={300} />
          <div className="w-full max-w-lg bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center mb-6 shadow-xl shadow-orange-500/40 animate-bounce">
              <Trophy className="size-10 text-white" />
            </div>

            <h2 className="text-3xl font-extrabold text-white mb-2">Quiz Terminé !</h2>
            <p className="text-gray-300 text-sm mb-6">
              Bravo <span className="text-orange-400 font-bold">{playerName}</span> !
            </p>

            {/* Score box */}
            <div className="w-full bg-slate-900/90 border border-white/10 rounded-2xl p-5 mb-6 grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center border-r border-white/10 pr-2">
                <span className="text-xs text-gray-400 font-medium">Votre Score</span>
                <span className="text-2xl font-black text-amber-400">
                  {resultSummary.totalPoints.toLocaleString()} pts
                </span>
              </div>

              <div className="flex flex-col items-center pl-2">
                <span className="text-xs text-gray-400 font-medium">Classement Provisoire</span>
                <span className="text-2xl font-black text-orange-400">
                  #{resultSummary.rank} / {resultSummary.totalPlayers}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-6">
              Le tirage au sort du gagnant aura lieu en fin de semaine parmi les 10 meilleurs scores.
              Bonne chance ! 🍀
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
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="size-5 text-orange-400" />
              <span>Partager ce Quiz</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
