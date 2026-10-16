export const removeQuestionBatch = <T extends { id: string }>(
  questions: T[],
  ids: string[],
): { questions: T[]; activeIndex: number } | null => {
  const selected = new Set(ids)
  const firstRemovedIndex = questions.findIndex((question) =>
    selected.has(question.id),
  )
  const removedCount = questions.filter((question) =>
    selected.has(question.id),
  ).length
  if (removedCount === 0 || removedCount >= questions.length) {
    return null
  }

  const remaining = questions.filter((question) => !selected.has(question.id))
  const nextQuestion = questions.find(
    (question, index) =>
      index >= firstRemovedIndex && !selected.has(question.id),
  )
  const activeIndex = nextQuestion
    ? remaining.findIndex((question) => question.id === nextQuestion.id)
    : remaining.length - 1
  return { questions: remaining, activeIndex }
}

export const duplicateQuestionBatch = <T extends { id: string }>(
  questions: T[],
  ids: string[],
  createId: () => string,
): { questions: T[]; copies: T[]; activeIndex: number } | null => {
  const selected = new Set(ids)
  const originals = questions.filter((question) => selected.has(question.id))
  if (originals.length === 0) {
    return null
  }

  const copies = originals.map((question) => ({
    ...question,
    id: createId(),
  })) as T[]
  const lastSelectedIndex = questions.reduce(
    (last, question, index) => (selected.has(question.id) ? index : last),
    -1,
  )
  const next = [...questions]
  next.splice(lastSelectedIndex + 1, 0, ...copies)
  return { questions: next, copies, activeIndex: lastSelectedIndex + 1 }
}
