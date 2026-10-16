import type { McqQuestion } from "@rahoot/common/types/game"
import type { QuestionUpdate } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"

export const moveMcqAnswer = (
  question: McqQuestion,
  index: number,
  direction: -1 | 1,
): QuestionUpdate | null => {
  const nextIndex = index + direction
  if (
    index < 0 ||
    index >= question.answers.length ||
    nextIndex < 0 ||
    nextIndex >= question.answers.length
  ) {
    return null
  }

  const answers = [...question.answers]
  const moved = answers[index]!
  answers[index] = answers[nextIndex]!
  answers[nextIndex] = moved

  return {
    answers,
    solutions: question.solutions.map((solution) => {
      if (solution === index) {
        return nextIndex
      }
      if (solution === nextIndex) {
        return index
      }
      return solution
    }),
  }
}

export const removeMcqAnswer = (
  question: McqQuestion,
  index: number,
): QuestionUpdate | null => {
  if (
    question.answers.length <= 2 ||
    index < 0 ||
    index >= question.answers.length
  ) {
    return null
  }

  const answers = question.answers.filter(
    (_, answerIndex) => answerIndex !== index,
  )
  const remainingSolutions = question.solutions
    .filter((solution) => solution !== index)
    .map((solution) => (solution > index ? solution - 1 : solution))

  return {
    answers,
    solutions: remainingSolutions.length > 0 ? remainingSolutions : [0],
    layout: question.layout?.answers
      ? {
          ...question.layout,
          answers: question.layout.answers.filter(
            (_, answerIndex) => answerIndex !== index,
          ),
        }
      : question.layout,
  }
}
