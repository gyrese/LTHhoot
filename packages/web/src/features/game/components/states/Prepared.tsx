import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import CalendarIcon from "@rahoot/web/features/game/components/icons/CalendarIcon"
import PencilText from "@rahoot/web/features/game/components/icons/PencilText"
import SliderIcon from "@rahoot/web/features/game/components/icons/SliderIcon"
import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
} from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import { createElement } from "react"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["SHOW_PREPARED"]
}

const TYPE_ICONS: Record<string, { icon: React.FC<{ className?: string }>; bg: string; label: string }> = {
  open: { icon: PencilText, bg: "bg-yellow-500", label: "game:typeOpen" },
  date: { icon: CalendarIcon, bg: "bg-blue-500", label: "game:typeDate" },
  slider: { icon: SliderIcon, bg: "bg-purple-500", label: "game:typeSlider" },
}

const Prepared = ({ data: { totalAnswers, questionNumber, type } }: Props) => {
  const { t } = useTranslation()

  const specialType = TYPE_ICONS[type]

  return (
    <section className="anim-show relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center">
      <h2 className="anim-show mb-20 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
        {t("game:questionPrefix")}
        {questionNumber}
      </h2>

      {totalAnswers > 0 ? (
        <div className="anim-quizz grid aspect-square w-60 grid-cols-2 gap-4 rounded-2xl bg-gray-700 p-5 md:w-60">
          {[...Array(totalAnswers)].map((_, key) => (
            <div
              key={key}
              className={clsx(
                "button shadow-inset flex aspect-square h-full w-full items-center justify-center rounded-2xl",
                ANSWERS_COLORS[key],
              )}
            >
              {createElement(ANSWERS_ICONS[key], { className: "h-10 md:h-14" })}
            </div>
          ))}
        </div>
      ) : specialType ? (
        <div className={clsx("anim-show flex aspect-square w-60 flex-col items-center justify-center gap-4 rounded-2xl", specialType.bg)}>
          {createElement(specialType.icon, { className: "h-20 md:h-24" })}
        </div>
      ) : (
        <div className="anim-show flex aspect-square w-60 items-center justify-center rounded-2xl bg-white/10 text-8xl text-white">
          ?
        </div>
      )}
    </section>
  )
}

export default Prepared
