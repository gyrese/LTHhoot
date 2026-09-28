import type {
  QuestionLayout,
  QuestionLayoutBox,
} from "@rahoot/common/types/game"
import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
  isDarkTextAnswer,
} from "@rahoot/web/features/game/utils/constants"
import { answerEntrance } from "@rahoot/web/features/game/utils/motion"
import {
  answerBoxAt,
  DARK_ANSWER_TEXT,
  DEFAULT_TITLE_FONT_SIZE,
  fontFamilyCss,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
} from "@rahoot/web/features/game/utils/question-layout"
import clsx from "clsx"
import { motion, useReducedMotion } from "motion/react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
} from "react"

// ─── Rendu partagé de la mise en page libre ──────────────────────────────────
// Utilisé tel quel par l'écran hôte, l'aperçu de l'éditeur et (pour le visuel
// des boîtes) l'éditeur lui-même : une boîte a donc exactement le même rendu
// partout, seule l'échelle change.

// Cadre 1920×1080 mis à l'échelle dans son parent (qu'il remplit), avec la
// même règle d'ajustement que `SlideCanvas` (contain, centré, taille arrondie)
// pour tomber au pixel près sur les éléments de la diapositive.
export const SlideFrame = ({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) => {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current

    if (!el) {
      return undefined
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  const fit = Math.min(size.width / SLIDE_WIDTH, size.height / SLIDE_HEIGHT)
  const frameW = Math.round(SLIDE_WIDTH * fit)
  const frameH = Math.round(SLIDE_HEIGHT * fit)
  const scale = frameW / SLIDE_WIDTH

  return (
    <div
      ref={ref}
      className={clsx("pointer-events-none absolute inset-0", className)}
    >
      {size.width > 0 && size.height > 0 && (
        <div
          className="absolute"
          style={{
            left: (size.width - frameW) / 2,
            top: (size.height - frameH) / 2,
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Ajustement automatique de la taille du texte ────────────────────────────
// Le texte prend la plus grande taille (≤ `max`) qui tient entièrement dans sa
// boîte : une question longue n'est plus jamais tronquée, dans l'éditeur comme
// en jeu. Mesure faite dans le repère 1920×1080 (la mise à l'échelle CSS du
// cadre ne change pas les dimensions de mise en page).

const MIN_FIT_FONT_SIZE = 12
export const DEFAULT_ANSWER_MAX_FONT_SIZE = 36

type FitGroupValue = {
  cap?: number
  report: (_id: string, _size: number) => void
  forget: (_id: string) => void
}

const FitGroupContext = createContext<FitGroupValue | null>(null)

// Groupe de boîtes partageant la même taille de texte (celle de la plus
// contrainte) : les cases de réponse d'une question restent homogènes.
export const FitGroup = ({ children }: PropsWithChildren) => {
  const [sizes, setSizes] = useState<Record<string, number>>({})

  const report = useCallback((id: string, size: number) => {
    setSizes((prev) => (prev[id] === size ? prev : { ...prev, [id]: size }))
  }, [])

  const forget = useCallback((id: string) => {
    setSizes((prev) => {
      if (!(id in prev)) {
        return prev
      }

      const next = { ...prev }
      delete next[id]

      return next
    })
  }, [])

  const values = Object.values(sizes)
  const cap = values.length > 0 ? Math.min(...values) : undefined
  const value = useMemo(() => ({ cap, report, forget }), [cap, report, forget])

  return (
    <FitGroupContext.Provider value={value}>
      {children}
    </FitGroupContext.Provider>
  )
}

// Applique directement au nœud la taille qui tient (recherche dichotomique),
// recalculée si le texte, la boîte ou la police changent. `grouped` : la
// taille finale est plafonnée par celle du groupe.
const useFitFontSize = (
  ref: RefObject<HTMLElement | null>,
  max: number,
  fitKey: string,
  grouped: boolean,
) => {
  const group = useContext(FitGroupContext)
  const id = useId()
  const fitted = useRef(max)
  const activeGroup = grouped ? group : null
  const cap = activeGroup?.cap
  const report = activeGroup?.report
  const forget = activeGroup?.forget

  useLayoutEffect(() => {
    const el = ref.current

    if (!el) {
      return undefined
    }

    const fits = (size: number) => {
      el.style.fontSize = `${size}px`

      return (
        el.scrollHeight <= el.clientHeight + 1 &&
        el.scrollWidth <= el.clientWidth + 1
      )
    }

    const measure = () => {
      let best = MIN_FIT_FONT_SIZE

      if (fits(max)) {
        best = max
      } else {
        let low = MIN_FIT_FONT_SIZE
        let high = max - 1

        while (low <= high) {
          const mid = Math.floor((low + high) / 2)

          if (fits(mid)) {
            best = mid
            low = mid + 1
          } else {
            high = mid - 1
          }
        }
      }

      fitted.current = best
      el.style.fontSize = `${Math.min(best, cap ?? best)}px`
      report?.(id, best)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    // Une police web arrivée après coup change la place occupée par le texte.
    void document.fonts?.ready.then(measure)

    return () => observer.disconnect()
  }, [ref, max, fitKey, cap, report, id])

  useEffect(() => () => forget?.(id), [forget, id])
}

export const boxPositionStyle = (box: QuestionLayoutBox): CSSProperties => ({
  position: "absolute",
  left: box.x,
  top: box.y,
  width: box.width,
  height: box.height,
})

// Visuel du titre (remplit son parent). Sans fond personnalisé : panneau glass
// de l'écran hôte.
export const TitleBoxView = ({
  box,
  fontFamily,
  fitKey,
  children,
  className,
}: PropsWithChildren<{
  box: QuestionLayoutBox
  fontFamily?: string
  // Texte affiché : relance l'ajustement de la taille quand il change.
  fitKey: string
  className?: string
}>) => {
  const ref = useRef<HTMLDivElement>(null)
  useFitFontSize(
    ref,
    box.fontSize ?? DEFAULT_TITLE_FONT_SIZE,
    `${fitKey}|${fontFamily}|${box.width}x${box.height}`,
    false,
  )

  return (
    <div
      ref={ref}
      className={clsx(
        "flex size-full items-center justify-center overflow-hidden rounded-2xl px-6 py-4 text-center",
        !box.fill && "bg-black/50 backdrop-blur-md",
        className,
      )}
      style={{
        backgroundColor: box.fill,
        color: box.textColor ?? "#ffffff",
        fontFamily: fontFamilyCss(fontFamily),
      }}
    >
      {children}
    </div>
  )
}

// Visuel d'une case de réponse (remplit son parent), fidèle à `AnswerButton` :
// couleur Kahoot + forme + texte, sauf surcharge de fond / texte / taille.
export const AnswerBoxView = ({
  index,
  box,
  text,
  fontFamily,
  children,
  trailing,
  className,
}: {
  index: number
  box: QuestionLayoutBox
  text: string
  fontFamily?: string
  children?: ReactNode
  trailing?: ReactNode
  className?: string
}) => {
  const Icon = ANSWERS_ICONS[index % ANSWERS_ICONS.length]!
  const darkDefault = !box.fill && isDarkTextAnswer(index)
  const color = box.textColor ?? (darkDefault ? DARK_ANSWER_TEXT : "#ffffff")
  const ref = useRef<HTMLDivElement>(null)
  // Taille automatique : partagée par toutes les cases de la question.
  useFitFontSize(
    ref,
    box.fontSize ?? DEFAULT_ANSWER_MAX_FONT_SIZE,
    `${text}|${fontFamily}|${box.width}x${box.height}`,
    box.fontSize === undefined,
  )

  return (
    <div
      ref={ref}
      className={clsx(
        "shadow-inset flex size-full items-center gap-3 overflow-hidden rounded px-4",
        !box.fill && ANSWERS_COLORS[index % ANSWERS_COLORS.length],
        className,
      )}
      style={{
        backgroundColor: box.fill,
        color,
        fontFamily: fontFamilyCss(fontFamily),
      }}
    >
      <span
        className="flex shrink-0"
        style={{ width: "max(24px, 0.75em)", height: "max(24px, 0.75em)" }}
      >
        <Icon className="size-full" fill={color} />
      </span>
      <div
        className="min-w-0 flex-1 leading-tight font-black tracking-tight break-words"
        style={
          color === DARK_ANSWER_TEXT
            ? undefined
            : { textShadow: "0 2px 4px rgba(0,0,0,0.3)" }
        }
      >
        {children ?? text}
      </div>
      {trailing}
    </div>
  )
}

// Titre positionné (écran hôte / aperçu).
export const PositionedTitle = ({
  box,
  text,
  fontFamily,
}: {
  box: QuestionLayoutBox
  text: string
  fontFamily?: string
}) => (
  <div style={boxPositionStyle(box)}>
    <TitleBoxView box={box} fontFamily={fontFamily} fitKey={text}>
      <h2 className="anim-show leading-tight font-bold break-words drop-shadow-lg">
        {text}
      </h2>
    </TitleBoxView>
  </div>
)

// Cases de réponse positionnées (écran hôte / aperçu). `animated` : apparition
// « glissé + rebond » l'une après l'autre (écran hôte uniquement).
export const PositionedAnswers = ({
  layout,
  labels,
  fontFamily,
  animated = false,
}: {
  layout: QuestionLayout
  labels: string[]
  fontFamily?: string
  animated?: boolean
}) => {
  const reduceMotion = useReducedMotion() ?? false

  return (
    <FitGroup>
      {labels.map((label, index) => {
        const box = answerBoxAt(layout, index, labels.length)

        return (
          <motion.div
            key={index}
            style={boxPositionStyle(box)}
            {...(animated ? answerEntrance(index, reduceMotion) : {})}
          >
            <AnswerBoxView
              index={index}
              box={box}
              text={label}
              fontFamily={fontFamily}
            />
          </motion.div>
        )
      })}
    </FitGroup>
  )
}

// Calque complet (titre et/ou réponses positionnés) posé sur la slide ; rien
// si la question n'a pas de mise en page libre. `answerLabels` : cf.
// `layoutAnswerLabels` (null → réponses non positionnables).
export const QuestionLayoutOverlay = ({
  layout,
  title,
  answerLabels,
  fontFamily,
  animated = false,
}: {
  layout?: QuestionLayout
  title: string
  answerLabels: string[] | null
  fontFamily?: string
  animated?: boolean
}) => {
  const titleBox = layout?.title
  const labels = layout?.answers ? answerLabels : null

  if (!layout || (!titleBox && !labels)) {
    return null
  }

  return (
    <SlideFrame className="z-10">
      {titleBox && (
        <PositionedTitle box={titleBox} text={title} fontFamily={fontFamily} />
      )}
      {labels && (
        <PositionedAnswers
          key={title}
          layout={layout}
          labels={labels}
          fontFamily={fontFamily}
          animated={animated}
        />
      )}
    </SlideFrame>
  )
}
