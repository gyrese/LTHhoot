import {
  ROUND_EVENT_TYPE,
  type RoundEventType,
} from "@rahoot/common/types/round-event"

type RoundEventMeta = {
  icon: string
  labelKey: string
  hintKey: string
  // Classes Tailwind du bandeau d'annonce / badge / pastille du drawer.
  accent: string
  border: string
  text: string
}

export const ROUND_EVENT_META: Record<RoundEventType, RoundEventMeta> = {
  [ROUND_EVENT_TYPE.DOUBLE_POINTS]: {
    icon: "⚡",
    labelKey: "game:roundEvent.doublePoints",
    hintKey: "game:roundEvent.doublePointsHint",
    accent: "bg-orange-500/20",
    border: "border-orange-400/50",
    text: "text-orange-300",
  },
  [ROUND_EVENT_TYPE.SUDDEN_DEATH]: {
    icon: "💀",
    labelKey: "game:roundEvent.suddenDeath",
    hintKey: "game:roundEvent.suddenDeathHint",
    accent: "bg-red-500/20",
    border: "border-red-400/50",
    text: "text-red-300",
  },
}

export const ROUND_EVENT_LIST: RoundEventType[] = [
  ROUND_EVENT_TYPE.DOUBLE_POINTS,
  ROUND_EVENT_TYPE.SUDDEN_DEATH,
]
