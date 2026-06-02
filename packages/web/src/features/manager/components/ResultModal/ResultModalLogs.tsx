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
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-gray-400">
        Aucun log disponible pour cette partie.
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-4 py-2 w-36">Heure</th>
            <th className="px-3 py-2 w-16">Niveau</th>
            <th className="px-4 py-2">Message</th>
          </tr>
        </thead>
        <tbody className="font-mono divide-y divide-gray-100">
          {logs.map((entry) => (
            <tr
              key={entry.id}
              className={clsx(
                "text-xs",
                entry.level === "error" && "bg-red-50",
                entry.level === "warn" && "bg-yellow-50",
              )}
            >
              <td className="px-4 py-1.5 text-gray-400 whitespace-nowrap">
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
              <td className="px-4 py-1.5 text-gray-700 break-all">
                {entry.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ResultModalLogs
