import { GUEST_FOLDER } from "@rahoot/common/utils/guest"

export { ARCHIVE_FOLDER, isArchived } from "@rahoot/common/utils/folders"

// Dossier virtuel « Invités » (vue admin des bibliothèques guest) : ni
// renommable, ni supprimable, ni cible de drag-drop.
export const isGuestFolder = (folder?: string): boolean =>
  folder === GUEST_FOLDER || (folder?.startsWith(`${GUEST_FOLDER}/`) ?? false)

export { GUEST_FOLDER }
