// Normalisation des réponses ouvertes : la comparaison ignore la casse, les
// accents/diacritiques ("Éléphant" === "elephant"), la ponctuation et les
// espaces.
//
// Pourquoi supprimer les espaces AUSSI : aucune règle intermédiaire ne satisfait
// les deux familles de cas. Remplacer l'apostrophe par un espace casse
// « leau » ≠ « l eau » ; la supprimer casse « jean-pierre » ≠ « jean pierre ».
// En retirant ponctuation ET espaces, les deux convergent vers la même clé.
// Seule la ponctuation (\p{P}) part : les symboles mathématiques et monétaires
// (\p{S} : +, =, €, $, °) sont CONSERVÉS, ils portent le sens de la réponse.
// Note : % et & sont classés « ponctuation » par Unicode, ils tombent donc
// aussi — « 20 % » est validé par « 20 », tolérance assumée.
//
// Un seul point de vérité, partagé par le serveur (jeu live, quiz solo) et le
// web (mode solo, télécommande, écran de validation de l'hôte). Sert aussi de
// clé de regroupement des réponses affichées à l'hôte : deux graphies d'une
// même réponse tombent sur une seule ligne.
export const normalizeAnswer = (text: string): string =>
  text
    .toLowerCase()
    .replace(/œ/gu, "oe")
    .replace(/æ/gu, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[\p{P}\s]/gu, "")

// Deux réponses ouvertes sont-elles équivalentes ?
export const isSameAnswer = (a: string, b: string): boolean =>
  normalizeAnswer(a) === normalizeAnswer(b)
