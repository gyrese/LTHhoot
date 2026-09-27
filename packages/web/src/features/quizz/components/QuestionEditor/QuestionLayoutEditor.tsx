import type {
  QuestionLayoutBox,
  McqQuestion,
  TrueFalseQuestion,
} from "@rahoot/common/types/game"
import {
  AnswerBoxView,
  TitleBoxView,
} from "@rahoot/web/features/game/components/QuestionLayoutView"
import {
  type BoxHandle,
  type LayoutBoxKey,
  hasLayoutAnswers,
  layoutAnswerCount,
  materializeLayout,
  moveResizeBox,
  resolveQuestionFont,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  updateLayoutBox,
} from "@rahoot/web/features/game/utils/question-layout"
import type { SlideView } from "@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"
import { useQuizzEditor } from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import useAiRephrase from "@rahoot/web/features/quizz/hooks/useAiRephrase"
import clsx from "clsx"
import { Check, Loader2, Sparkles } from "lucide-react"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"

// ─── Titre et cases de réponse positionnables sur la diapositive ─────────────
// Calque HTML posé sur le canvas Konva (même repère 1920×1080, zoom et
// panoramique compris) : les boîtes ont exactement le rendu de l'écran hôte,
// avec en plus poignées de déplacement / redimensionnement (pointeur = souris
// ET tactile) et édition du texte en place (double-clic, ou clic sur une boîte
// déjà sélectionnée, ou Entrée).

// Taille des poignées et de l'outline en pixels ÉCRAN (divisées par l'échelle).
const HANDLE_PX = 12
const OUTLINE_PX = 2
// Seuil (pixels écran) au-delà duquel un appui devient un déplacement.
const DRAG_THRESHOLD_PX = 3

const RESIZE_HANDLES: {
  handle: Exclude<BoxHandle, "move">
  x: number
  y: number
}[] = [
  { handle: "nw", x: 0, y: 0 },
  { handle: "n", x: 0.5, y: 0 },
  { handle: "ne", x: 1, y: 0 },
  { handle: "e", x: 1, y: 0.5 },
  { handle: "se", x: 1, y: 1 },
  { handle: "s", x: 0.5, y: 1 },
  { handle: "sw", x: 0, y: 1 },
  { handle: "w", x: 0, y: 0.5 },
]

const HANDLE_CURSORS: Record<Exclude<BoxHandle, "move">, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
}

type Gesture = {
  handle: BoxHandle
  startX: number
  startY: number
  start: QuestionLayoutBox
  moved: boolean
  wasSelected: boolean
}

type EditableBoxProps = {
  box: QuestionLayoutBox
  scale: number
  label: string
  selected: boolean
  editing: boolean
  onSelect: () => void
  onStartEdit?: () => void
  onCommit: (_box: QuestionLayoutBox) => void
  children: ReactNode
}

