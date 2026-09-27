import type { Question, Quizz } from "@rahoot/common/types/game"

// Repère logique des diapositives (éléments du canvas ET mise en page libre du
// titre / des réponses) : tout est exprimé en pixels 1920×1080, puis mis à
// l'échelle à l'affichage.
export const SLIDE_WIDTH = 1920
export const SLIDE_HEIGHT = 1080

// Nombre maximal de propositions d'un QCM (cf. validateur) : borne aussi la
// liste `layout.answers`.
export const MAX_MCQ_ANSWERS = 4

// Police du texte d'une question : celle de la question, sinon celle du quiz.
// `undefined` = police de l'interface (rendu historique).
export const resolveQuestionFont = (
  question: Pick<Question, "fontFamily">,
  quizz?: Pick<Quizz, "fontFamily">,
): string | undefined => question.fontFamily || quizz?.fontFamily || undefined
