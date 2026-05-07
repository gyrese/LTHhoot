import { EVENTS } from "@rahoot/common/constants"
import type { Player } from "@rahoot/common/types/game"
import { STATUS, type Status } from "@rahoot/common/types/game/status"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import logo from "@rahoot/web/assets/logo.png"
import clsx from "clsx"
import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import {
  MANAGER_SKIP_BTN,
  MANAGER_SKIP_EVENTS,
  isKeyOf,
} from "@rahoot/web/features/game/utils/constants"

// ─── Types ────────────────────────────────────────────────────────────────────

type GameStatus = { name: Status; data: Record<string, unknown> } | null
type QuestionStates = { current: number; total: number } | null
type RemoteTab = "jeu" | "joueurs"

interface PrimaryAction {
  label: string
  disabled: boolean
  variant: "orange" | "red" | "ghost"
}

// ─── Icônes SVG ───────────────────────────────────────────────────────────────

const IconUsers = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconDisplay = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)

const IconCheck = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20,6 9,17 4,12" />
  </svg>
)

const IconTrophy = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
)

// ─── Constantes ───────────────────────────────────────────────────────────────

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "QCM",
  true_false: "Vrai / Faux",
  open: "Réponse libre",
  date: "Date",
  slider: "Curseur",
  puzzle: "Puzzle",
  drop_pin: "Carte",
  title: "Titre",
}

const MCQ_COLORS = [
  { bg: "bg-red-500", bar: "bg-red-500", letter: "A" },
  { bg: "bg-blue-500", bar: "bg-blue-500", letter: "B" },
  { bg: "bg-yellow-500", bar: "bg-yellow-500", letter: "C" },
  { bg: "bg-green-500", bar: "bg-green-500", letter: "D" },
]

