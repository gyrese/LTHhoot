import { EVENTS } from "@rahoot/common/constants"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

export function PlayerRecovery({
  gameId,
  playerId,
  username,
}: {
  gameId: string
  playerId: string
  username: string
}) {
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation("recovery")
  const dialog = useRef<HTMLDialogElement>(null)
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(
    null,
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!link) {
      return undefined
    }
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [link])

  const generate = () => {
    dialog.current?.showModal()
    if (!socket || !isConnected) {
      setError(t("network"))
      return
    }
    setPending(true)
    setError("")
    setLink(null)
    setCopied(false)
    socket
      .timeout(8000)
      .emit(
        EVENTS.MANAGER.CREATE_RECOVERY,
        { gameId, playerId },
        (err, result) => {
          setPending(false)
          if (err || !result || "error" in result) {
            setError(t(err ? "network" : "unavailable"))
            return
          }
          setNow(Date.now())
          setLink({
            url: `${window.location.origin}/recover/${encodeURIComponent(gameId)}#${result.token}`,
            expiresAt: result.expiresAt,
          })
        },
      )
  }
  const expired = Boolean(link && now >= link.expiresAt)
  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={!isConnected}
        aria-label={t("forPlayer", { username })}
        className="min-h-11 rounded-lg border border-white/20 px-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {t("action")}
      </button>
      <dialog
        ref={dialog}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-auto rounded-2xl border border-white/20 bg-[#181818] p-6 text-white backdrop:bg-black/75"
        aria-label={t("forPlayer", { username })}
      >
        <h2 className="text-xl font-bold">{t("forPlayer", { username })}</h2>
        <p className="mt-2 text-sm text-white/80">{t("instructions")}</p>
        <div aria-live="polite">
          {pending && <p className="py-8">{t("loading")}</p>}
          {error && (
            <p role="alert" className="my-4 text-red-300">
              {error}
            </p>
          )}
          {link && !expired && (
            <>
              <div className="mx-auto my-5 w-fit rounded-xl bg-white p-4">
                <QRCodeSVG
                  value={link.url}
                  size={224}
                  className="h-auto max-w-full"
                />
              </div>
              <p className="mb-3 text-sm text-white/80">
                {t("expires", {
                  minutes: Math.max(
                    1,
                    Math.ceil((link.expiresAt - now) / 60000),
                  ),
                })}
              </p>
              <label className="text-sm" htmlFor={`recovery-${playerId}`}>
                {t("address")}
              </label>
              <input
                id={`recovery-${playerId}`}
                readOnly
                value={link.url}
                onFocus={(e) => e.target.select()}
                className="mt-1 w-full rounded-lg border border-white/30 bg-black/30 p-3 text-sm"
              />
              <button
                type="button"
                className="mt-3 min-h-11 w-full rounded-lg bg-orange-500 px-4 font-bold text-black"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.url)
                    setCopied(true)
                  } catch {
                    setError(t("copyFailed"))
                  }
                }}
              >
                {t(copied ? "copied" : "copy")}
              </button>
            </>
          )}
          {expired && <p className="my-4 text-amber-200">{t("expired")}</p>}
        </div>
        {(expired || error) && (
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="mt-3 min-h-11 w-full rounded-lg bg-orange-500 px-4 font-bold text-black"
          >
            {t("generate")}
          </button>
        )}
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="mt-3 min-h-11 w-full rounded-lg border border-white/25"
        >
          {t("close")}
        </button>
      </dialog>
    </>
  )
}
