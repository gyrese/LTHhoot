import type { GameResult, McqQuestion, QuestionResult } from "@rahoot/common/types/game"
import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react"

type McqQuestionResult = McqQuestion & { playerAnswers: QuestionResult["playerAnswers"] }

const isMcqResult = (qr: QuestionResult): qr is McqQuestionResult =>
  qr.type === "mcq"

type ResultModalContextType = {
  result: GameResult
  questionResult: QuestionResult
  questionIndex: number
  total: number
  totalPlayers: number
  answeredCount: number
  correctCount: number
  correctPct: number
  maxAnswerCount: number
  getPlayerPoints: (_name: string) => number
  goNext: () => void
  goPrev: () => void
  onClose: () => void
}

const ResultModalContext = createContext<ResultModalContextType | null>(null)

type Props = PropsWithChildren<{
  result: GameResult
  onClose: () => void
}>

export const ResultModalProvider = ({ children, result, onClose }: Props) => {
  const [questionIndex, setQuestionIndex] = useState(0)

  const questionResult = result.questions[questionIndex]
  const total = result.questions.length
  const totalPlayers = result.players.length

  const answeredCount = questionResult.playerAnswers.filter(
    (pa) => pa.answerId !== null && pa.answerId !== undefined || pa.textAnswer !== null && pa.textAnswer !== undefined || pa.numberAnswer !== null && pa.numberAnswer !== undefined,
  ).length

  const correctCount = isMcqResult(questionResult)
    ? questionResult.playerAnswers.filter(
        (pa) => pa.answerId !== null && pa.answerId !== undefined && questionResult.solutions.includes(pa.answerId),
      ).length
    : questionResult.playerAnswers.filter((pa) => pa.points > 0).length

  const correctPct =
    totalPlayers > 0 ? Math.round((correctCount / totalPlayers) * 100) : 0

  const maxAnswerCount = isMcqResult(questionResult)
    ? Math.max(
        1,
        ...questionResult.answers.map(
          (_, ai) =>
            questionResult.playerAnswers.filter((pa) => pa.answerId === ai).length,
        ),
      )
    : Math.max(1, answeredCount)

  const getPlayerPoints = (name: string) =>
    result.players.find((p) => p.username === name)?.points ?? 0

  const goNext = () => setQuestionIndex((i) => Math.min(i + 1, total - 1))

  const goPrev = () => setQuestionIndex((i) => Math.max(i - 1, 0))

  return (
    <ResultModalContext.Provider
      value={{
        result,
        questionResult,
        questionIndex,
        total,
        totalPlayers,
        answeredCount,
        correctCount,
        correctPct,
        maxAnswerCount,
        getPlayerPoints,
        goNext,
        goPrev,
        onClose,
      }}
    >
      {children}
    </ResultModalContext.Provider>
  )
}

export const useResultModal = () => {
  const ctx = useContext(ResultModalContext)

  if (!ctx) {
    throw new Error("useResultModal must be used inside ResultModalProvider")
  }

  return ctx
}
