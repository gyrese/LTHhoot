import { EVENTS } from "@rahoot/common/constants"
import type { Player } from "@rahoot/common/types/game"
import { STATUS } from "@rahoot/common/types/game/status"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import {
  MANAGER_SKIP_EVENTS,
  isKeyOf,
} from "@rahoot/web/features/game/utils/constants"
import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import {
  AuthScreen,
  BottomBar,
  GamePanel,
  getPrimaryAction,
  KickModal,
  PlayersPanel,
  RemoteHeader,
} from "@rahoot/web/features/game/components/remote/RemoteControl.panels"
import type {
  GameStatus,
  QuestionStates,
  RemoteTab,
} from "@rahoot/web/features/game/components/remote/RemoteControl.types"

export function RemoteControl({ gameId }: { gameId: string }) {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    console.log("[MOUNT] RemoteControl")

    return () => console.log("[UNMOUNT] RemoteControl")
  }, [])

  const [password, setPassword] = useState(
    () => sessionStorage.getItem("rc_pwd") ?? "",
  )
  const [authError, setAuthError] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<GameStatus>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [questionStates, setQuestionStates] = useState<QuestionStates>(null)
  const [answerCount, setAnswerCount] = useState(0)
  const [inviteCode, setInviteCode] = useState("")
  const [timer, setTimer] = useState<number | null>(null)
  const [maxTime, setMaxTime] = useState(0)

  const [activeTab, setActiveTab] = useState<RemoteTab>("jeu")
  const [kickTargetId, setKickTargetId] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (status?.name === STATUS.SELECT_ANSWER) {
      setAnswerCount(0)
      const time = Number(status.data.time) || 0
      setMaxTime(time)
      setTimer(time)
    } else {
      setTimer(null)
    }

    setActionPending(false)
  }, [status?.name, status?.data])

  useEffect(() => {
    if (status?.name === STATUS.SHOW_ROOM) {
      const code = (status.data.inviteCode as string) ?? ""

      if (code) {
        setInviteCode(code)
      }
    }
  }, [status])

  const resetAuthLoading = useCallback((errorMsg: string) => {
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current)
    }

    setAuthError(errorMsg)
    setIsAuthLoading(false)
  }, [])

  useEvent(EVENTS.MANAGER.UNAUTHORIZED, () => {
    resetAuthLoading("Mot de passe incorrect")
    sessionStorage.removeItem("rc_pwd")
  })

  useEvent(EVENTS.MANAGER.ERROR_MESSAGE, (msg) => {
    resetAuthLoading(msg || "Erreur de connexion à la partie")
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, () => {
    setActionPending(false)
  })

  useEvent(
    EVENTS.MANAGER.SUCCESS_RECONNECT,
    ({ gameId: gId, status: s, players: p, currentQuestion }) => {
      if (gId !== gameId) {
        return
      }

      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current)
      }

      setIsAuthenticated(true)
      setIsAuthLoading(false)
      setStatus({ name: s.name, data: s.data as Record<string, unknown> })
      setPlayers(p)
      setQuestionStates(currentQuestion)
    },
  )

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (isAuthenticated) {
      setStatus({ name, data: data as Record<string, unknown> })
    }
  })

  useEvent(EVENTS.MANAGER.NEW_PLAYER, (player) => {
    setPlayers((prev) => [...prev.filter((p) => p.id !== player.id), player])
  })

  useEvent(EVENTS.MANAGER.REMOVE_PLAYER, (playerId) => {
    setPlayers((prev) => prev.filter((p) => p.id !== playerId))
  })

  useEvent(EVENTS.MANAGER.PLAYER_KICKED, (playerId) => {
    setPlayers((prev) => prev.filter((p) => p.id !== playerId))
    setKickTargetId(null)
    toast.success("Joueur expulsé")
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setAnswerCount(count)
  })

  useEvent(EVENTS.GAME.COOLDOWN, (timeLeft: number) => {
    setTimer(timeLeft)
  })

  useEvent(EVENTS.GAME.UPDATE_QUESTION, ({ current, total }) => {
    setQuestionStates({ current, total })
  })

  useEvent(EVENTS.GAME.RESET, (message) => {
    if (!isAuthenticated) {
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current)
      }

      setIsAuthLoading(false)
      setAuthError("Partie introuvable ou déjà terminée.")

      return
    }

    toast.error(message)
    navigate({ to: "/remote" })
  })

  // La reconnexion est gérée globalement par le SocketProvider

  const handleAuth = useCallback(() => {
    if (!socket || !password.trim()) {
      return
    }

    setAuthError("")
    setIsAuthLoading(true)
    sessionStorage.setItem("rc_pwd", password)
    socket?.emit(EVENTS.MANAGER.AUTH, password)
    socket?.emit(EVENTS.MANAGER.RECONNECT, { gameId })

    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current)
    }

    authTimeoutRef.current = setTimeout(() => {
      setIsAuthLoading(false)
      setAuthError("Partie introuvable. Vérifiez le code de partie.")
    }, 5000)
  }, [socket, password, gameId])

  const handlePrimary = useCallback(() => {
    if (!socket || !status || actionPending) {
      return
    }

    setActionPending(true)

    const { name } = status

    switch (name) {
      case STATUS.SHOW_ROOM:
        socket?.emit(EVENTS.MANAGER.START_GAME, { gameId })

        break

      case STATUS.SELECT_ANSWER:
        socket?.emit(EVENTS.MANAGER.ABORT_QUIZ, { gameId })

        break

      case STATUS.SHOW_OPEN_ANSWERS:
        socket?.emit(EVENTS.MANAGER.FINALIZE_OPEN_ANSWERS, { gameId })

        break

      case STATUS.SHOW_RESPONSES:
        socket?.emit(EVENTS.MANAGER.SHOW_LEADERBOARD, { gameId })

        break

      case STATUS.SHOW_LEADERBOARD:
        socket?.emit(EVENTS.MANAGER.NEXT_QUESTION, { gameId })

        break

      case STATUS.FINISHED:
        navigate({ to: "/remote" })

        break

      default:
        if (isKeyOf(MANAGER_SKIP_EVENTS, name)) {
          socket?.emit(MANAGER_SKIP_EVENTS[name], { gameId })
        } else {
          setActionPending(false)
        }
    }
  }, [socket, status, actionPending, gameId, navigate])

  const handleStartDemo = useCallback(() => {
    if (!socket || actionPending) {
      return
    }

    setActionPending(true)
    socket?.emit(EVENTS.MANAGER.START_DEMO, { gameId })
  }, [socket, actionPending, gameId])

  const handleValidateOpenAnswer = useCallback(
    (text: string) => {
      if (!socket) {
        return
      }

      socket?.emit(EVENTS.MANAGER.VALIDATE_OPEN_ANSWER, {
        gameId,
        data: { text },
      })
    },
    [socket, gameId],
  )

  const handleKick = useCallback(
    (playerId: string) => {
      if (!socket) {
        return
      }

      socket?.emit(EVENTS.MANAGER.KICK_PLAYER, { gameId, playerId })
      setKickTargetId(null)
    },
    [socket, gameId],
  )

  const handleEndGame = useCallback(() => {
    if (!socket || !gameId) {
      return
    }

    if (
      window.confirm(
        t("game:confirmEndGame", "Voulez-vous vraiment fermer cette session ?"),
      )
    ) {
      socket.emit(EVENTS.MANAGER.END_GAME, { gameId })
    }
  }, [socket, gameId, t])

  const primaryAction = getPrimaryAction(status, players.length, t)

  if (!isAuthenticated) {
    return (
      <AuthScreen
        password={password}
        setPassword={setPassword}
        error={authError}
        isLoading={isAuthLoading}
        isConnected={isConnected}
        onSubmit={handleAuth}
      />
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-gray-900 to-black">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/3 h-72 w-72 animate-pulse rounded-full bg-orange-500/6 blur-3xl" />
        <div className="absolute right-1/4 bottom-32 h-56 w-56 animate-pulse rounded-full bg-violet-500/6 blur-3xl [animation-delay:1.5s]" />
      </div>

      <RemoteHeader
        isConnected={isConnected}
        questionStates={questionStates}
        statusName={status?.name}
        inviteCode={inviteCode}
        onEndGame={handleEndGame}
      />

      <main className="relative z-10 flex-1 overflow-y-auto">
        {activeTab === "jeu" ? (
          <GamePanel
            status={status}
            answerCount={answerCount}
            players={players}
            onValidateOpenAnswer={handleValidateOpenAnswer}
            questionStates={questionStates}
            timer={timer}
            maxTime={maxTime}
          />
        ) : (
          <PlayersPanel
            players={players}
            statusName={status?.name}
            answerCount={answerCount}
            kickTargetId={kickTargetId}
            setKickTargetId={setKickTargetId}
            onKick={handleKick}
          />
        )}
        <div className="h-28" />
      </main>

      <BottomBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        primaryAction={primaryAction}
        onPrimary={handlePrimary}
        onStartDemo={handleStartDemo}
        isPending={actionPending}
        playerCount={players.length}
        statusName={status?.name}
      />

      {kickTargetId && (
        <KickModal
          player={players.find((p) => p.id === kickTargetId)}
          onConfirm={() => handleKick(kickTargetId)}
          onCancel={() => setKickTargetId(null)}
        />
      )}
    </div>
  )
}
