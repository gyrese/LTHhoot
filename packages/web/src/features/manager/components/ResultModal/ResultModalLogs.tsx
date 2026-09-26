import { useResultModal } from "@rahoot/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

const LEVEL_STYLES = {
  info: "bg-blue-500/20 text-blue-300",
  warn: "bg-yellow-500/20 text-yellow-300",
  error: "bg-red-500/20 text-red-300",
}

const LEVEL_LABELS = {
  info: "INFO",
  warn: "WARN",
  error: "ERR",
}

const formatTime = (timestamp: number, locale: string) => {
  const d = new Date(timestamp)

  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  })
}

const ResultModalLogs = () => {
  const { result } = useResultModal()
  const { t, i18n } = useTranslation()
  const logs = result.logs ?? []

  if (logs.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/60 italic">
        {t("manager:result.logs.none")}
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-slate-900">
        <tr className="border-b border-white/10 text-left text-xs font-semibold tracking-wider text-white/60 uppercase">
          <th className="w-36 px-4 py-2">{t("manager:result.logs.time")}</th>
          <th className="w-16 px-3 py-2">{t("manager:result.logs.level")}</th>
          <th className="px-4 py-2">{t("manager:result.logs.message")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5 font-mono">
        {logs.map((entry) => (
          <tr
            key={entry.id}
            className={clsx(
              "text-xs",
              entry.level === "error" && "bg-red-500/10",
              entry.level === "warn" && "bg-yellow-500/10",
            )}
          >
            <td className="px-4 py-1.5 whitespace-nowrap text-white/60">
              {formatTime(entry.timestamp, i18n.language)}
            </td>
            <td className="px-3 py-1.5">
              <span
                className={clsx(
                  "rounded px-1.5 py-0.5 text-[11px] font-bold",
                  LEVEL_STYLES[entry.level],
                )}
              >
                {LEVEL_LABELS[entry.level]}
              </span>
            </td>
            <td className="px-4 py-1.5 break-all text-white/80">
              {entry.message}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default ResultModalLogs
