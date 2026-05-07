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
import { Hash, ArrowRight } from "lucide-react"

const Room = () => {
  const { socket, isConnected } = useSocket()
  const { join } = usePlayerStore()
  const [invitation, setInvitation] = useState("")
  const { pin } = useSearch({ from: "/(auth)/" })
  const hasJoinedRef = useRef(false)
  const { t } = useTranslation()

  const handleJoin = () => {
    if (!invitation.trim()) {return}

    socket?.emit(EVENTS.PLAYER.JOIN, invitation)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleJoin()
    }
  }

  useEvent(EVENTS.GAME.SUCCESS_ROOM, (gameId) => {
    join(gameId)
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
        className="mb-8"
      >
        <img
          src={logo}
          alt="LTNHOOT"
          className="h-40 drop-shadow-[0_0_30px_rgba(255,153,0,0.5)] md:h-56"
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

        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-black/40 p-8 text-center shadow-2xl backdrop-blur-2xl">
          <div className="flex flex-col gap-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                {t("game:joinGame", "Rejoindre une partie")}
              </h2>
              <p className="text-sm font-medium text-white/50">
                {t(
                  "game:enterPinDesc",
                  "Saisis le code PIN du salon pour commencer",
                )}
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
                  value={invitation}
                  onChange={(e) => setInvitation(e.target.value)}
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
                disabled={!invitation.trim()}
                className="group bg-primary relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl py-5 text-lg font-black tracking-wider text-black uppercase shadow-[0_0_40px_rgba(255,153,0,0.3)] transition-all hover:shadow-[0_0_60px_rgba(255,153,0,0.5)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <span>{t("common:submit")}</span>
                <ArrowRight
                  size={22}
                  className="transition-transform group-hover:translate-x-1"
                />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Room
