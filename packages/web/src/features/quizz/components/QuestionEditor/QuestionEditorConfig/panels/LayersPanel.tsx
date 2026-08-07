import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  ChevronDown,
  ChevronUp,
  Lock,
  MessageSquareReply,
  Trash2,
  Unlock,
} from "lucide-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

const LayersPanel = () => {
  const {
    currentQuestion,
    currentIndex,
    updateQuestion,
    selectedId,
    setSelectedId,
  } = useQuizzEditor()
  const { t } = useTranslation()

  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [editingLayerName, setEditingLayerName] = useState("")

  if (!currentQuestion) {
    return null
  }

  const handleDeleteLayer = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const elements = (currentQuestion.elements || []).filter(
      (el) => el.id !== id,
    )
    updateQuestion(currentIndex, { elements })

    if (selectedId === id) {
      setSelectedId(undefined)
    }
  }

  const handleMoveLayer =
    (id: string, direction: "up" | "down") => (e: React.MouseEvent) => {
      e.stopPropagation()
      const elements = [...(currentQuestion.elements || [])]
      const index = elements.findIndex((el) => el.id === id)

      if (index === -1) {
        return
      }

      if (direction === "up" && index < elements.length - 1) {
        ;[elements[index], elements[index + 1]] = [
          elements[index + 1],
          elements[index],
        ]
      } else if (direction === "down" && index > 0) {
        ;[elements[index], elements[index - 1]] = [
          elements[index - 1],
          elements[index],
        ]
      }

      updateQuestion(currentIndex, { elements })
    }

  const handleToggleLock =
    (id: string, isLocked: boolean) => (e: React.MouseEvent) => {
      e.stopPropagation()
      const elements = (currentQuestion.elements || []).map((el) =>
        el.id === id ? { ...el, isLocked } : el,
      )
      updateQuestion(currentIndex, { elements })
    }

  const handleStartRename =
    (id: string, currentName: string) => (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditingLayerId(id)
      setEditingLayerName(currentName)
    }

  const handleFinishRename = (id: string) => {
    const elements = (currentQuestion.elements || []).map((el) =>
      el.id === id ? { ...el, name: editingLayerName.trim() || undefined } : el,
    )
    updateQuestion(currentIndex, { elements })
    setEditingLayerId(null)
  }

  return (
    <div className="flex flex-col gap-1.5 py-4">
      {[...(currentQuestion.elements || [])].reverse().map((el, i, arr) => {
        const isSelected = selectedId === el.id
        const originalIndex = arr.length - 1 - i

        return (
          <div
            key={el.id}
            onClick={() => setSelectedId(el.id)}
            className={clsx(
              "ease-out-soft flex cursor-pointer items-center justify-between rounded-lg border p-2 text-[11px] transition-all duration-150",
              isSelected
                ? "border-primary bg-primary-soft"
                : "border-border bg-surface hover:bg-panel",
            )}
          >
            {editingLayerId === el.id ? (
              <input
                type="text"
                value={editingLayerName}
                onChange={(e) => setEditingLayerName(e.target.value)}
                onBlur={() => handleFinishRename(el.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleFinishRename(el.id)
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-ink border-primary focus:border-primary flex-1 border-b bg-transparent py-0.5 text-[11px] font-medium outline-none"
                autoFocus
              />
            ) : (
              <div
                className="flex flex-1 items-center gap-2 overflow-hidden"
                onDoubleClick={handleStartRename(el.id, el.name || el.type)}
              >
                <div
                  className={clsx(
                    "size-1.5 rounded-full",
                    isSelected ? "bg-primary" : "bg-border-strong",
                  )}
                />
                <span
                  className={clsx(
                    "max-w-[90px] shrink-0 truncate font-bold capitalize",
                    isSelected ? "text-primary-ink" : "text-ink",
                  )}
                  title="Double-cliquer pour renommer"
                >
                  {el.name || el.type}
                </span>
                {el.type === "text" && !el.name && (
                  <span className="text-ink-subtle truncate italic">
                    "{el.text}"
                  </span>
                )}
              </div>
            )}

            <div className="ml-2 flex items-center gap-0.5">
              <button
                onClick={handleToggleLock(el.id, !el.isLocked)}
                className={clsx(
                  "rounded p-1 hover:bg-white",
                  el.isLocked
                    ? "text-primary"
                    : "text-ink-subtle hover:text-primary-ink",
                )}
                title={el.isLocked ? "Déverrouiller" : "Verrouiller"}
              >
                {el.isLocked ? (
                  <Lock className="size-3.5" />
                ) : (
                  <Unlock className="size-3.5" />
                )}
              </button>
              <button
                onClick={handleMoveLayer(el.id, "up")}
                disabled={originalIndex === arr.length - 1}
                className="text-ink-subtle hover:text-primary-ink rounded p-1 hover:bg-white disabled:opacity-20"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                onClick={handleMoveLayer(el.id, "down")}
                disabled={originalIndex === 0}
                className="text-ink-subtle hover:text-primary-ink rounded p-1 hover:bg-white disabled:opacity-20"
              >
                <ChevronDown className="size-3.5" />
              </button>
              <button
                onClick={handleDeleteLayer(el.id)}
                className="text-ink-subtle hover:text-danger ml-1 rounded p-1 hover:bg-white"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
      {(!currentQuestion.elements || currentQuestion.elements.length === 0) && (
        <div className="text-ink-subtle flex flex-col items-center gap-2 py-6 text-center">
          <MessageSquareReply className="size-5 opacity-50" />
          <p className="text-xs">{t("quizz:question.config.noLayers")}</p>
        </div>
      )}
    </div>
  )
}

export default LayersPanel
