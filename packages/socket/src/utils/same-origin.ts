import type { IncomingHttpHeaders } from "http"

// Vrai si l'en-tête Origin désigne le même hôte que la requête (en-tête Host,
// que le nginx du conteneur relaie tel quel). Le port est ignoré : derrière le
// proxy, le serveur ne voit pas le port public.
export const isSameOrigin = (
  origin: string,
  headers: IncomingHttpHeaders,
): boolean => {
  const host = (headers.host ?? "").trim().toLowerCase().replace(/:\d+$/u, "")

  if (!host) {
    return false
  }

  try {
    return new URL(origin).hostname.toLowerCase() === host
  } catch {
    return false
  }
}
