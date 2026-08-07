// Deux natures de résultats cohabitent dans le manager :
// - les parties classiques animées en direct (id = uuid de la partie) ;
// - les classements cumulatifs des quiz solo « Réseaux » (un seul résultat par
//   quiz, alimenté à chaque soumission publique, cf. handlers/async-quiz.ts).
// Seul le préfixe de l'id distingue les deux — le sujet est purement cosmétique.
export const SOLO_RESULT_ID_PREFIX = "async_"
export const SOLO_RESULT_SUBJECT_PREFIX = "[Réseaux] "

// Nombre de joueurs éligibles au tirage au sort d'un quiz solo : on ne tire que
// parmi les meilleurs, le tirage récompense la performance et pas la simple
// participation.
export const SOLO_DRAW_POOL_SIZE = 3

export const isSoloResult = (result: { id: string }): boolean =>
  result.id.startsWith(SOLO_RESULT_ID_PREFIX)

// Sujet sans son préfixe de catégorie : la liste des résultats solo affiche déjà
// sa propre entête, répéter « [Réseaux] » sur chaque ligne n'apporte rien.
export const resultDisplaySubject = (subject: string): string =>
  subject.startsWith(SOLO_RESULT_SUBJECT_PREFIX)
    ? subject.slice(SOLO_RESULT_SUBJECT_PREFIX.length)
    : subject
