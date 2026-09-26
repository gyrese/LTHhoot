import { EVENTS } from "@rahoot/common/constants"
import { STATUS } from "@rahoot/common/types/game/status"
import logo from "@rahoot/web/assets/logo.png"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { PETDEX_AVATARS } from "@rahoot/web/features/game/utils/avatars"
import { useNavigate } from "@tanstack/react-router"
import { motion } from "motion/react"
import { type KeyboardEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { User, ArrowRight, RefreshCcw, LogOut, Loader2 } from "lucide-react"

// Longueur maximale d'un pseudo : identique au validateur serveur
// (usernameValidator, packages/common/src/validators/auth.ts).
const USERNAME_MAX_LENGTH = 20
// Filet de sécurité : sans réponse du serveur, on réactive le bouton.
const SUBMIT_TIMEOUT_MS = 8000

const WELCOME_ANIMATION_STATES = ["idle", "waving", "waiting"] as const

const Username = () => {
  const { socket } = useSocket()
  const { gameId, login, setStatus, reset } = usePlayerStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [avatarSeed, setAvatarSeed] = useState(() => {
    const idx = Math.floor(Math.random() * PETDEX_AVATARS.length)

    return PETDEX_AVATARS[idx]?.seed ?? "boba"
  })
  const { t } = useTranslation()
  // Anti double-envoi : verrouillé jusqu'à SUCCESS_JOIN, une erreur ou le délai.
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isSubmitting) {
      return undefined
    }

    const timer = setTimeout(() => setIsSubmitting(false), SUBMIT_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [isSubmitting])

  useEvent(EVENTS.GAME.ERROR_MESSAGE, () => {
    setIsSubmitting(false)
  })

  const handleLogin = () => {
    if (!username.trim() || !gameId || isSubmitting || !socket) {
      return
    }

    setIsSubmitting(true)
    socket.emit(EVENTS.PLAYER.LOGIN, {
      gameId,
      data: { username, avatar: avatarSeed },
    })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleLogin()
    }
  }

  const randomizeAvatar = () => {
    const idx = Math.floor(Math.random() * PETDEX_AVATARS.length)
    setAvatarSeed(PETDEX_AVATARS[idx]?.seed ?? "boba")
  }

  useEvent(EVENTS.GAME.SUCCESS_JOIN, (joinedGameId) => {
    setIsSubmitting(false)
    setStatus(STATUS.WAIT, { text: "game:waitingForPlayers" })
    login(username, avatarSeed)
    navigate({ to: "/party/$gameId", params: { gameId: joinedGameId } })
  })

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center p-4">
      {/* Logo Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
        className="mb-4 sm:mb-8"
      >
        {/* Logo réduit sur petit écran et quand le clavier réduit la hauteur
            visible : le formulaire doit rester à l'écran pendant la saisie. */}
        <img
          src={logo}
          alt="LTNHOOT"
          className="h-20 drop-shadow-[0_0_30px_rgba(255,153,0,0.5)] sm:h-40 md:h-56 [@media(max-height:560px)]:hidden"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="relative w-full max-w-md"
      >
        {/* Glow effect background */}
        <div className="bg-primary/20 absolute -inset-4 rounded-[2.5rem] blur-3xl" />

        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-black/40 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:gap-8">
            {/* Avatar Section */}
            <div className="relative">
              <div className="relative">
                <div className="from-primary absolute -inset-2 rounded-full bg-gradient-to-tr to-orange-300 opacity-50 blur-lg" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 p-2 shadow-inner backdrop-blur-md sm:h-32 sm:w-32">
                  <GameAvatar
                    seed={avatarSeed}
                    animated
                    idleBounce={false}
                    animationStates={WELCOME_ANIMATION_STATES}
                    className="h-full w-full rounded-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    randomizeAvatar()
                  }}
                  className="absolute -top-3 -right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform hover:rotate-180 active:scale-90"
                  aria-label={t("game:changeAvatar")}
                  title={t("game:changeAvatar")}
                >
                  <RefreshCcw size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Input Section */}
            <div className="flex w-full flex-col gap-6">
              <div className="relative flex flex-col gap-2">
                <label
                  htmlFor="nickname"
                  className="ml-1 text-xs font-black tracking-widest text-white/50 uppercase"
                >
                  {t("game:yourPseudo")}
                </label>
                <div className="group relative">
                  <div className="group-focus-within:text-primary absolute top-1/2 left-4 -translate-y-1/2 text-white/40 transition-colors">
                    <User size={20} />
                  </div>
                  <input
                    id="nickname"
                    autoFocus
                    type="text"
                    maxLength={USERNAME_MAX_LENGTH}
                    autoComplete="nickname"
                    enterKeyHint="go"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("game:usernamePlaceholder")}
                    className="focus:border-primary/50 focus:ring-primary/20 w-full rounded-2xl border border-white/10 bg-white/5 py-4 pr-4 pl-12 text-lg font-bold text-white placeholder:text-white/20 focus:bg-white/10 focus:ring-4 focus:outline-none"
                  />
                </div>
              </div>

              <motion.button
                id="username-submit"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98, y: 0 }}
                onClick={handleLogin}
                disabled={!username.trim() || isSubmitting}
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

              <button
                onClick={() => {
                  navigate({ to: "/", search: { pin: undefined } })
                  setTimeout(() => {
                    reset()
                  }, 0)
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 text-sm font-bold text-white/40 transition-colors hover:text-white/80"
              >
                <LogOut size={16} />
                {t("common:quit")}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Username
