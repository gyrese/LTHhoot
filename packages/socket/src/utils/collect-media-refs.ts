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

// Regex détectant une URL média (locale /uploads/ ou distante http(s)://).
const MEDIA_URL_RE =
  /^(?:\/uploads\/|https?:\/\/).+\.(?:webp|png|jpe?g|gif|svg|mp3|ogg|wav|m4a|aac|mp4|webm)(?:[?#].*)?$/iu

export const collectAllMediaUrls = (
  value: unknown,
  acc: Set<string> = new Set<string>(),
): string[] => {
  if (typeof value === "string") {
    const trimmed = value.trim()

    if (trimmed.startsWith("/uploads/") || MEDIA_URL_RE.test(trimmed)) {
      acc.add(trimmed)
    }

    return Array.from(acc)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAllMediaUrls(item, acc)
    }

    return Array.from(acc)
  }

  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectAllMediaUrls(nested, acc)
    }

    return Array.from(acc)
  }

  return Array.from(acc)
}
