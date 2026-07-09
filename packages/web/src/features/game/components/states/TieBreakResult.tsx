import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import { Trophy } from "lucide-react"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["SHOW_TIE_BREAK_RESULT"]
}

const TieBreakResult = ({ data: { winnerName } }: Props) => {
  const { t } = useTranslation()

  return (
    <section className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4">
      <Trophy className="anim-pop-in size-16 text-yellow-400" />

      <h2 className="anim-slide-up text-center text-3xl font-black text-white drop-shadow-lg md:text-4xl">
        {winnerName
          ? t("game:tieBreak.winner", "{{name}} remporte le duel !", {
              name: winnerName,
            })
          : t(
              "game:tieBreak.noWinner",
              "Personne n'a trouvé à temps — égalité conservée.",
            )}
      </h2>
    </section>
  )
}

export default TieBreakResult
