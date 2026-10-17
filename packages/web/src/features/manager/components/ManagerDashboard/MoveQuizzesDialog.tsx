import { useState } from "react"
import { FolderInput, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import EditorDialog from "@rahoot/web/features/quizz/components/EditorDialog"
import { moveDestinations, readCustomFolders } from "./library"
import type { QuizzMeta } from "@rahoot/common/types/game"
import { isArchived } from "../../utils/folders"

export default function MoveQuizzesDialog({
  quizzes,
  ids,
  role,
  guestName,
  onMove,
  onClose,
}: {
  quizzes: QuizzMeta[]
  ids: string[]
  role?: string
  guestName?: string
  onMove: (_folder: string | null) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [folder, setFolder] = useState(() => {
    const current = quizzes.find((q) => q.id === ids[0])?.folder
    return current && !isArchived(current) ? current : ""
  })
  const [destinations] = useState(() =>
    moveDestinations(quizzes, readCustomFolders(role, guestName)),
  )
  const canMove = quizzes.some(
    (quiz) => ids.includes(quiz.id) && (quiz.folder || "") !== folder,
  )
  return (
    <EditorDialog
      label={t("manager:library.moveTitle", { count: ids.length })}
      onClose={onClose}
    >
      <div className="rounded-xl border border-white/15 bg-black/90 p-5 text-white backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <FolderInput className="size-5 text-orange-300" />
            {t("manager:library.moveTitle", { count: ids.length })}
          </h2>
          <button
            type="button"
            className="dashboard-icon"
            onClick={onClose}
            aria-label={t("common:close")}
          >
            <X className="size-4" />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (canMove) {
              onMove(folder || null)
            }
          }}
        >
          <label className="block space-y-2 text-sm font-medium">
            <span>{t("manager:library.destination")}</span>
            <select
              className="dashboard-select w-full"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            >
              <option value="">{t("manager:library.unfiled")}</option>
              {destinations.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="dashboard-secondary"
              onClick={onClose}
            >
              {t("common:cancel")}
            </button>
            <button
              type="submit"
              disabled={!canMove}
              className="dashboard-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("manager:library.move")}
            </button>
          </div>
        </form>
      </div>
    </EditorDialog>
  )
}
