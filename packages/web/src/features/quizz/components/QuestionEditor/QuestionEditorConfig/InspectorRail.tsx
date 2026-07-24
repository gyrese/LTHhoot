import {
  type InspectorPanel,
  useQuizzEditor,
} from "@rahoot/web/features/quizz/contexts/quizz-editor-context"
import {
  Layers,
  MousePointerClick,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"
import type { ReactNode } from "react"
import clsx from "clsx"

type RailItem = {
  panel: InspectorPanel
  label: string
  icon: ReactNode
}

const ITEMS: RailItem[] = [
  {
    panel: "settings",
    label: "Réglages",
    icon: <SlidersHorizontal className="size-4" />,
  },
  {
    panel: "appearance",
    label: "Apparence",
    icon: <Sparkles className="size-4" />,
  },
  { panel: "layers", label: "Calques", icon: <Layers className="size-4" /> },
  {
    panel: "element",
    label: "Élément",
    icon: <MousePointerClick className="size-4" />,
  },
]

const InspectorRail = () => {
  const { activeInspectorPanel, setActiveInspectorPanel, selectedId } =
    useQuizzEditor()

  return (
    <div className="border-border bg-surface flex w-11 shrink-0 flex-col gap-1 border-l p-1.5">
      {ITEMS.map((item) => {
        const isActive = activeInspectorPanel === item.panel
        const showBadge = item.panel === "element" && Boolean(selectedId)

        return (
          <button
            key={item.panel}
            onClick={() => setActiveInspectorPanel(item.panel)}
            title={item.label}
            aria-label={item.label}
            aria-pressed={isActive}
            className={clsx(
              "focus-ring relative flex size-9 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-primary-soft text-primary-ink"
                : "text-ink-subtle hover:bg-panel hover:text-ink",
            )}
          >
            {item.icon}
            {showBadge && !isActive && (
              <span className="bg-primary absolute -top-0.5 -right-0.5 size-2 rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default InspectorRail