const STATUS_LABELS: Partial<Record<Status, string>> = {
  [STATUS.SHOW_ROOM]: "Attente",
  [STATUS.SHOW_START]: "Démarrage",
  [STATUS.SHOW_PREPARED]: "Préparation",
  [STATUS.SHOW_QUESTION]: "Lecture",
  [STATUS.SELECT_ANSWER]: "Réponses",
  [STATUS.SHOW_OPEN_ANSWERS]: "Réponses libres",
  [STATUS.SHOW_RESPONSES]: "Résultats",
  [STATUS.SHOW_LEADERBOARD]: "Classement",
  [STATUS.FINISHED]: "Terminé",
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"]

// ─── Composant principal ──────────────────────────────────────────────────────

export function RemoteControl({ gameId }: { gameId: string }) {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()

  // Auth
  const [password, setPassword] = useState(
    () => sessionStorage.getItem("rc_pwd") ?? "",
  )
  const [authError, setAuthError] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Jeu
  const [status, setStatus] = useState<GameStatus>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [questionStates, setQuestionStates] = useState<QuestionStates>(null)
  const [answerCount, setAnswerCount] = useState(0)
  const [inviteCode, setInviteCode] = useState("")
  const [timer, setTimer] = useState<number | null>(null)
  const [maxTime, setMaxTime] = useState(0)

  // UI
  const [activeTab, setActiveTab] = useState<RemoteTab>("jeu")
  const [kickTargetId, setKickTargetId] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const { t } = useTranslation()

  // Réinitialise le compteur à chaque nouvelle phase de réponse
  useEffect(() => {
    if (status?.name === STATUS.SELECT_ANSWER) {
      setAnswerCount(0)
      const t = Number(status.data.time) || 0
      setMaxTime(t)
      setTimer(t)
    } else {
      setTimer(null)
    }
    setActionPending(false)
  }, [status?.name, status?.data])

  // Extrait le code invitation depuis SHOW_ROOM
  useEffect(() => {
    if (status?.name === STATUS.SHOW_ROOM) {
      const code = (status.data.inviteCode as string) ?? ""
      if (code) setInviteCode(code)
    }
  }, [status])

  // ── Événements socket ──────────────────────────────────────────────────────

  const resetAuthLoading = useCallback((errorMsg: string) => {
    if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current)
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

  useEvent(
    EVENTS.MANAGER.SUCCESS_RECONNECT,
    ({ gameId: gId, status: s, players: p, currentQuestion }) => {
      if (gId !== gameId) return
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current)
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
      // Avant auth : afficher l'erreur dans le formulaire
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current)
      setIsAuthLoading(false)
      setAuthError("Partie introuvable ou déjà terminée.")
      return
    }
    toast.error(message)
    navigate({ to: "/manager/config" })
  })

  // Ré-authentification après reconnexion socket (uniquement si déjà authentifié)
  useEvent("connect", () => {
    if (!isAuthenticated || !socket || !password) return
    socket.emit(EVENTS.MANAGER.AUTH, password)
    socket.emit(EVENTS.MANAGER.RECONNECT, { gameId })
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAuth = useCallback(() => {
    if (!socket || !password.trim()) return
    setAuthError("")
    setIsAuthLoading(true)
    sessionStorage.setItem("rc_pwd", password)
    socket.emit(EVENTS.MANAGER.AUTH, password)
    socket.emit(EVENTS.MANAGER.RECONNECT, { gameId })
    // Timeout si le serveur ne répond pas (partie inexistante)
    if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current)
    authTimeoutRef.current = setTimeout(() => {
      setIsAuthLoading(false)
      setAuthError("Partie introuvable. Vérifiez le code de partie.")
    }, 5000)
  }, [socket, password, gameId])

  const handlePrimary = useCallback(() => {
    if (!socket || !status || actionPending) return
    setActionPending(true)

    const { name } = status

    // Actions spécifiques basées sur le statut
    switch (name) {
      case STATUS.SHOW_ROOM:
        socket.emit(EVENTS.MANAGER.START_GAME, { gameId })
        break
      case STATUS.SELECT_ANSWER:
        // Sur SELECT_ANSWER, le bouton principal est souvent "Passer" (Abort)
        socket.emit(EVENTS.MANAGER.ABORT_QUIZ, { gameId })
        break
      case STATUS.SHOW_OPEN_ANSWERS:
        socket.emit(EVENTS.MANAGER.FINALIZE_OPEN_ANSWERS, { gameId })
        break
      case STATUS.SHOW_RESPONSES:
        socket.emit(EVENTS.MANAGER.SHOW_LEADERBOARD, { gameId })
        break
      case STATUS.SHOW_LEADERBOARD:
        socket.emit(EVENTS.MANAGER.NEXT_QUESTION, { gameId })
        break
      case STATUS.FINISHED:
        navigate({ to: "/manager/config" })
        break
      default:
        // Fallback sur les événements de skip génériques
        if (isKeyOf(MANAGER_SKIP_EVENTS, name)) {
          socket.emit(MANAGER_SKIP_EVENTS[name], { gameId })
        } else {
          setActionPending(false)
        }
    }
  }, [socket, status, actionPending, gameId, navigate])

  const handleStartDemo = useCallback(() => {
    if (!socket || actionPending) return
    setActionPending(true)
    socket.emit(EVENTS.MANAGER.START_DEMO, { gameId })
  }, [socket, actionPending, gameId])

  const handleValidateOpenAnswer = useCallback(
    (text: string) => {
      if (!socket) {
        return
      }

      socket.emit(EVENTS.MANAGER.VALIDATE_OPEN_ANSWER, {
        gameId,
        data: { text },
      })
    },
    [socket, gameId],
  )

  const handleKick = useCallback(
    (playerId: string) => {
      if (!socket) return
      socket.emit(EVENTS.MANAGER.KICK_PLAYER, { gameId, playerId })
      setKickTargetId(null)
    },
    [socket, gameId],
  )

  // ── Calcul de l'action principale ─────────────────────────────────────────

  const primaryAction = getPrimaryAction(status, players.length, t)

  // ── Rendu ──────────────────────────────────────────────────────────────────

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
      {/* Ambiance lumineuse */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/3 h-72 w-72 animate-pulse rounded-full bg-orange-500/6 blur-3xl" />
        <div className="absolute right-1/4 bottom-32 h-56 w-56 animate-pulse rounded-full bg-violet-500/6 blur-3xl [animation-delay:1.5s]" />
      </div>

      {/* En-tête */}
      <RemoteHeader
        isConnected={isConnected}
        questionStates={questionStates}
        statusName={status?.name}
        inviteCode={inviteCode}
      />

      {/* Contenu principal */}
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
        {/* Espace pour la barre du bas */}
        <div className="h-28" />
      </main>

      {/* Barre du bas */}
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

      {/* Modal expulsion */}
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

// ─── Écran d'authentification ─────────────────────────────────────────────────

function AuthScreen({
  password,
  setPassword,
  error,
  isLoading,
  isConnected,
  onSubmit,
}: {
  password: string
  setPassword: (v: string) => void
  error: string
  isLoading: boolean
  isConnected: boolean
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-slate-950 to-black p-6">
      <div className="text-center">
        <img
          src={logo}
          alt="LTNHoot!"
          className="mx-auto h-16 w-auto object-contain"
        />
        <div className="mt-2 text-xs tracking-[0.3em] text-white/30 uppercase">
          Télécommande
        </div>
      </div>

      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="mb-5 flex items-center gap-2">
          <div
            className={clsx(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-400" : "animate-pulse bg-red-400",
            )}
          />
          <span className="text-xs text-white/40">
            {isConnected ? "Serveur connecté" : "Connexion..."}
          </span>
        </div>

        <label className="mb-2 block text-xs font-semibold tracking-widest text-white/50 uppercase">
          Mot de passe manager
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="••••••••"
          className="mb-3 w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-base text-white placeholder-white/20 transition-all focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
        />

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={onSubmit}
          disabled={isLoading || !isConnected || !password.trim()}
          className={clsx(
            "w-full rounded-xl py-3.5 text-base font-bold transition-all active:scale-95",
            isLoading || !isConnected || !password.trim()
              ? "cursor-not-allowed bg-white/8 text-white/25"
              : "bg-orange-500 text-white shadow-lg shadow-orange-500/25 hover:bg-orange-400",
          )}
        >
          {isLoading ? "Connexion..." : "Accéder →"}
        </button>
      </div>

      <p className="max-w-xs text-center text-xs text-white/20">
        Ouvrez cette page sur votre téléphone pendant que le jeu tourne sur
        l'écran principal.
      </p>
    </div>
  )
}

// ─── En-tête ──────────────────────────────────────────────────────────────────

function RemoteHeader({
  isConnected,
  questionStates,
  statusName,
  inviteCode,
}: {
  isConnected: boolean
  questionStates: QuestionStates | null
  statusName: Status | undefined
  inviteCode: string
}) {
  const [codeVisible, setCodeVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <header className="relative z-20 flex items-center gap-3 border-b border-white/8 bg-black/40 px-4 py-3 backdrop-blur-xl">
      <img src={logo} alt="LTNHoot!" className="h-7 w-auto object-contain" />

      <div className="flex flex-1 items-center justify-center gap-2">
        {questionStates && (
          <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold text-white">
            Q {questionStates.current} / {questionStates.total}
          </span>
        )}
        {statusName && (
          <span className="text-xs tracking-wider text-white/30 uppercase">
            {STATUS_LABELS[statusName] ?? statusName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {inviteCode && (
          <button
            onClick={() => {
              setCodeVisible((v) => !v)
              if (!codeVisible) copyCode()
            }}
            className="rounded-lg border border-white/10 bg-white/8 px-2.5 py-1 font-mono text-xs text-white/60 transition-colors hover:bg-white/15"
          >
            {codeVisible ? (copied ? "✓ Copié" : inviteCode) : "••••••"}
          </button>
        )}
        <div
          className={clsx(
            "h-2 w-2 rounded-full transition-colors",
            isConnected ? "bg-green-400" : "animate-pulse bg-red-400",
          )}
        />
      </div>
    </header>
  )
}

// ─── Panneau de jeu (switch par état) ────────────────────────────────────────

function GamePanel({
  status,
  answerCount,
  players,
  onValidateOpenAnswer,
  questionStates,
  timer,
  maxTime,
}: {
  status: GameStatus
  answerCount: number
  players: Player[]
  onValidateOpenAnswer: (_text: string) => void
  questionStates: QuestionStates | null
  timer: number | null
  maxTime: number
}) {
  const { t } = useTranslation()

  if (!status) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-white/30">{t("game:waitingForGame")}</p>
      </div>
    )
  }

  switch (status.name) {
    case STATUS.SHOW_ROOM:
      return <RoomPanel data={status.data} players={players} />
    case STATUS.SHOW_START:
      return <StartPanel data={status.data} t={t} />
    case STATUS.SHOW_PREPARED:
      return <PreparedPanel data={status.data} t={t} />
    case STATUS.SHOW_QUESTION:
      return <QuestionPanel data={status.data} t={t} />
    case STATUS.SELECT_ANSWER:
      return (
        <SelectAnswerPanel
          data={status.data}
          answerCount={answerCount}
          players={players}
          timer={timer}
          maxTime={maxTime}
        />
      )

    case STATUS.SHOW_OPEN_ANSWERS:
      return (
        <OpenAnswersManagerPanel
          data={status.data}
          onValidate={onValidateOpenAnswer}
          questionStates={questionStates}
          timer={timer}
          maxTime={maxTime}
        />
      )
    case STATUS.SHOW_RESPONSES:
      return <ResponsesPanel data={status.data} />
    case STATUS.SHOW_LEADERBOARD:
      return <LeaderboardPanel data={status.data} />
    case STATUS.FINISHED:
      return <FinishedPanel data={status.data} />
    case STATUS.WAIT:
      return <WaitPanel data={status.data} t={t} />
    default:
      return null
  }
}

// ─── SHOW_OPEN_ANSWERS (manager) ──────────────────────────────────────────────

function OpenAnswersManagerPanel({
  data,
  onValidate,
  questionStates,
  timer,
  maxTime,
}: {
  data: Record<string, unknown>
  onValidate: (_text: string) => void
  questionStates: QuestionStates | null
  timer: number | null
  maxTime: number
}) {
  type AnswerEntry = { text: string; playerName: string; isCorrect: boolean }
  const question = String(data.question ?? "")
  const answers = (data.answers as AnswerEntry[]) ?? []
  const totalPlayers = Number(data.totalPlayers ?? 0)
  const correctAnswers = (data.correctAnswers as string[]) ?? []
  const [validating, setValidating] = useState<string | null>(null)

  const unique = Array.from(
    new Map(answers.map((a) => [a.text.trim().toLowerCase(), a])).values(),
  )
  const answered = answers.length
  const noAnswer = totalPlayers - answered

  const handleValidate = (text: string) => {
    setValidating(text)
    onValidate(text)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm">
        <p className="mb-0.5 text-xs font-semibold text-orange-300/70">
          Réponse libre
        </p>
        <p className="text-sm font-semibold text-white">{question}</p>
        {questionStates && (
          <p className="mt-2 text-sm font-medium text-blue-100/80">
            Question {questionStates.current} / {questionStates.total}
          </p>
        )}
      </div>

      {/* Timer Progress Bar */}
      {timer !== null && maxTime > 0 && (
        <div className="mt-1 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-bold tracking-wider text-white uppercase">
              Temps restant
            </span>
            <span
              className={clsx(
                "rounded px-2 py-0.5 text-sm font-black tabular-nums",
                timer <= 5
                  ? "animate-pulse bg-red-500 text-white"
                  : "text-blue-100",
              )}
            >
              {timer}s
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/20">
            <div
              className={clsx(
                "h-full transition-all duration-1000 ease-linear",
                timer > maxTime * 0.5
                  ? "bg-green-400"
                  : timer > maxTime * 0.2
                    ? "bg-orange-400"
                    : "bg-red-500",
              )}
              style={{ width: `${(timer / maxTime) * 100}%` }}
            />
          </div>
        </div>
      )}

      {correctAnswers.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 p-3">
          <p className="w-full text-xs font-bold tracking-widest text-green-400/70 uppercase">
            Réponses valides
          </p>
          {correctAnswers.map((ca) => (
            <span
              key={ca}
              className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300"
            >
              <IconCheck className="h-3 w-3" />
              {ca}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="border-b border-white/5 px-4 py-2.5">
          <p className="text-xs font-semibold tracking-wider text-white/35 uppercase">
            Réponses joueurs — {answered} / {totalPlayers}
          </p>
        </div>
        <p className="px-4 pt-2.5 pb-1 text-[11px] text-white/30">
          Appuyer pour valider une réponse
        </p>
        <div className="flex flex-col gap-1.5 p-3">
          {unique.map((answer) => {
            const count = answers.filter(
              (a) =>
                a.text.trim().toLowerCase() ===
                answer.text.trim().toLowerCase(),
            ).length
            const players = answers
              .filter(
                (a) =>
                  a.text.trim().toLowerCase() ===
                  answer.text.trim().toLowerCase(),
              )
              .map((a) => a.playerName)

            return (
              <button
                key={answer.text}
                disabled={answer.isCorrect || validating === answer.text}
                onClick={() => {
                  handleValidate(answer.text)
                }}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all active:scale-98",
                  answer.isCorrect
                    ? "cursor-default border-green-500/30 bg-green-500/15"
                    : "border-white/8 bg-white/5 hover:border-orange-500/20 hover:bg-white/10",
                  validating === answer.text &&
                    !answer.isCorrect &&
                    "opacity-50",
                )}
              >
                {answer.isCorrect && (
                  <IconCheck className="h-4 w-4 shrink-0 text-green-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      "truncate text-sm font-bold",
                      answer.isCorrect ? "text-green-300" : "text-white",
                    )}
                  >
                    {answer.text}
                  </p>
                  <p className="truncate text-xs text-white/35">
                    {players.join(", ")}
                  </p>
                </div>
                {count > 1 && (
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/60">
                    ×{count}
                  </span>
                )}
              </button>
            )
          })}

          {noAnswer > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 px-4 py-2.5">
              <div className="h-4 w-4 shrink-0 rounded-full border border-white/15" />
              <p className="text-sm text-white/25">{noAnswer} sans réponse</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SHOW_ROOM ────────────────────────────────────────────────────────────────

function RoomPanel({
  data,
  players,
}: {
  data: Record<string, unknown>
  players: Player[]
}) {
  const inviteCode = String(data.inviteCode ?? "------")
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Code d'invitation */}
      <button
        onClick={copyCode}
        className="group w-full rounded-2xl border border-white/10 bg-black/40 p-5 text-center backdrop-blur-sm transition-all hover:border-orange-500/20 active:scale-98"
      >
        <p className="mb-2 text-xs tracking-widest text-white/30 uppercase">
          Code d'invitation
        </p>
        <p className="font-mono text-5xl font-black tracking-[0.3em] text-orange-400 transition-colors group-hover:text-orange-300">
          {inviteCode}
        </p>
        <p className="mt-2 text-xs text-white/20">
          {copied ? "✓ Copié !" : "Appuyer pour copier"}
        </p>
      </button>

      {/* Compteur joueurs */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-3.5 backdrop-blur-sm">
        <IconUsers className="h-5 w-5 shrink-0 text-orange-400" />
        <div className="flex-1">
          <p className="font-bold text-white">
            {players.length} joueur{players.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-white/30">
            connecté{players.length !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Avatars empilés */}
        <div className="flex -space-x-2">
          {players.slice(0, 6).map((p) => (
            <div
              key={p.id}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black bg-gradient-to-br from-orange-500/40 to-violet-500/40 text-xs font-bold text-white"
            >
              {p.username[0]?.toUpperCase()}
            </div>
          ))}
          {players.length > 6 && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black bg-white/10 text-xs text-white/50">
              +{players.length - 6}
            </div>
          )}
        </div>
      </div>

      {/* Liste joueurs */}
      {players.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="border-b border-white/5 px-4 py-2.5">
            <p className="text-xs font-semibold tracking-wider text-white/40 uppercase">
              Joueurs
            </p>
          </div>
          <div className="max-h-64 divide-y divide-white/5 overflow-y-auto">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-orange-500/25 to-violet-500/25 text-sm font-bold text-white">
                  {player.username[0]?.toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm font-medium text-white">
                  {player.username}
                </span>
                <div
                  className={clsx(
                    "h-1.5 w-1.5 rounded-full",
                    player.connected ? "bg-green-400" : "bg-white/20",
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-white/20">
          En attente des joueurs...
        </p>
      )}
    </div>
  )
}

// ─── SHOW_START ───────────────────────────────────────────────────────────────

function StartPanel({
  data,
  t,
}: {
  data: Record<string, unknown>
  t: (key: string) => string
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/15">
        <svg
          className="h-8 w-8 text-orange-400"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-white">
          {String(data.subject ?? "Quiz")}
        </h2>
        <p className="mt-1 text-sm text-white/40">
          {t("game:startIn")} {String(data.time ?? 3)}s
        </p>
      </div>
    </div>
  )
}

// ─── SHOW_PREPARED ────────────────────────────────────────────────────────────

function PreparedPanel({
  data,
  t,
}: {
  data: Record<string, unknown>
  t: (key: string) => string
}) {
  const type = String(data.type ?? "mcq")
  const qNumber = Number(data.questionNumber ?? 1)

  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-8">
      <p className="text-xs tracking-widest text-white/30 uppercase">
        {t("game:question")} {qNumber}
      </p>
      <span className="rounded-full border border-orange-500/30 bg-orange-500/15 px-5 py-2 text-sm font-semibold text-orange-300">
        {QUESTION_TYPE_LABELS[type] ?? type}
      </span>
      <p className="animate-pulse text-sm text-white/25">
        {t("game:preparation")}...
      </p>
    </div>
  )
}

// ─── SHOW_QUESTION ────────────────────────────────────────────────────────────

function QuestionPanel({
  data,
  t,
}: {
  data: Record<string, unknown>
  t: (key: string) => string
}) {
  const question = String(data.question ?? "")
  const type = String(data.type ?? "mcq")
  const cooldown = Number(data.cooldown ?? 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full border border-orange-500/30 bg-orange-500/15 px-3 py-0.5 text-xs font-semibold text-orange-300">
            {QUESTION_TYPE_LABELS[type] ?? type}
          </span>
          <span className="text-xs text-white/25">{t("game:readingTime")}</span>
        </div>
        <p className="line-clamp-5 text-base leading-relaxed font-semibold text-white">
          {question}
        </p>
      </div>

      <SolutionDisplay data={data} />

      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-3.5 backdrop-blur-sm">
        <div className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
        <p className="text-sm text-white/50">
          {cooldown}s · {t("game:readingByPlayers")}
        </p>
      </div>
    </div>
  )
}

// ─── WAIT ────────────────────────────────────────────────────────────────────

function WaitPanel({
  data,
  t,
}: {
  data: Record<string, unknown>
  t: (key: string) => string
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full border border-white/10 bg-white/5">
        <div className="h-2 w-2 rounded-full bg-orange-500" />
      </div>
      <p className="text-center text-sm font-medium text-white/40">
        {String(data.text ?? t("game:waiting"))}
      </p>
    </div>
  )
}

// ─── SELECT_ANSWER ────────────────────────────────────────────────────────────

function SelectAnswerPanel({
  data,
  answerCount,
  players,
  timer,
  maxTime,
}: {
  data: Record<string, unknown>
  answerCount: number
  players: Player[]
  timer: number | null
  maxTime: number
}) {
  const total = Number(data.totalPlayer ?? players.length)
  const question = String(data.question ?? "")
  const type = String(data.type ?? "mcq")

  const progress = total > 0 ? answerCount / total : 0
  const R = 52
  const circ = 2 * Math.PI * R
  const offset = circ * (1 - progress)
  const allAnswered = answerCount >= total && total > 0

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Question */}
      <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm">
        <p className="mb-1 text-xs font-semibold text-orange-300/70">
          {QUESTION_TYPE_LABELS[type] ?? type}
        </p>
        <p className="line-clamp-2 text-sm font-semibold text-white">
          {question}
        </p>
      </div>

      {/* Timer Progress Bar */}
      {timer !== null && maxTime > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-bold tracking-wider text-white uppercase">
              Temps restant
            </span>
            <span
              className={clsx(
                "rounded px-2 py-0.5 text-sm font-black tabular-nums",
                timer <= 5
                  ? "animate-pulse bg-red-500 text-white"
                  : "text-blue-100",
              )}
            >
              {timer}s
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/20">
            <div
              className={clsx(
                "h-full transition-all duration-1000 ease-linear",
                timer > maxTime * 0.5
                  ? "bg-green-400"
                  : timer > maxTime * 0.2
                    ? "bg-orange-400"
                    : "bg-red-500",
              )}
              style={{ width: `${(timer / maxTime) * 100}%` }}
            />
          </div>
        </div>
      )}

      <SolutionDisplay data={data} />

      {/* Anneau de progression */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
        <div className="relative">
          <svg width="132" height="132" className="-rotate-90">
            <circle
              cx="66"
              cy="66"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="14"
            />
            <circle
              cx="66"
              cy="66"
              r={R}
              fill="none"
              stroke={allAnswered ? "#22c55e" : "#f97316"}
              strokeWidth="14"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-white tabular-nums">
              {answerCount}
            </span>
            <span className="text-xs text-white/35">/ {total}</span>
          </div>
        </div>

        <div className="text-center">
          <p
            className={clsx(
              "font-semibold",
              allAnswered ? "text-green-400" : "text-white",
            )}
          >
            {allAnswered
              ? "Tout le monde a répondu !"
              : `${answerCount} réponse${answerCount !== 1 ? "s" : ""} reçue${answerCount !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Liste joueurs */}
      {players.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="border-b border-white/5 px-4 py-2.5">
            <p className="text-xs font-semibold tracking-wider text-white/35 uppercase">
              Suivi joueurs
            </p>
          </div>
          <div className="max-h-44 divide-y divide-white/5 overflow-y-auto">
            {players.map((player, i) => {
              const hasAnswered = i < answerCount
              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <div
                    className={clsx(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      hasAnswered
                        ? "bg-green-400"
                        : "animate-pulse bg-white/15",
                    )}
                  />
                  <span className="flex-1 truncate text-sm text-white">
                    {player.username}
                  </span>
                  {hasAnswered ? (
                    <IconCheck className="h-4 w-4 shrink-0 text-green-400" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded-full border border-white/15" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SHOW_RESPONSES ───────────────────────────────────────────────────────────

function ResponsesPanel({ data }: { data: Record<string, unknown> }) {
  const type = String(data.type ?? "mcq")
  const question = String(data.question ?? "")
  const responses = (data.responses as Record<number, number>) ?? {}
  const answers = (data.answers as string[]) ?? []
  const solutions = (data.solutions as number[]) ?? []
  const correctAnswers = (data.correctAnswers as string[]) ?? []
  const correctYear = data.correctYear as number | undefined
  const correctValue = data.correctValue as number | undefined
  const total = Object.values(responses).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Question */}
      <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm">
        <p className="mb-0.5 text-xs text-white/30">
          {QUESTION_TYPE_LABELS[type] ?? type}
        </p>
        <p className="line-clamp-2 text-sm font-semibold text-white">
          {question}
        </p>
      </div>

      {/* MCQ */}
      {type === "mcq" && answers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="border-b border-white/5 px-4 py-2.5">
            <p className="text-xs font-semibold tracking-wider text-white/35 uppercase">
              Réponses
            </p>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            {answers.map((answer, i) => {
              const count = responses[i] ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const isCorrect = solutions.includes(i)
              const color = MCQ_COLORS[i % MCQ_COLORS.length]!
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <div
                    className={clsx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white",
                      color.bg,
                    )}
                  >
                    {color.letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-white">
                        {answer}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs font-bold text-white tabular-nums">
                          {count}
                        </span>
                        {isCorrect && (
                          <IconCheck className="h-3.5 w-3.5 text-green-400" />
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all duration-700",
                          isCorrect ? "bg-green-500" : color.bar,
                        )}
                        style={{
                          width: `${pct}%`,
                          opacity: isCorrect ? 1 : 0.6,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs text-white/35 tabular-nums">
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Vrai / Faux */}
      {type === "true_false" && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="border-b border-white/5 px-4 py-2.5">
            <p className="text-xs font-semibold tracking-wider text-white/35 uppercase">
              Réponses
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-3">
            {["Vrai", "Faux"].map((label, i) => {
              const count = responses[i] ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const isCorrect = solutions.includes(i)
              return (
                <div
                  key={i}
                  className={clsx(
                    "rounded-xl border p-3 text-center",
                    isCorrect
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-white/8 bg-white/4",
                  )}
                >
                  <p className="text-2xl font-black text-white tabular-nums">
                    {count}
                  </p>
                  <p className="text-xs text-white/50">{label}</p>
                  <p className="text-xs font-semibold text-white/35 tabular-nums">
                    {pct}%
                  </p>
                  {isCorrect && (
                    <IconCheck className="mx-auto mt-1.5 h-4 w-4 text-green-400" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Réponse ouverte */}
      {type === "open" && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="border-b border-white/5 px-4 py-2.5">
            <p className="text-xs font-semibold tracking-wider text-white/35 uppercase">
              Réponses acceptées
            </p>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {correctAnswers.map((ans, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/8 px-3 py-2.5"
              >
                <IconCheck className="h-4 w-4 shrink-0 text-green-400" />
                <span className="text-sm font-semibold text-green-300">
                  {ans}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 px-4 py-2.5">
            <p className="text-xs text-white/25">
              {total} réponse{total !== 1 ? "s" : ""} reçue
              {total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Date / Slider */}
      {(type === "date" || type === "slider") && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-sm">
          <p className="mb-1 text-xs tracking-wider text-white/35 uppercase">
            Bonne réponse
          </p>
          <p className="text-4xl font-black text-green-400 tabular-nums">
            {type === "date"
              ? String(correctYear ?? "—")
              : String(correctValue ?? "—")}
          </p>
          <p className="mt-2 text-xs text-white/25">
            {total} réponse{total !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Puzzle */}
      {type === "puzzle" && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
          <p className="mb-2 text-xs tracking-wider text-white/35 uppercase">
            Ordre correct
          </p>
          <div className="flex flex-col gap-2">
            {((data.items as string[]) ?? []).map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2"
              >
                <span className="text-xs font-black text-orange-400">
                  {i + 1}
                </span>
                <span className="text-sm text-white">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop Pin */}
      {type === "drop_pin" && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-sm">
          <p className="mb-1 text-xs tracking-wider text-white/35 uppercase">
            Zones de marquage
          </p>
          <div className="flex flex-col gap-2">
            {(
              (data.zones as { x: number; y: number; radius: number }[]) ?? []
            ).map((z, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-white/60"
              >
                <div className="h-2 w-2 rounded-full bg-orange-500" />
                <span>
                  Zone {i + 1} : {Math.round(z.x)}%, {Math.round(z.y)}% (r=
                  {Math.round(z.radius)}px)
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/25">
            {total} réponse{total !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Affichage Solution ───────────────────────────────────────────────────────

function SolutionDisplay({ data }: { data: Record<string, unknown> }) {
  const type = String(data.type ?? "")
  const solutions = (data.solutions as number[]) ?? []
  const answers = (data.answers as string[]) ?? []
  const correctAnswers = (data.correctAnswers as string[]) ?? []
  const correctYear = data.correctYear as number | undefined
  const correctValue = data.correctValue as number | undefined
  const items = (data.items as string[]) ?? []
  const zones = (data.zones as { x: number; y: number; radius: number }[]) ?? []

  const hasSolution =
    solutions.length > 0 ||
    correctAnswers.length > 0 ||
    correctYear !== undefined ||
    correctValue !== undefined ||
    items.length > 0 ||
    zones.length > 0

  if (!hasSolution) return null

  return (
    <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20">
          <IconCheck className="h-3 w-3 text-green-400" />
        </div>
        <span className="text-xs font-bold tracking-widest text-green-400/80 uppercase">
          Solution
        </span>
      </div>

      <div className="text-sm font-semibold text-white">
        {type === "mcq" && (
          <div className="flex flex-wrap gap-2">
            {solutions.map((idx) => (
              <span
                key={idx}
                className="rounded-lg bg-green-500/20 px-2 py-1 text-green-300"
              >
                {answers[idx] || `Option ${idx + 1}`}
              </span>
            ))}
          </div>
        )}
        {type === "true_false" && (
          <span className="text-green-300">
            {solutions[0] === 0 ? "Vrai" : "Faux"}
          </span>
        )}
        {type === "open" && (
          <div className="flex flex-wrap gap-2">
            {correctAnswers.map((ans, i) => (
              <span
                key={i}
                className="rounded-lg bg-green-500/20 px-2 py-1 text-green-300"
              >
                {ans}
              </span>
            ))}
          </div>
        )}
        {type === "date" && (
          <span className="text-2xl font-black text-green-300 tabular-nums">
            {correctYear}
          </span>
        )}
        {type === "slider" && (
          <span className="text-2xl font-black text-green-300 tabular-nums">
            {correctValue}
          </span>
        )}
        {type === "puzzle" && (
          <div className="flex flex-col gap-1.5">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-white/80"
              >
                <span className="font-black text-green-400">{i + 1}.</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
        {type === "drop_pin" && (
          <div className="text-xs text-green-300/70">
            {zones.length} zone(s) cible(s) définie(s)
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SHOW_LEADERBOARD ─────────────────────────────────────────────────────────

function LeaderboardPanel({ data }: { data: Record<string, unknown> }) {
  type LeaderRow = {
    id: string
    username: string
    points: number
    roundPoints?: number
  }
  const roundLB = (data.roundLeaderboard as LeaderRow[]) ?? []
  const leaderboard = (data.leaderboard as LeaderRow[]) ?? []

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Manche en cours */}
      {roundLB.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
            <svg
              className="h-4 w-4 text-orange-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <p className="text-xs font-semibold tracking-wider text-white/45 uppercase">
              Cette manche
            </p>
          </div>
          <div className="flex flex-col gap-0 divide-y divide-white/5 px-3 py-2">
            {roundLB.slice(0, 5).map((player, i) => (
              <div key={player.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-base">
                  {RANK_MEDALS[i] ?? `${i + 1}.`}
                </span>
                <span className="flex-1 truncate text-sm font-semibold text-white">
                  {player.username}
                </span>
                <span className="text-sm font-bold text-orange-400 tabular-nums">
                  +{player.roundPoints ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classement général */}
      {leaderboard.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
            <IconTrophy className="h-4 w-4 text-white/40" />
            <p className="text-xs font-semibold tracking-wider text-white/40 uppercase">
              Classement général
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {leaderboard.slice(0, 5).map((player, i) => (
              <div
                key={player.id}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3",
                  i === 0 && "bg-yellow-500/5",
                  i === 1 && "bg-slate-400/5",
                  i === 2 && "bg-orange-700/5",
                )}
              >
                <div
                  className={clsx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-black",
                    i === 0 &&
                      "border-yellow-500/40 bg-yellow-500/15 text-yellow-300",
                    i === 1 &&
                      "border-slate-400/30 bg-slate-400/10 text-slate-300",
                    i === 2 &&
                      "border-orange-600/30 bg-orange-700/10 text-orange-400",
                    i >= 3 && "border-white/10 bg-white/5 text-white/35",
                  )}
                >
                  {i + 1}
                </div>
                <span className="flex-1 truncate text-sm font-semibold text-white">
                  {player.username}
                </span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {player.points.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FINISHED ─────────────────────────────────────────────────────────────────

function FinishedPanel({ data }: { data: Record<string, unknown> }) {
  type TopPlayer = { username: string; points: number }
  const top = (data.top as TopPlayer[]) ?? []
  const subject = String(data.subject ?? "Quiz")

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="py-4 text-center">
        <div className="mb-3 text-5xl">🎉</div>
        <h2 className="text-xl font-black text-white">{subject}</h2>
        <p className="mt-1 text-sm text-white/35">Quiz terminé !</p>
      </div>

      {top.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="border-b border-white/5 px-4 py-2.5">
            <p className="text-xs font-semibold tracking-wider text-white/40 uppercase">
              Podium
            </p>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            {top.map((player, i) => (
              <div
                key={player.username}
                className={clsx(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  i === 0 && "border-yellow-500/30 bg-yellow-500/10",
                  i === 1 && "border-slate-400/20 bg-slate-400/8",
                  i === 2 && "border-orange-700/25 bg-orange-700/10",
                )}
              >
                <span className="text-2xl">{RANK_MEDALS[i]}</span>
                <span className="flex-1 truncate font-bold text-white">
                  {player.username}
                </span>
                <span className="font-black text-white tabular-nums">
                  {player.points.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Panneau joueurs ──────────────────────────────────────────────────────────

function PlayersPanel({
  players,
  statusName,
  answerCount,
  kickTargetId,
  setKickTargetId,
  onKick,
}: {
  players: Player[]
  statusName: Status | undefined
  answerCount: number
  kickTargetId: string | null
  setKickTargetId: (id: string | null) => void
  onKick: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-white/45 uppercase">
          Joueurs ({players.length})
        </h2>
        <p className="text-xs text-white/25">Appuyer pour expulser</p>
      </div>

      {players.length === 0 ? (
        <p className="py-12 text-center text-sm text-white/25">
          Aucun joueur connecté
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="divide-y divide-white/5">
            {players.map((player, i) => {
              const isTarget = kickTargetId === player.id
              const hasAnswered =
                statusName === STATUS.SELECT_ANSWER && i < answerCount

              return (
                <div
                  key={player.id}
                  onClick={() => setKickTargetId(isTarget ? null : player.id)}
                  className={clsx(
                    "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                    isTarget
                      ? "bg-red-500/10"
                      : "hover:bg-white/3 active:bg-white/5",
                  )}
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-orange-500/25 to-violet-500/25 text-sm font-bold text-white">
                    {player.username[0]?.toUpperCase()}
                  </div>

                  {/* Nom + points */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {player.username}
                    </p>
                    <p className="text-xs text-white/35 tabular-nums">
                      {player.points.toLocaleString()} pts
                    </p>
                  </div>

                  {/* Statut réponse */}
                  {statusName === STATUS.SELECT_ANSWER && (
                    <div
                      className={clsx(
                        "h-2 w-2 shrink-0 rounded-full",
                        hasAnswered
                          ? "bg-green-400"
                          : "animate-pulse bg-white/20",
                      )}
                    />
                  )}

                  {/* Connexion */}
                  <div
                    className={clsx(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      player.connected ? "bg-green-400" : "bg-white/15",
                    )}
                  />

                  {/* Bouton expulsion */}
                  {isTarget ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onKick(player.id)
                      }}
                      className="shrink-0 rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-red-400 active:scale-95"
                    >
                      Expulser
                    </button>
                  ) : (
                    <svg
                      className="h-4 w-4 shrink-0 text-white/15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Barre inférieure ─────────────────────────────────────────────────────────

function BottomBar({
  activeTab,
  setActiveTab,
  primaryAction,
  onPrimary,
  onStartDemo,
  isPending,
  playerCount,
  statusName,
}: {
  activeTab: RemoteTab
  setActiveTab: (t: RemoteTab) => void
  primaryAction: PrimaryAction | null
  onPrimary: () => void
  onStartDemo: () => void
  isPending: boolean
  playerCount: number
  statusName?: Status
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-black/70 px-4 pt-3 pb-6 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[430px] items-center gap-3">
        {/* Tab Jeu */}
        <button
          onClick={() => setActiveTab("jeu")}
          className={clsx(
            "flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all",
            activeTab === "jeu"
              ? "bg-orange-500/15 text-orange-400"
              : "text-white/35 hover:text-white/60",
          )}
        >
          <IconDisplay className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Jeu</span>
        </button>

        {/* Tab Joueurs */}
        <button
          onClick={() => setActiveTab("joueurs")}
          className={clsx(
            "relative flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all",
            activeTab === "joueurs"
              ? "bg-orange-500/15 text-orange-400"
              : "text-white/35 hover:text-white/60",
          )}
        >
          <IconUsers className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Joueurs</span>
          {playerCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white">
              {playerCount > 9 ? "9+" : playerCount}
            </span>
          )}
        </button>

        {/* Action principale */}
        <div className="flex flex-1 gap-2">
          {statusName === STATUS.SHOW_ROOM && (
            <button
              onClick={onStartDemo}
              disabled={isPending}
              className="h-12 flex-1 rounded-2xl bg-white/10 text-sm font-bold text-white transition-all hover:bg-white/15 active:scale-95 disabled:opacity-50"
            >
              Mode Démo
            </button>
          )}
          {primaryAction && (
            <button
              onClick={onPrimary}
              disabled={primaryAction.disabled || isPending}
              className={clsx(
                "h-12 flex-1 rounded-2xl text-sm font-black tracking-wide transition-all active:scale-95",
                isPending && "cursor-not-allowed opacity-50",
                !isPending && !primaryAction.disabled && "shadow-lg",
                primaryAction.variant === "orange" &&
                  !primaryAction.disabled &&
                  "bg-orange-500 text-white shadow-orange-500/30 hover:bg-orange-400",
                primaryAction.variant === "red" &&
                  !primaryAction.disabled &&
                  "bg-red-500 text-white shadow-red-500/25 hover:bg-red-400",
                primaryAction.variant === "ghost" &&
                  !primaryAction.disabled &&
                  "bg-white/85 text-gray-900 hover:bg-white",
                primaryAction.disabled &&
                  "cursor-not-allowed bg-white/8 text-white/25",
              )}
            >
              {isPending ? "..." : primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal de confirmation d'expulsion ────────────────────────────────────────

function KickModal({
  player,
  onConfirm,
  onCancel,
}: {
  player: Player | undefined
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!player) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 text-center">
          <div className="mb-2 text-3xl">⚠️</div>
          <h3 className="text-lg font-bold text-white">Expulser ce joueur ?</h3>
          <p className="mt-1 font-semibold text-orange-400">
            {player.username}
          </p>
          <p className="mt-1 text-sm text-white/35">
            Cette action est définitive.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl bg-white/8 py-3 font-semibold text-white transition-colors hover:bg-white/15"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-red-500 py-3 font-bold text-white transition-colors hover:bg-red-400 active:scale-95"
          >
            Expulser
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getPrimaryAction(
  status: GameStatus,
  playerCount: number,
  t: (key: string) => string,
): PrimaryAction | null {
  if (!status) return null
  const { name } = status

  // État initial : Salle d'attente
  if (name === STATUS.SHOW_ROOM) {
    return {
      label:
        playerCount > 0 ? t("game:startGame") : t("game:waitingForPlayers"),
      disabled: playerCount === 0,
      variant: "orange",
    }
  }

  // Vérification des boutons de skip configurés dans les constantes
  const skipKey = isKeyOf(MANAGER_SKIP_BTN, name)
    ? MANAGER_SKIP_BTN[name]
    : null

  if (skipKey) {
    return {
      label: t(skipKey),
      disabled: false,
      variant: name === STATUS.SELECT_ANSWER ? "red" : "orange",
    }
  }

  // État final : Terminé
  if (name === STATUS.FINISHED) {
    return {
      label: t("common:exit"),
      disabled: false,
      variant: "ghost",
    }
  }

  return null
}
