import type { Question } from "@rahoot/common/types/game"
import { questionValidator } from "@rahoot/common/validators/quizz"

// Same rules for manual save, autosave, thumbnails and the server.
export const validateQuestion = (question: Question): string[] => {
  const result = questionValidator.safeParse(question)
  return result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => issue.message))]
}
