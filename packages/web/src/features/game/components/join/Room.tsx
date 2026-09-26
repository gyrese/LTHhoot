import { EVENTS } from "@rahoot/common/constants"
import logo from "@rahoot/web/assets/logo.png"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useSearch } from "@tanstack/react-router"
import { motion } from "motion/react"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Hash, ArrowRight, Loader2 } from "lucide-react"

// Longueur d'un code PIN de partie (cf. createInviteCode côté serveur).
const PIN_LENGTH = 6
// Filet de sécurité : sans réponse du serveur, on réactive le bouton.
const SUBMIT_TIMEOUT_MS = 8000

const Room = () => {
  const { socket, isConnected } = useSocket()
  const { join } = usePlayerStore()
  const [invitation, setInvitation] = useState("")
  const { pin } = useSearch({ from: "/(auth)/" })
  const hasJoinedRef = useRef(false)
  const { t } = useTranslation()
  // Anti double-envoi : verrouillé jusqu'à SUCCESS_ROOM, une erreur ou le délai.
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isSubmitting) {
      return undefined
    }

    const timer = setTimeout(() => setIsSubmitting(false), SUBMIT_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [isSubmitting])

  const handleJoin = () => {
    if (!invitation.trim() || isSubmitting || !socket) {
      return
    }

    setIsSubmitting(true)
    socket.emit(EVENTS.PLAYER.JOIN, invitation.trim())
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleJoin()
    }
  }

  useEvent(EVENTS.GAME.SUCCESS_ROOM, (gameId) => {
    setIsSubmitting(false)
    join(gameId)
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, () => {
    setIsSubmitting(false)
  })

  useEffect(() => {
    if (!isConnected || !pin || hasJoinedRef.current) {
      return
    }

    socket?.emit("player:join", pin)
    hasJoinedRef.current = true
  }, [pin, isConnected, socket])

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center p-4">
      {/* Logo Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-4 sm:mb-8"
      >
        {/* Logo réduit sur petit écran et quand le clavier réduit la hauteur
            visible : le formulaire doit rester à l'écran pendant la saisie. */}
        <img
          src={logo}
          alt="LTNHOOT"
          className="h-24 drop-shadow-[0_0_30px_rgba(255,153,0,0.5)] sm:h-40 md:h-56 [@media(max-height:560px)]:h-14"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="relative w-full max-w-sm"
      >
        {/* Glow effect background */}
        <div className="bg-primary/20 absolute -inset-4 rounded-[2.5rem] blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-black/40 p-6 text-center shadow-2xl backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                {t("game:joinGame")}
              </h2>
              <p className="text-sm font-medium text-white/50">
                {t("game:enterPinDesc")}
              </p>
            </div>

            {/* Input Section */}
            <div className="flex flex-col gap-6">
              <div className="group relative">
                <div className="group-focus-within:text-primary absolute top-1/2 left-4 -translate-y-1/2 text-white/40 transition-colors">
                  <Hash size={20} />
                </div>
                <input
                  id="pin-input"
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={PIN_LENGTH}
                  autoComplete="off"
                  aria-label={t("game:pinPlaceholder")}
                  value={invitation}
                  onChange={(e) =>
                    setInvitation(e.target.value.replace(/\D/gu, ""))
                  }
                  onKeyDown={handleKeyDown}
                  placeholder={t("game:pinPlaceholder")}
                  className="focus:border-primary/50 focus:ring-primary/20 w-full rounded-2xl border border-white/10 bg-white/5 py-4 pr-4 pl-12 text-center text-3xl font-black tracking-[0.2em] text-white placeholder:tracking-normal placeholder:text-white/10 focus:bg-white/10 focus:ring-4 focus:outline-none"
                />
              </div>

              <motion.button
                id="join-button"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98, y: 0 }}
                onClick={handleJoin}
                disabled={!invitation.trim() || isSubmitting}
                aria-busy={isSubmitting}
                className="group bg-primary relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl py-5 text-lg font-black tracking-wider text-black uppercase shadow-[0_0_40px_rgba(255,153,0,0.3)] transition-all hover:shadow-[0_0_60px_rgba(255,153,0,0.5)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      size={22}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    <span>{t("game:joining")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("common:submit")}</span>
                    <ArrowRight
                      size={22}
                      className="transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Room
