// Normalisation des réponses ouvertes : la comparaison ignore la casse, les
// espaces de bord et les accents/diacritiques ("Éléphant" === "elephant").
// Un seul point de vérité, partagé par le serveur (jeu live, quiz solo) et le
// web (mode solo, télécommande, écran de validation de l'hôte).
export const normalizeAnswer = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/œ/gu, "oe")
    .replace(/æ/gu, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\s+/gu, " ")

// Deux réponses ouvertes sont-elles équivalentes ?
export const isSameAnswer = (a: string, b: string): boolean =>
  normalizeAnswer(a) === normalizeAnswer(b)
