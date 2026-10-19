import { foldersKey } from "./library"

export const FOLDER_COMMAND = "rahoot:folder-command"
export type FolderCommand = {
  key: string
  action: "create" | "delete"
  path: string | null
}

export function requestFolderCommand(
  action: FolderCommand["action"],
  path: string | null,
  role?: string,
  guestName?: string,
) {
  window.dispatchEvent(
    new CustomEvent<FolderCommand>(FOLDER_COMMAND, {
      detail: { key: foldersKey(role, guestName), action, path },
    }),
  )
}
