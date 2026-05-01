import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import CricleCheck from "@rahoot/web/features/game/components/icons/CricleCheck"
import CricleXmark from "@rahoot/web/features/game/components/icons/CricleXmark"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["SHOW_RESULT"]
}

const Result = ({
  data: { correct, message, points, myPoints, rank, aheadOfMe },
}: Props) => {
  const player = usePlayerStore()
  const { t } = useTranslation()
  const rankKeyMap: Record<number, string> = {
    1: "game:rank.1",
    2: "game:rank.2",
    3: "game:rank.3",
  }
  const rankKey = rankKeyMap[rank] ?? "game:rank.other"

  const [sfxResults] = useSound(SFX.RESULTS_SOUND, {
    volume: 0.2,
  })

  useEffect(() => {
    player.updatePoints(myPoints)

    sfxResults()
  }, [sfxResults])

  return (
    <section
      className={`relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center ${correct ? "anim-pop-in" : "anim-shake"}`}
    >
      <div className="anim-pop-in" style={{ animationDelay: "0.05s" }}>
        {correct ? (
          <CricleCheck className="aspect-square max-h-60 w-full" />
        ) : (
          <CricleXmark className="aspect-square max-h-60 w-full" />
        )}
      </div>
      <h2 className="anim-slide-up mt-1 text-4xl font-bold text-white drop-shadow-lg" style={{ animationDelay: "0.2s" }}>
        {t(message)}
      </h2>
      <p className="anim-slide-up mt-1 text-xl font-bold text-white drop-shadow-lg" style={{ animationDelay: "0.3s" }}>
        {t("game:resultTop")}
        {t(rankKey, { rank })}
        {aheadOfMe ? `${t("game:resultBehind")}${aheadOfMe}` : ""}
      </p>
      {correct && (
        <span
          className="anim-float-up mt-2 rounded bg-black/40 px-4 py-2 text-3xl font-black text-yellow-300 drop-shadow-lg"
          style={{ animationDelay: "0.4s" }}
        >
          +{points}
        </span>
      )}
    </section>
  )
}

export default Result
