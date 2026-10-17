import type { QuizzMeta } from "@rahoot/common/types/game"
import {
  ARCHIVE_FOLDER,
  GUEST_FOLDER,
  isArchived,
  isGuestFolder,
} from "../../utils/folders"

export type LibrarySort = "recent" | "title" | "duration" | "questions"
export type LibraryFilter = "all" | "favorites" | "unfiled"
export type LibraryPreferences = {
  sort: LibrarySort
  layout: "grid" | "list"
  favorites: string[]
}
export const defaultPreferences: LibraryPreferences = {
  sort: "recent",
  layout: "grid",
  favorites: [],
}
export const libraryScope = (role?: string, guestName?: string) =>
  role === "guest" ? `guest:${guestName ?? "unknown"}` : "admin"
export const foldersKey = (role?: string, guestName?: string) =>
  role === "guest"
    ? `rahoot:folders:guest:${guestName ?? "unknown"}`
    : "rahoot:folders"

export function readPreferences(scope: string): LibraryPreferences {
  try {
    const raw = JSON.parse(
      localStorage.getItem(`rahoot:library:${scope}`) || "null",
    )
    return {
      sort: ["recent", "title", "duration", "questions"].includes(raw?.sort)
        ? raw.sort
        : "recent",
      layout: raw?.layout === "list" ? "list" : "grid",
      favorites: Array.isArray(raw?.favorites)
        ? raw.favorites.filter((id: unknown) => typeof id === "string")
        : [],
    }
  } catch {
    return { ...defaultPreferences, favorites: [] }
  }
}

export function sortLibrary(
  quizzes: QuizzMeta[],
  sort: LibrarySort,
): QuizzMeta[] {
  const byTitle = (a: QuizzMeta, b: QuizzMeta) =>
    a.subject.localeCompare(b.subject, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  return [...quizzes].sort((a, b) => {
    if (sort === "recent") {
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || byTitle(a, b)
    }
    if (sort === "duration") {
      return (
        (a.estimatedDurationSec ?? Infinity) -
          (b.estimatedDurationSec ?? Infinity) || byTitle(a, b)
      )
    }
    if (sort === "questions") {
      return b.questionCount - a.questionCount || byTitle(a, b)
    }
    return byTitle(a, b)
  })
}

export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .trim()

export function moveQuizInOrder(ids: string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ids.length) {
    return ids
  }
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
export function matchesSearch(quiz: QuizzMeta, search: string) {
  return normalizeSearch(
    [quiz.subject, quiz.publicName, quiz.folder, ...(quiz.tags ?? [])]
      .filter(Boolean)
      .join(" "),
  ).includes(normalizeSearch(search))
}

export function moveDestinations(
  quizzes: QuizzMeta[],
  custom: string[],
): string[] {
  const paths = [...quizzes.map((q) => q.folder), ...custom].filter(
    (p): p is string =>
      typeof p === "string" &&
      Boolean(p) &&
      !isArchived(p) &&
      !isGuestFolder(p),
  )
  return [
    ...new Set(
      paths.flatMap((path) =>
        path.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/")),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b))
}

export function readCustomFolders(role?: string, guestName?: string): string[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem(foldersKey(role, guestName)) || "[]",
    )
    return Array.isArray(raw)
      ? raw.filter(
          (p): p is string =>
            typeof p === "string" &&
            ![ARCHIVE_FOLDER, GUEST_FOLDER].includes(p),
        )
      : []
  } catch {
    return []
  }
}
