import { useEffect, useState } from "react"
import { foldersKey, readCustomFolders } from "./library"

export const CUSTOM_FOLDERS_CHANGED = "rahoot:folders-changed"

export default function useCustomFolderPaths(
  role?: string,
  guestName?: string,
) {
  const key = foldersKey(role, guestName)
  const [state, setState] = useState(() => ({
    key,
    folders: readCustomFolders(role, guestName),
  }))
  useEffect(() => {
    const refresh = (event?: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { key?: string; folders?: unknown })
          : null
      if (detail?.key && detail.key !== key) {
        return
      }
      const folders = Array.isArray(detail?.folders)
        ? detail.folders.filter(
            (folder): folder is string => typeof folder === "string",
          )
        : readCustomFolders(role, guestName)
      setState({ key, folders })
    }
    refresh()
    window.addEventListener(CUSTOM_FOLDERS_CHANGED, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(CUSTOM_FOLDERS_CHANGED, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [key, role, guestName])
  return state.key === key ? state.folders : readCustomFolders(role, guestName)
}
