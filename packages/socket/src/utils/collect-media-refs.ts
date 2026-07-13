// Extraction des références média locales (`/uploads/<fichier>`) contenues dans
// une valeur JSON arbitraire (quiz, résultat…).
//
// Choix d'un parcours RÉCURSIF GÉNÉRIQUE plutôt qu'un accès champ par champ :
// un quiz porte des URLs d'upload à de nombreux endroits (salonImage,
// listingImage, media.url, audio, background image, answerReveal.image,
// images[] de séquence, pinImage, elements[] de type image…). Collecter toute
// chaîne contenant `/uploads/` garantit qu'AUCUNE référence n'est manquée — y
// compris pour un champ ajouté plus tard — ce qui est la propriété critique
// d'un nettoyage d'orphelins : sur-conserver est sûr, sous-conserver supprime un
// fichier utilisé. Les URLs externes (Unsplash/Giphy en https) ne matchent pas
// et sont donc ignorées.

// Capture le nom de fichier juste après `/uploads/` (jusqu'au prochain
// séparateur, une query string `?` ou un fragment `#`).
const UPLOAD_REF_RE = /\/uploads\/([A-Za-z0-9._-]+)/gu

export const collectUploadRefs = (
  value: unknown,
  acc: Set<string> = new Set<string>(),
): Set<string> => {
  if (typeof value === "string") {
    for (const match of value.matchAll(UPLOAD_REF_RE)) {
      acc.add(match[1])
    }

    return acc
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUploadRefs(item, acc)
    }

    return acc
  }

  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectUploadRefs(nested, acc)
    }

    return acc
  }

  return acc
}