// Boîte manipulable : le corps déplace, les poignées redimensionnent. La
// géométrie en cours de geste reste locale (brouillon) et n'est validée dans le
// quiz — donc dans l'historique annuler / rétablir — qu'au relâchement.
const EditableBox = ({
  box,
  scale,
  label,
  selected,
  editing,
  onSelect,
  onStartEdit,
  onCommit,
  children,
}: EditableBoxProps) => {
  const gestureRef = useRef<Gesture | null>(null)
  const draftRef = useRef<QuestionLayoutBox | null>(null)
  const [draft, setDraft] = useState<QuestionLayoutBox | null>(null)
  const shown = draft ?? box

  const beginGesture = (
    e: ReactPointerEvent<HTMLElement>,
    handle: BoxHandle,
  ) => {
    if (e.button !== 0 || (editing && handle === "move")) {
      return
    }

    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    gestureRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      start: box,
      moved: false,
      wasSelected: selected,
    }
    onSelect()
  }

  const moveGesture = (e: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current

    if (!gesture) {
      return
    }

    const screenDx = e.clientX - gesture.startX
    const screenDy = e.clientY - gesture.startY

    if (!gesture.moved && Math.hypot(screenDx, screenDy) < DRAG_THRESHOLD_PX) {
      return
    }

    gesture.moved = true
    draftRef.current = moveResizeBox(
      gesture.start,
      gesture.handle,
      screenDx / scale,
      screenDy / scale,
    )
    setDraft(draftRef.current)
  }

  const endGesture = () => {
    const gesture = gestureRef.current
    gestureRef.current = null

    if (!gesture) {
      return
    }

    if (gesture.moved && draftRef.current) {
      onCommit(draftRef.current)
    } else if (gesture.handle === "move" && gesture.wasSelected) {
      // Clic simple sur une boîte déjà sélectionnée : édition du texte.
      onStartEdit?.()
    }

    draftRef.current = null
    setDraft(null)
  }

  const handleSize = HANDLE_PX / scale

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      className={clsx(
        "group pointer-events-auto absolute touch-none select-none",
        editing ? "cursor-text" : "cursor-move",
      )}
      style={{
        left: shown.x,
        top: shown.y,
        width: shown.width,
        height: shown.height,
        outline: selected
          ? `${OUTLINE_PX / scale}px solid var(--color-primary, #f97316)`
          : undefined,
        outlineOffset: selected ? OUTLINE_PX / scale : undefined,
      }}
      onPointerDown={(e) => beginGesture(e, "move")}
      onPointerMove={moveGesture}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onDoubleClick={() => onStartEdit?.()}
      onFocus={() => {
        if (!selected) {
          onSelect()
        }
      }}
    >
      {children}

      {/* Survol : contour discret pour signaler que la boîte est manipulable */}
      {!selected && (
        <div
          className="pointer-events-none absolute inset-0 hidden rounded border-white/70 group-hover:block"
          style={{ borderWidth: 1 / scale, borderStyle: "dashed" }}
        />
      )}

      {selected &&
        !editing &&
        RESIZE_HANDLES.map(({ handle, x, y }) => (
          <div
            key={handle}
            className="bg-primary absolute touch-none rounded-sm border-white shadow"
            style={{
              width: handleSize,
              height: handleSize,
              borderWidth: 1 / scale,
              left: `calc(${x * 100}% - ${handleSize / 2}px)`,
              top: `calc(${y * 100}% - ${handleSize / 2}px)`,
              cursor: HANDLE_CURSORS[handle],
            }}
            onPointerDown={(e) => beginGesture(e, handle)}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
          />
        ))}
    </div>
  )
}

// Empêche un contrôle intérieur (case « bonne réponse », IA…) de démarrer un
// déplacement de la boîte.
const stopGesture = (e: ReactPointerEvent) => e.stopPropagation()

// Champ de saisie en place : fond transparent, police et taille héritées de la
// boîte. Entrée valide, Échap annule la saisie en cours (le texte déjà tapé
// reste, comme dans les autres champs de l'éditeur).
const InlineTextInput = ({
  value,
  placeholder,
  onChange,
  onDone,
  className,
}: {
  value: string
  placeholder: string
  onChange: (_value: string) => void
  onDone: () => void
  className?: string
}) => {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current

    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [])

  // Hauteur ajustée au texte (plafonnée à la boîte) : le texte reste centré
  // verticalement comme en lecture.
  useLayoutEffect(() => {
    const el = ref.current

    if (el) {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
  }, [value])

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === "Enter" && !e.shiftKey) || e.key === "Escape") {
      e.preventDefault()
      onDone()
    }
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={handleKeyDown}
      onPointerDown={stopGesture}
      className={clsx(
        "max-h-full w-full resize-none overflow-hidden bg-transparent text-inherit outline-none placeholder:text-current placeholder:opacity-60",
        className,
      )}
      style={{ font: "inherit", lineHeight: "inherit" }}
    />
  )
}

