export const ARCHIVE_FOLDER = "Archive"

export const isArchived = (folder?: string): boolean =>
  folder === ARCHIVE_FOLDER || (folder?.startsWith(`${ARCHIVE_FOLDER}/`) ?? false)
