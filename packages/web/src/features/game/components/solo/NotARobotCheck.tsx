import { Check, ShieldCheck } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"

type Props = {
  checked: boolean
  onChange: (_checked: boolean) => void
  // Piège à bots : champ invisible que seul un remplisseur automatique
  // complète. Sa valeur remonte au serveur, qui rejette la soumission.
  honeypot: string
  onHoneypotChange: (_value: string) => void
}

/**
 * Case « Je ne suis pas un robot » de la page solo publique. Sans service
 * externe : la case seule ne prouve rien, la protection vient du trio
 * case cochée + honeypot + délai minimum vérifié côté serveur.
 */
const NotARobotCheck: React.FC<Props> = ({
  checked,
  onChange,
  honeypot,
  onHoneypotChange,
}) => {
  const [verifying, setVerifying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    },
    [],
  )

  const handleClick = () => {
    if (checked || verifying) {
      onChange(false)

      return
    }

    // Court temps de "vérification" : rend l'action délibérée et laisse le
    // délai minimum côté serveur s'écouler pour un humain normal.
    setVerifying(true)
    timerRef.current = setTimeout(() => {
      setVerifying(false)
      onChange(true)
    }, 600)
  }

  return (
    <>
      {/* Honeypot : hors écran et exclu de la navigation clavier */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={honeypot}
        onChange={(e) => onHoneypotChange(e.target.value)}
        className="pointer-events-none absolute -left-[9999px] size-0 opacity-0"
      />

      <button
        type="button"
        onClick={handleClick}
        aria-pressed={checked}
        className="flex w-full items-center gap-3 rounded-xl border border-white/20 bg-slate-900/90 px-4 py-3 text-left transition-colors hover:border-white/30"
      >
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            checked
              ? "border-orange-500 bg-orange-500"
              : "border-gray-500 bg-slate-950"
          }`}
        >
          {verifying ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
          ) : (
            checked && <Check className="size-4 text-white" />
          )}
        </span>

        <span className="flex-1 text-sm font-semibold text-white">
          Je ne suis pas un robot
        </span>

        <ShieldCheck
          className={`size-5 shrink-0 transition-colors ${
            checked ? "text-orange-400" : "text-gray-500"
          }`}
        />
      </button>
    </>
  )
}

export default NotARobotCheck
