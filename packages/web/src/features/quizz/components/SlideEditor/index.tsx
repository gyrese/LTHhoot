import {
  type SlideElement,
  type SlideBackground,
} from "@rahoot/common/types/game"
import { useEffect, useState } from "react"
import { generateElementId } from "@rahoot/web/features/quizz/utils/id"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import SlideCanvas from "./SlideCanvas"
import SlideContextMenu, { type ContextMenuAction } from "./SlideContextMenu"
import {
  Layers,
  Lock,
  Unlock,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit3,
  Type,
  Square,
  Image as ImageIcon,
  Play,
  X,
} from "lucide-react"
import clsx from "clsx"

type SlideEditorProps = {
  elements: SlideElement[]
  onChange: (_elements: SlideElement[]) => void
  background?: SlideBackground
  backgroundOpacity?: number
}

const SlideEditor = ({
  elements,
  onChange,
  background,
  backgroundOpacity,
}: SlideEditorProps) => {
  const {
    updateQuestion,
    currentIndex,
    selectedId,
    setSelectedId,
    showLayersPanel,
    setShowLayersPanel,
  } = useQuizzEditor()
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    show: boolean
  } | null>(null)
  const [copiedElements, setCopiedElements] = useState<SlideElement[] | null>(
    null,
  )
  // Sélection multiple d'éléments (rubber-band / shift-clic sur le canvas).
  // Mutuellement exclusive avec `selectedId` : le canvas ne renseigne jamais
  // les deux à la fois (cf. `applySelectionResult` dans SlideCanvas).
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Une sélection multiple ne doit pas survivre à un changement de slide.
  useEffect(() => {
    setSelectedIds([])
  }, [currentIndex])

  const selectedElement = elements.find((e) => e.id === selectedId)
  const selectedType = selectedElement?.type
  const hasMultiSelection = selectedIds.length >= 2

  const deleteSelection = () => {
    if (hasMultiSelection) {
      onChange(elements.filter((e) => !selectedIds.includes(e.id)))
      setSelectedIds([])

      return
    }

    onChange(elements.filter((e) => e.id !== selectedId))
    setSelectedId(undefined)
  }

  const copySelection = () => {
    if (hasMultiSelection) {
      const selected = elements.filter((e) => selectedIds.includes(e.id))

      if (selected.length) {
        setCopiedElements(selected)
      }

      return
    }

    const selected = elements.find((e) => e.id === selectedId)

    if (selected) {
      setCopiedElements([selected])
    }
  }

  const pasteSelection = () => {
    if (!copiedElements || copiedElements.length === 0) {
      return
    }

    const newEls = copiedElements.map((el) => ({
      ...el,
      id: generateElementId(),
      x: el.x + 20,
      y: el.y + 20,
    }))

    onChange([...elements, ...newEls])

    if (newEls.length >= 2) {
      setSelectedIds(newEls.map((el) => el.id))
      setSelectedId(undefined)
    } else {
      setSelectedIds([])
      setSelectedId(newEls[0].id)
    }
  }

  const duplicateSelection = () => {
    let idsToDuplicate: string[] = []
    if (hasMultiSelection) {
      idsToDuplicate = selectedIds
    } else if (selectedId) {
      idsToDuplicate = [selectedId]
    }

    if (idsToDuplicate.length === 0) {
      return
    }

    const toDuplicate = elements.filter((e) => idsToDuplicate.includes(e.id))
    const newEls = toDuplicate.map((el) => ({
      ...el,
      id: generateElementId(),
      x: el.x + 20,
      y: el.y + 20,
    }))

    onChange([...elements, ...newEls])

    if (newEls.length >= 2) {
      setSelectedIds(newEls.map((el) => el.id))
      setSelectedId(undefined)
    } else {
      setSelectedIds([])
      setSelectedId(newEls[0].id)
    }
  }

  const handleContextMenuAction = (action: ContextMenuAction) => {
    switch (action) {
      case "copy": {
        copySelection()

        break
      }

      case "paste": {
        pasteSelection()

        break
      }

      case "delete": {
        deleteSelection()

        break
      }

      case "bringToFront": {
        if (selectedId && selectedElement) {
          onChange([
            ...elements.filter((e) => e.id !== selectedId),
            selectedElement,
          ])
        }

        break
      }

      case "sendToBack": {
        if (selectedId && selectedElement) {
          onChange([
            selectedElement,
            ...elements.filter((e) => e.id !== selectedId),
          ])
        }

        break
      }

      case "bringForward": {
        if (selectedId && selectedElement) {
          const idx = elements.findIndex((e) => e.id === selectedId)

          if (idx < elements.length - 1) {
            const newElements = [...elements]
            const temp = newElements[idx]
            newElements[idx] = newElements[idx + 1]
            newElements[idx + 1] = temp
            onChange(newElements)
          }
        }

        break
      }

      case "sendBackward": {
        if (selectedId && selectedElement) {
          const idx = elements.findIndex((e) => e.id === selectedId)

          if (idx > 0) {
            const newElements = [...elements]
            const temp = newElements[idx]
            newElements[idx] = newElements[idx - 1]
            newElements[idx - 1] = temp
            onChange(newElements)
          }
        }

        break
      }

      case "setAsBackground": {
        if (
          selectedType === "image" &&
          selectedElement &&
          "url" in selectedElement
        ) {
          updateQuestion(currentIndex, {
            background: { type: "image", value: selectedElement.url },
            elements: elements.filter((e) => e.id !== selectedId),
          })
          setSelectedId(undefined)
        }

        break
      }

      case "opacity": {
        if (selectedElement) {
          const newOpacity = (selectedElement.opacity || 1) <= 0.5 ? 1 : 0.5
          onChange(
            elements.map((e) =>
              e.id === selectedId ? { ...e, opacity: newOpacity } : e,
            ),
          )
        }

        break
      }

      case "toggleLock": {
        if (selectedId && selectedElement) {
          onChange(
            elements.map((e) =>
              e.id === selectedId ? { ...e, isLocked: !e.isLocked } : e,
            ),
          )
        }

        break
      }

      default:
        break
    }
  }

  // Raccourcis clavier locaux pour l'élément (ou le groupe) sélectionné du
  // canvas. Ne doit s'activer que si une sélection existe et que le focus
  // n'est pas dans un champ texte (même garde que le handler global du
  // contexte). Le handler global du contexte ignore de son côté la
  // navigation entre slides via les flèches simples tant qu'un élément est
  // sélectionné (voir quizz-editor-context.tsx), en défense complémentaire
  // du preventDefault/stopPropagation ci-dessous.
  useEffect(() => {
    if (!selectedId && !hasMultiSelection) {
      return
    }

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName.toLowerCase()
      const inTextField =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable === true

      if (inTextField) {
        return
      }

      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        deleteSelection()

        return
      }

      if (ctrl && key === "c") {
        e.preventDefault()
        copySelection()

        return
      }

      if (ctrl && key === "v") {
        e.preventDefault()
        pasteSelection()

        return
      }

      if (ctrl && key === "d") {
        e.preventDefault()
        duplicateSelection()

        return
      }

      if (e.key === "Escape") {
        setSelectedId(undefined)
        setSelectedIds([])

        return
      }

      const isArrow =
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"

      if (isArrow && !ctrl && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()

        const step = e.shiftKey ? 10 : 1
        let dx = 0
        let dy = 0

        if (e.key === "ArrowUp") {
          dy = -step
        }

        if (e.key === "ArrowDown") {
          dy = step
        }

        if (e.key === "ArrowLeft") {
          dx = -step
        }

        if (e.key === "ArrowRight") {
          dx = step
        }

        let idsToMove: string[] = []
        if (hasMultiSelection) {
          idsToMove = selectedIds
        } else if (selectedId) {
          idsToMove = [selectedId]
        }

        onChange(
          elements.map((el) =>
            idsToMove.includes(el.id)
              ? { ...el, x: el.x + dx, y: el.y + dy }
              : el,
          ),
        )
      }
    }

    window.addEventListener("keydown", handler)

    return () => {
      window.removeEventListener("keydown", handler)
    }
  }, [
    selectedId,
    selectedIds,
    hasMultiSelection,
    elements,
    onChange,
    setSelectedId,
    copiedElements,
  ])

  return (
    <div className="pointer-events-none absolute inset-0 flex h-full w-full overflow-hidden">
      <div className="pointer-events-auto relative flex-1">
        <SlideCanvas
          elements={elements}
          onChange={onChange}
          selectedId={selectedId}
          onSelect={setSelectedId}
          selectedIds={selectedIds}
          onSelectMultiple={setSelectedIds}
          background={background}
          backgroundOpacity={backgroundOpacity}
          onContextMenuEvent={(e) => {
            setContextMenu({ x: e.clientX, y: e.clientY, show: true })
          }}
        />
      </div>

      {showLayersPanel && (
        <div className="border-border bg-surface animate-in slide-in-from-right pointer-events-auto z-20 flex h-full w-64 flex-col border-l shadow-md duration-200">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-3.5 py-2.5">
            <div className="text-ink flex items-center gap-1.5 font-bold">
              <Layers className="text-primary size-4" />
              <span>Calques</span>
            </div>
            <button
              onClick={() => setShowLayersPanel(false)}
              className="text-ink-subtle hover:text-ink hover:bg-panel cursor-pointer rounded p-1 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Liste des calques */}
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {elements.length === 0 ? (
              <div className="text-ink-subtle py-8 text-center text-xs">
                Aucun calque sur cette slide
              </div>
            ) : (
              [...elements].reverse().map((el) => {
                const isSelected = selectedId === el.id
                const layerIdx = elements.findIndex((e) => e.id === el.id)
                const isFirst = layerIdx === elements.length - 1
                const isLast = layerIdx === 0

                // Déterminer le label par défaut
                let label = el.name || ""

                if (!label) {
                  if (el.type === "text") {
                    label = el.text || "Texte"
                  } else if (el.type === "image") {
                    label = "Image"
                  } else if (el.type === "youtube") {
                    label = "YouTube"
                  } else if (el.type === "shape") {
                    if (el.shapeType === "rect") {
                      label = "Rectangle"
                    } else if (el.shapeType === "circle") {
                      label = "Cercle"
                    } else if (el.shapeType === "triangle") {
                      label = "Triangle"
                    } else if (el.shapeType === "star") {
                      label = "Étoile"
                    }
                  }
                }

                const displayLabel =
                  label.length > 20 ? `${label.slice(0, 18)}...` : label

                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={clsx(
                      "group/item flex cursor-pointer items-center justify-between rounded-lg p-2 text-xs transition-colors",
                      isSelected
                        ? "bg-primary-soft text-primary-ink font-semibold"
                        : "hover:bg-panel text-ink-muted",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {el.type === "text" && (
                        <Type className="text-ink-subtle size-3.5 shrink-0" />
                      )}
                      {el.type === "shape" && (
                        <Square className="text-ink-subtle size-3.5 shrink-0" />
                      )}
                      {el.type === "image" && (
                        <ImageIcon className="text-ink-subtle size-3.5 shrink-0" />
                      )}
                      {el.type === "youtube" && (
                        <Play className="text-ink-subtle size-3.5 shrink-0" />
                      )}

                      {editingLayerId === el.id ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={label}
                          onBlur={(e) => {
                            const newName = e.target.value.trim()

                            if (newName) {
                              onChange(
                                elements.map((eItem) =>
                                  eItem.id === el.id
                                    ? { ...eItem, name: newName }
                                    : eItem,
                                ),
                              )
                            }

                            setEditingLayerId(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur()
                            }
                          }}
                          className="bg-panel border-primary/30 w-full rounded border px-1 py-0.5 text-xs outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate" title={label}>
                          {displayLabel}
                        </span>
                      )}
                    </div>

                    <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
                      {editingLayerId !== el.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingLayerId(el.id)
                          }}
                          className="text-ink-subtle hover:text-ink cursor-pointer rounded p-1 transition-colors hover:bg-white/20"
                          title="Renommer"
                        >
                          <Edit3 className="size-3" />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onChange(
                            elements.map((eItem) =>
                              eItem.id === el.id
                                ? { ...eItem, isLocked: !eItem.isLocked }
                                : eItem,
                            ),
                          )
                        }}
                        className={clsx(
                          "cursor-pointer rounded p-1 transition-colors",
                          el.isLocked
                            ? "text-danger hover:bg-danger-soft/10"
                            : "text-ink-subtle hover:text-ink hover:bg-white/20",
                        )}
                        title={el.isLocked ? "Déverrouiller" : "Verrouiller"}
                      >
                        {el.isLocked ? (
                          <Lock className="size-3" />
                        ) : (
                          <Unlock className="size-3" />
                        )}
                      </button>

                      <button
                        disabled={isFirst}
                        onClick={(e) => {
                          e.stopPropagation()
                          const idx = elements.findIndex(
                            (eItem) => eItem.id === el.id,
                          )

                          if (idx < elements.length - 1) {
                            const newElements = [...elements]
                            const temp = newElements[idx]
                            newElements[idx] = newElements[idx + 1]
                            newElements[idx + 1] = temp
                            onChange(newElements)
                          }
                        }}
                        className={clsx(
                          "text-ink-subtle hover:text-ink cursor-pointer rounded p-0.5 transition-colors hover:bg-white/20",
                          isFirst && "cursor-not-allowed opacity-30",
                        )}
                        title="Avancer (Monter)"
                      >
                        <ArrowUp className="size-3" />
                      </button>

                      <button
                        disabled={isLast}
                        onClick={(e) => {
                          e.stopPropagation()
                          const idx = elements.findIndex(
                            (eItem) => eItem.id === el.id,
                          )

                          if (idx > 0) {
                            const newElements = [...elements]
                            const temp = newElements[idx]
                            newElements[idx] = newElements[idx - 1]
                            newElements[idx - 1] = temp
                            onChange(newElements)
                          }
                        }}
                        className={clsx(
                          "text-ink-subtle hover:text-ink cursor-pointer rounded p-0.5 transition-colors hover:bg-white/20",
                          isLast && "cursor-not-allowed opacity-30",
                        )}
                        title="Reculer (Descendre)"
                      >
                        <ArrowDown className="size-3" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onChange(
                            elements.filter((eItem) => eItem.id !== el.id),
                          )

                          if (selectedId === el.id) {
                            setSelectedId(undefined)
                          }
                        }}
                        className="hover:bg-danger-soft/10 text-danger cursor-pointer rounded p-1 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {contextMenu?.show && (
        <SlideContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={Boolean(selectedId) || hasMultiSelection}
          selectedType={selectedType}
          isLocked={selectedElement?.isLocked}
          canPaste={Boolean(copiedElements?.length)}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
        />
      )}
    </div>
  )
}

export default SlideEditor
