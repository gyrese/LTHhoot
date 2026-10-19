import type { QuizzMeta } from "@rahoot/common/types/game"
import { isArchived, isGuestFolder } from "../../utils/folders"

export type FolderGrid = {
  folders: { path: string; quizzes: QuizzMeta[] }[]
  quizzes: QuizzMeta[]
}

const isFolderPath = (path: string | undefined): path is string =>
  Boolean(path && path.split("/").every((part) => part.trim().length > 0))

/**
 * Builds one browsing level from the complete library. Search/filter result
 * views should remain flat instead of using this routine. Folder previews
 * retain the supplied quiz order and include all descendants; visible quiz
 * cards belong to this exact level only. No persisted path is rewritten.
 */
export function buildFolderGrid(
  quizzes: QuizzMeta[],
  customFolders: string[],
  activeFolder: string | null,
): FolderGrid {
  const folders = new Map<string, QuizzMeta[]>()
  const visibleQuizzes: QuizzMeta[] = []
  const childFolder = (path: string): string | null => {
    if (!activeFolder) {
      if (isArchived(path) || isGuestFolder(path)) {
        return null
      }
      return path.split("/")[0]
    }
    const prefix = `${activeFolder}/`
    return path.startsWith(prefix)
      ? prefix + path.slice(prefix.length).split("/")[0]
      : null
  }

  for (const path of customFolders) {
    if (!isFolderPath(path)) {
      continue
    }
    const child = childFolder(path)
    if (child && !folders.has(child)) {
      folders.set(child, [])
    }
  }

  for (const quiz of quizzes) {
    const path = quiz.folder
    if (!isFolderPath(path)) {
      if (!activeFolder) {
        visibleQuizzes.push(quiz)
      }
      continue
    }
    if (path === activeFolder) {
      visibleQuizzes.push(quiz)
      continue
    }
    const child = childFolder(path)
    if (child) {
      const contents = folders.get(child) ?? []
      contents.push(quiz)
      folders.set(child, contents)
    }
  }

  return {
    folders: [...folders]
      .sort(([a], [b]) =>
        a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      )
      .map(([path, contents]) => ({ path, quizzes: contents })),
    quizzes: visibleQuizzes,
  }
}
