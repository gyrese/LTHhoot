import type {
  QuestionUpdate,
  QuestionWithId,
} from "@rahoot/web/features/quizz/contexts/quizz-editor-context"

export const previousQuestionSettings = (
  questions: QuestionWithId[],
  currentIndex: number,
): { sourceIndex: number; patch: QuestionUpdate } | null => {
  const current = questions[currentIndex]
  if (!current) {
    return null
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const source = questions[index]
    if ((source.type === "title") !== (current.type === "title")) {
      continue
    }

    return {
      sourceIndex: index,
      patch:
        current.type === "title"
          ? { cooldown: source.cooldown }
          : {
              cooldown: source.cooldown,
              time: source.time,
              showLeaderboard: source.showLeaderboard,
              pointsMultiplier: source.pointsMultiplier,
              suddenDeath: source.suddenDeath,
            },
    }
  }

  return null
}

export const copyTimingToSimilarQuestions = (
  questions: QuestionWithId[],
  sourceIndex: number,
): QuestionWithId[] => {
  const source = questions[sourceIndex]
  if (!source) {
    return questions
  }

  const isTitle = source.type === "title"
  return questions.map((question) => {
    if ((question.type === "title") !== isTitle) {
      return question
    }

    return {
      ...question,
      cooldown: source.cooldown,
      ...(isTitle ? {} : { time: source.time }),
    }
  })
}
