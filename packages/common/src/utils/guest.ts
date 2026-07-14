// Ids « préfixés » des quiz invités exposés à l'admin. La bibliothèque de
// chaque compte invité est physiquement séparée (config/guests/<guestId>/quizz)
// mais l'admin voit tous les quiz dans une seule liste : le préfixe encode le
// propriétaire pour router chaque opération (lecture, lancement) vers la bonne
// bibliothèque, sans collision possible avec un id de quiz admin.
export const GUEST_QUIZ_PREFIX = "guest:"

// Dossier virtuel sous lequel l'admin voit les bibliothèques invités dans sa
// sidebar (un sous-dossier par compte : « Invités/<nom> »). Purement visuel :
// il n'existe pas sur disque et n'est ni renommable ni supprimable côté UI.
export const GUEST_FOLDER = "Invités"

export const formatGuestQuizId = (guestId: string, quizId: string): string =>
  `${GUEST_QUIZ_PREFIX}${guestId}:${quizId}`

export const isGuestQuizId = (id: string): boolean =>
  id.startsWith(GUEST_QUIZ_PREFIX)

export const parseGuestQuizId = (
  id: string,
): { guestId: string; quizId: string } | null => {
  if (!isGuestQuizId(id)) {
    return null
  }

  const [guestId, ...rest] = id.slice(GUEST_QUIZ_PREFIX.length).split(":")
  const quizId = rest.join(":")

  if (!guestId || !quizId) {
    return null
  }

  return { guestId, quizId }
}
