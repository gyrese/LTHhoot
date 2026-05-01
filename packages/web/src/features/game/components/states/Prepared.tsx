import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import dateImg from "@rahoot/web/assets/game/types/date.png"
import dropPinImg from "@rahoot/web/assets/game/types/drop_pin.png"
import mcqImg from "@rahoot/web/assets/game/types/mcq.png"
import openImg from "@rahoot/web/assets/game/types/open.png"
import puzzleImg from "@rahoot/web/assets/game/types/puzzle.png"
import sliderImg from "@rahoot/web/assets/game/types/slider.png"
import trueFalseImg from "@rahoot/web/assets/game/types/true_false.png"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["SHOW_PREPARED"]
}

const TYPE_ASSETS: Record<string, string> = {
  open: openImg,
  date: dateImg,
  slider: sliderImg,
  mcq: mcqImg,
  true_false: trueFalseImg,
  puzzle: puzzleImg,
  drop_pin: dropPinImg,
}

const Prepared = ({ data: { questionNumber, type } }: Props) => {
  const { t } = useTranslation()
  const image = TYPE_ASSETS[type]

  return (
    <section className="anim-show relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center">
      <h2 className="anim-show mb-20 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
        {t("game:questionPrefix")}
        {questionNumber}
      </h2>

      <div className="anim-show relative aspect-square w-64 overflow-hidden rounded-3xl bg-white/5 p-4 shadow-2xl backdrop-blur-md border border-white/10 md:w-80">
        {image ? (
          <img
            src={image}
            alt={type}
            className="h-full w-full object-contain drop-shadow-2xl"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-8xl text-white opacity-20">
            ?
          </div>
        )}
      </div>
    </section>
  )
}

export default Prepared
