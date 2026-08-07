import { useResultModal } from "@rahoot/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"

const LEVEL_STYLES = {
  info: "bg-blue-100 text-blue-700",
  warn: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
}

const LEVEL_LABELS = {
  info: "INFO",
  warn: "WARN",
  error: "ERR",
}

const formatTime = (timestamp: number) => {
  const d = new Date(timestamp)

  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  })
}

const ResultModalLogs = () => {
  const { result } = useResultModal()
  const logs = result.logs ?? []

  if (logs.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-gray-400 italic">
        Aucun log disponible pour cette partie.
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-gray-50">
        <tr className="border-b border-gray-200 text-left text-xs font-semibold tracking-wider text-gray-500 uppercase">
          <th className="w-36 px-4 py-2">Heure</th>
          <th className="w-16 px-3 py-2">Niveau</th>
          <th className="px-4 py-2">Message</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 font-mono">
        {logs.map((entry) => (
          <tr
            key={entry.id}
            className={clsx(
              "text-xs",
              entry.level === "error" && "bg-red-50",
              entry.level === "warn" && "bg-yellow-50",
            )}
          >
            <td className="px-4 py-1.5 whitespace-nowrap text-gray-400">
              {formatTime(entry.timestamp)}
            </td>
            <td className="px-3 py-1.5">
              <span
                className={clsx(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                  LEVEL_STYLES[entry.level],
                )}
              >
                {LEVEL_LABELS[entry.level]}
              </span>
            </td>
            <td className="px-4 py-1.5 break-all text-gray-700">
              {entry.message}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default ResultModalLogs