const QuestionLayoutEditor = ({ view }: { view: SlideView }) => {
  const {
    currentQuestion: q,
    currentIndex,
    updateQuestion,
    fontFamily: quizzFont,
    selectedLayoutKey,
    setSelectedLayoutKey,
  } = useQuizzEditor()
  const { t } = useTranslation()
  const { rephrase, isRephrasing, canRephrase } = useAiRephrase()
  const [editingKey, setEditingKey] = useState<LayoutBoxKey | undefined>()
  const isMcq = q?.type === "mcq"

  // Le vrai-faux a des libellés fixes : rien à saisir.
  const startEdit = (key: LayoutBoxKey) => {
    if (key === "title" || isMcq) {
      setEditingKey(key)
    }
  }

  // La saisie en place se ferme dès que la sélection change (autre boîte,
  // élément du canvas, autre slide).
  useEffect(() => {
    setEditingKey((key) => (key === selectedLayoutKey ? key : undefined))
  }, [selectedLayoutKey, currentIndex])

  const commitBox = (key: LayoutBoxKey, patch: Partial<QuestionLayoutBox>) => {
    updateQuestion(currentIndex, { layout: updateLayoutBox(q, key, patch) })
  }

  // Raccourcis de la boîte sélectionnée : flèches (1 px, Maj : 10 px),
  // Entrée pour éditer le texte, Échap pour désélectionner.
  const keyStateRef = useRef({ q, selectedLayoutKey, editingKey, startEdit })
  keyStateRef.current = { q, selectedLayoutKey, editingKey, startEdit }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { selectedLayoutKey: key, editingKey: editing } =
        keyStateRef.current
      const target = e.target as HTMLElement | null
      const tag = target?.tagName.toLowerCase()

      if (
        key === undefined ||
        editing !== undefined ||
        e.defaultPrevented ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector("[aria-modal=true], dialog[open]")
      ) {
        return
      }

      if (e.key === "Escape") {
        setSelectedLayoutKey(undefined)

        return
      }

      if (e.key === "Enter") {
        e.preventDefault()
        keyStateRef.current.startEdit(key)

        return
      }

      const step = e.shiftKey ? 10 : 1
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      }
      const delta = deltas[e.key]

      if (!delta) {
        return
      }

      e.preventDefault()
      const current = keyStateRef.current.q
      const full = materializeLayout(current)
      const box = key === "title" ? full.title : full.answers?.[key]

      if (box) {
        updateQuestion(currentIndex, {
          layout: updateLayoutBox(current, key, {
            x: box.x + delta[0],
            y: box.y + delta[1],
          }),
        })
      }
    }

    window.addEventListener("keydown", handler)

    return () => window.removeEventListener("keydown", handler)
  }, [currentIndex])

  if (!q || q.type === "title") {
    return null
  }

  const font = resolveQuestionFont(q, { fontFamily: quizzFont })
  const layout = materializeLayout(q)
  const answerCount = hasLayoutAnswers(q.type) ? layoutAnswerCount(q) : 0
  const mcq = q as McqQuestion
  const trueFalse = q as TrueFalseQuestion

  const answerText = (index: number) => {
    if (isMcq) {
      return mcq.answers[index] ?? ""
    }

    return index === 0 ? t("quizz:trueFalseFalse") : t("quizz:trueFalseTrue")
  }

  const isCorrect = (index: number) =>
    isMcq ? mcq.solutions.includes(index) : trueFalse.solution === index

  const toggleCorrect = (index: number) => {
    if (!isMcq) {
      updateQuestion(currentIndex, { solution: index as 0 | 1 })

      return
    }

    const current = mcq.solutions

    if (current.includes(index)) {
      const next = current.filter((s) => s !== index)
      updateQuestion(currentIndex, {
        solutions: next.length > 0 ? next : [index],
      })
    } else {
      updateQuestion(currentIndex, { solutions: [...current, index] })
    }
  }

  const updateAnswerText = (index: number, value: string) => {
    const next = [...mcq.answers]
    next[index] = value
    updateQuestion(currentIndex, { answers: next })
  }

  const controlPx = 28 / view.scale
  const titleBox = layout.title!

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-30"
      style={{
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        transformOrigin: "top left",
      }}
    >
      <EditableBox
        box={titleBox}
        scale={view.scale}
        label={t("quizz:question.layout.titleBox")}
        selected={selectedLayoutKey === "title"}
        editing={editingKey === "title"}
        onSelect={() => setSelectedLayoutKey("title")}
        onStartEdit={() => startEdit("title")}
        onCommit={(box) => commitBox("title", box)}
      >
        <TitleBoxView box={titleBox} fontFamily={font}>
          {editingKey === "title" ? (
            <InlineTextInput
              value={q.question}
              placeholder={t("quizz:question.placeholder")}
              onChange={(value) =>
                updateQuestion(currentIndex, { question: value })
              }
              onDone={() => setEditingKey(undefined)}
              className="text-center font-bold"
            />
          ) : (
            <h2
              className={clsx(
                "leading-tight font-bold break-words drop-shadow-lg",
                !q.question && "italic opacity-60",
              )}
            >
              {q.question || t("quizz:question.placeholder")}
            </h2>
          )}
        </TitleBoxView>

        {selectedLayoutKey === "title" && editingKey !== "title" && (
          <button
            type="button"
            onPointerDown={stopGesture}
            onClick={rephrase}
            disabled={isRephrasing || !canRephrase}
            title={t("quizz:question.aiRephrase", "Reformuler par IA")}
            aria-label={t("quizz:question.aiRephrase", "Reformuler par IA")}
            className="text-primary absolute flex items-center justify-center rounded-lg bg-white shadow-md transition-opacity disabled:opacity-40"
            style={{
              width: controlPx,
              height: controlPx,
              top: -controlPx - 6 / view.scale,
              right: 0,
            }}
          >
            {isRephrasing ? (
              <Loader2 className="size-1/2 animate-spin" />
            ) : (
              <Sparkles className="size-1/2" />
            )}
          </button>
        )}
      </EditableBox>

      {Array.from({ length: answerCount }, (_, index) => {
        const box = layout.answers![index]!
        const text = answerText(index)
        const correct = isCorrect(index)

        return (
          <EditableBox
            key={index}
            box={box}
            scale={view.scale}
            label={t("quizz:question.layout.answerBox", { number: index + 1 })}
            selected={selectedLayoutKey === index}
            editing={editingKey === index}
            onSelect={() => setSelectedLayoutKey(index)}
            onStartEdit={() => startEdit(index)}
            onCommit={(next) => commitBox(index, next)}
          >
            <AnswerBoxView
              index={index}
              box={box}
              text={text || t("quizz:addAnswerPlaceholder")}
              fontFamily={font}
              trailing={
                <button
                  type="button"
                  onPointerDown={stopGesture}
                  onClick={() => toggleCorrect(index)}
                  aria-pressed={correct}
                  title={t("quizz:markCorrect", "Marquer comme correcte")}
                  className={clsx(
                    "flex shrink-0 items-center justify-center rounded-full border-current transition-colors",
                    correct ? "bg-white text-green-600" : "bg-transparent",
                  )}
                  style={{
                    // Jamais plus haute que la case (boîte très aplatie).
                    width: Math.min(controlPx, box.height * 0.7),
                    height: Math.min(controlPx, box.height * 0.7),
                    borderWidth: 2 / view.scale,
                    borderColor: correct ? "#ffffff" : undefined,
                  }}
                >
                  {correct && <Check className="size-2/3" strokeWidth={3} />}
                </button>
              }
            >
              {editingKey === index ? (
                <InlineTextInput
                  value={text}
                  placeholder={t("quizz:addAnswerPlaceholder")}
                  onChange={(value) => updateAnswerText(index, value)}
                  onDone={() => setEditingKey(undefined)}
                />
              ) : (
                <span className={clsx(!text && "italic opacity-60")}>
                  {text || t("quizz:addAnswerPlaceholder")}
                </span>
              )}
            </AnswerBoxView>
          </EditableBox>
        )
      })}
    </div>
  )
}

export default QuestionLayoutEditor
