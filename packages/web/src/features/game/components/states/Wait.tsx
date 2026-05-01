import type { PlayerStatusDataMap } from "@rahoot/common/types/game/status"
import Loader from "@rahoot/web/components/Loader"
import { useTranslation } from "react-i18next"

type Props = {
  data: PlayerStatusDataMap["WAIT"]
}

const Wait = ({ data: { text } }: Props) => {
  const { t } = useTranslation()

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center">
      <div className="anim-pop-in">
        <Loader className="h-30 anim-wiggle" />
      </div>
      <h2 className="anim-slide-up mt-5 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
        {t(text)}
      </h2>
      <div className="dot-loader mt-4 text-white" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  )
}

export default Wait
