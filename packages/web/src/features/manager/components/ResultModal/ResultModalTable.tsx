import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
} from "@rahoot/web/features/game/utils/constants"
import { useResultModal } from "@rahoot/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

const ResultModalTable = () => {
  const { questionResult, getPlayerPoints } = useResultModal()
  const { t } = useTranslation()

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 shadow-sm">
        <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
          <th className="px-5 py-2.5">{t("manager:result.table.player")}</th>
          <th className="px-4 py-2.5">{t("manager:result.table.answered")}</th>
          <th className="px-4 py-2.5">
            {t("manager:result.table.correctIncorrect")}
          </th>
          <th className="px-4 py-2.5 text-right">
            {t("manager:result.table.points")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {questionResult.playerAnswers.map((pa, i) => {
          const isCorrect = pa.points > 0
          const hasMcqAnswer = pa.answerId !== null && pa.answerId !== undefined && questionResult.type === "mcq"
          const mcqAnswers = questionResult.type === "mcq" ? questionResult.answers : []
          const AnswerIcon = pa.answerId !== null && pa.answerId !== undefined ? ANSWERS_ICONS[pa.answerId % 4] : null

          return (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-5 py-2.5 font-medium">{pa.playerName}</td>
              <td className="px-4 py-2.5">
                {(() => {
                  if (hasMcqAnswer && AnswerIcon) {
                    return (
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white",
                          ANSWERS_COLORS[pa.answerId! % 4],
                        )}
                      >
                        <AnswerIcon className="size-3" />
                        <span className="max-w-30 truncate">{mcqAnswers[pa.answerId!]}</span>
                      </span>
                    )
                  }

                  if (pa.textAnswer !== null && pa.textAnswer !== undefined) {
                    return <span className="text-xs text-gray-700">{pa.textAnswer}</span>
                  }

                  if (pa.numberAnswer !== null && pa.numberAnswer !== undefined) {
                    return <span className="text-xs text-gray-700">{pa.numberAnswer}</span>
                  }

                  if (pa.answerId !== null && pa.answerId !== undefined) {
                    return <span className="text-xs text-gray-700">{pa.answerId === 1 ? "Vrai" : "Faux"}</span>
                  }

                  return <span className="text-xs text-gray-400">—</span>
                })()}
              </td>
              <td className="px-4 py-2.5">
                {isCorrect ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="size-3.5" />{" "}
                    {t("manager:result.table.correct")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500">
                    <X className="size-3.5" />{" "}
                    {t("manager:result.table.incorrect")}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-700">
                {getPlayerPoints(pa.playerName)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default ResultModalTable
