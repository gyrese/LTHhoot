import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import CricleCheck from "@rahoot/web/features/game/components/icons/CricleCheck"
import CricleXmark from "@rahoot/web/features/game/components/icons/CricleXmark"
import AnimatedPoints from "@rahoot/web/features/game/components/AnimatedPoints"
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

  const [sfxCorrect] = useSound(SFX.RESULTS_SOUND, { volume: 0.3 })
  const [sfxWrong] = useSound(SFX.BOUMP_SOUND, { volume: 0.3 })

  const startPoints = myPoints - points

  useEffect(() => {
    // On met à jour le store après un petit délai pour laisser l'animation locale se faire
    const timer = setTimeout(() => {
      player.updatePoints(myPoints)
    }, 2000)

    if (correct) {
      sfxCorrect()
    } else {
      sfxWrong()
    }

    return () => clearTimeout(timer)
  }, [myPoints, points])

  return (
    <section
      className={`relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-2 px-4 ${correct ? "anim-pop-in" : "anim-shake"}`}
    >
      {/* Icône — taille plafonnée pour ne pas écraser le texte sur petits écrans */}
      <div className="anim-pop-in" style={{ animationDelay: "0.05s" }}>
        {correct ? (
          <CricleCheck className="aspect-square w-full max-w-[min(45vw,180px)]" />
        ) : (
          <CricleXmark className="aspect-square w-full max-w-[min(45vw,180px)]" />
        )}
      </div>

      {/* Message principal */}
      <h2
        className="anim-slide-up text-center text-3xl font-bold text-white drop-shadow-lg sm:text-4xl"
        style={{ animationDelay: "0.2s" }}
      >
        {t(message)}
      </h2>

      {/* Score Total Animé */}
      <div
        className="anim-slide-up flex flex-col items-center gap-0"
        style={{ animationDelay: "0.4s" }}
      >
        <span className="text-sm font-bold tracking-widest text-white/60 uppercase">
          {t("game:totalScore", "Score Total")}
        </span>
        <AnimatedPoints
          from={startPoints}
          to={myPoints}
          delay={0.8}
          className="text-5xl font-black text-white drop-shadow-lg"
        />
      </div>

      {/* Classement */}
      <p
        className="anim-slide-up text-center text-base font-bold text-white/80 drop-shadow-lg sm:text-xl"
        style={{ animationDelay: "0.5s" }}
      >
        {t("game:resultTop")}
        {t(rankKey, { rank })}
        {aheadOfMe ? ` • ${t("game:resultBehind")}${aheadOfMe}` : ""}
      </p>

      {/* Points gagnés — flottants vers le haut */}
      {correct && points > 0 && (
        <span
          className="anim-float-up absolute top-1/2 rounded-xl bg-black/50 px-5 py-2 text-3xl font-black text-yellow-300 ring-1 ring-yellow-300/30 drop-shadow-lg"
          style={{ animationDelay: "0.6s" }}
        >
          +{points}
        </span>
      )}
    </section>
  )
}

export default Result
