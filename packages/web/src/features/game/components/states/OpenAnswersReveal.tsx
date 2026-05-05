import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["SHOW_OPEN_ANSWERS"]
}

const OpenAnswersReveal = ({ data: { question, answers, totalPlayers } }: Props) => {
  const { t } = useTranslation()
  const answered = answers.length
  const noAnswer = totalPlayers - answered

  return (
    <div className="flex flex-1 flex-col items-center gap-5 px-4 py-6 overflow-y-auto pb-20">
      <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
        {question}
      </h2>

      <p className="text-xs font-bold uppercase tracking-widest text-white/40">
        {answered} / {totalPlayers} {t("game:openAnswers.players")}
      </p>

      <div className="flex w-full max-w-4xl flex-wrap justify-center gap-3">
        {answers.map((answer, i) => (
          <div
            key={`${answer.playerName}-${i}`}
            className={clsx(
              "flex flex-col items-center gap-1 rounded-2xl px-5 py-3 text-center shadow-xl transition-all duration-500",
              answer.isCorrect
                ? "anim-pop-in scale-105 bg-green-500 ring-4 ring-green-300/60 drop-shadow-[0_0_16px_rgba(34,197,94,0.7)]"
                : "bg-white/10 backdrop-blur-md ring-1 ring-white/20",
            )}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <span className="text-lg font-black text-white">
              {answer.isCorrect && "✓ "}{answer.text}
            </span>
            <span className={clsx("text-xs font-semibold", answer.isCorrect ? "text-white/80" : "text-white/50")}>
              {answer.playerName}
            </span>
          </div>
        ))}

        {noAnswer > 0 && (
          <div className="flex flex-col items-center gap-1 rounded-2xl px-5 py-3 text-center bg-white/5 ring-1 ring-white/10">
            <span className="text-lg font-black text-white/30">—</span>
            <span className="text-xs font-semibold text-white/30">
              {noAnswer} {t("game:openAnswers.noAnswer")}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default OpenAnswersReveal
