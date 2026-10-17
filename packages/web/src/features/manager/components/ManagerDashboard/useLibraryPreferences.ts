import { useEffect, useState } from "react"
import {
  libraryScope,
  readPreferences,
  type LibraryPreferences,
} from "./library"

export default function useLibraryPreferences(
  role?: string,
  guestName?: string,
) {
  const scope = libraryScope(role, guestName)
  const [saved, setSaved] = useState(() => ({
    scope,
    value: readPreferences(scope),
  }))
  const preferences =
    saved.scope === scope ? saved.value : readPreferences(scope)
  useEffect(() => {
    if (saved.scope !== scope) {
      return
    }
    try {
      localStorage.setItem(
        `rahoot:library:${scope}`,
        JSON.stringify(saved.value),
      )
    } catch {
      /* Preferences remain usable in memory. */
    }
  }, [saved, scope])
  const update = (patch: Partial<LibraryPreferences>) =>
    setSaved((prev) => ({
      scope,
      value: {
        ...(prev.scope === scope ? prev.value : readPreferences(scope)),
        ...patch,
      },
    }))
  const toggleFavorite = (id: string) =>
    setSaved((prev) => {
      const value = prev.scope === scope ? prev.value : readPreferences(scope)
      return {
        scope,
        value: {
          ...value,
          favorites: value.favorites.includes(id)
            ? value.favorites.filter((favorite) => favorite !== id)
            : [...value.favorites, id],
        },
      }
    })
  return { preferences, update, toggleFavorite }
}
