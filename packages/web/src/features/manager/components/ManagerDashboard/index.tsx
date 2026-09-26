import background from "@rahoot/web/assets/background.png"
import Logo from "@rahoot/web/components/Logo"
import LanguageSwitcher from "@rahoot/web/components/LanguageSwitcher"
import { EVENTS } from "@rahoot/common/constants"
import type { ManagerConfig } from "@rahoot/common/types/manager"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { ConfigProvider } from "@rahoot/web/features/manager/contexts/config-context"
import { translateServerError } from "@rahoot/web/features/manager/utils/errors"
import DashboardSidebar from "./DashboardSidebar"
import QuizzPanel from "./QuizzPanel"
import ResultsPanel from "./ResultsPanel"
import EveningFooter from "./EveningFooter"
import LaunchModal from "./LaunchModal"
import PowerUpsSettingsModal from "./PowerUpsSettingsModal"
import GuestAccountsModal from "./GuestAccountsModal"
import {
  DEFAULT_FAST_MODE_INTENSITY,
  type FastModeIntensity,
} from "@rahoot/common/types/fast-mode"
import { useNavigate } from "@tanstack/react-router"
import {
  Loader2,
  LogOut,
  Menu,
  Play,
  PlayCircle,
  PartyPopper,
  SlidersHorizontal,
  Users,
  WifiOff,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"
import toast from "react-hot-toast"

type Props = { data: ManagerConfig }

// Filet de sécurité du lancement : sans réponse du serveur (ni GAME_CREATED,
// ni erreur) au bout de ce délai, les boutons « Démarrer » sont réactivés.
const START_TIMEOUT_MS = 10000

// Boutons icône du header : cible de 44 px (règle tactile du plan).
const HEADER_ICON_BUTTON =
  "flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"

const ManagerDashboard = ({ data }: Props) => {
  const { reset, setEveningProgress } = useManagerStore()
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Session invité : bibliothèque personnelle uniquement, pas de vraie partie
  // (le bouton Démarrer devient un test solo en mode démo), pas de soirée,
  // pas de power-ups, pas de résultats.
  const isGuest = data.role === "guest"
  const [selectedQuizz, setSelectedQuizz] = useState<string | null>(null)
  const [guestsModalOpen, setGuestsModalOpen] = useState(false)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"quizz" | "results">("quizz")
  const [eveningMode, setEveningMode] = useState(false)
  const [eveningQuizIds, setEveningQuizIds] = useState<string[]>([])
  // Power-ups : un seul réglage partagé par la partie personnalisée et la
  // soirée (comme le mode rapide et le mode sans rapidité), désactivé par
  // défaut dans les deux cas — la liste des power-ups exclus suit le même
  // état, la modale de configuration affiche donc toujours ce qui sera appliqué.
  const [powerUpsEnabled, setPowerUpsEnabled] = useState(false)
  const [disabledPowerUps, setDisabledPowerUps] = useState<string[]>([])
  const [powerUpsModalOpen, setPowerUpsModalOpen] = useState(false)
  const [launchModalOpen, setLaunchModalOpen] = useState(false)
  // Mode sans rapidité : partagé par la partie simple et la soirée — chaque
  // bonne réponse vaut 1000 points quel que soit le temps de réponse.
  const [noSpeedMode, setNoSpeedMode] = useState(false)
  // Mode rapide : partagé lui aussi par la partie simple et la soirée — les
  // questions s'enchaînent sans clic de l'hôte entre elles.
  const [fastMode, setFastMode] = useState(false)
  const [fastModeIntensity, setFastModeIntensity] = useState<FastModeIntensity>(
    DEFAULT_FAST_MODE_INTENSITY,
  )
  // Tiroir de la barre latérale sous `lg` (au-delà, elle reste affichée).
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Lancement en cours : bloque le double clic sur « Démarrer » (qui créait
  // deux parties) jusqu'à la navigation vers le salon ou une erreur serveur.
  const [isStarting, setIsStarting] = useState(false)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopStarting = () => {
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current)
      startTimeoutRef.current = null
    }

    setIsStarting(false)
  }

  const beginStarting = () => {
    stopStarting()
    setIsStarting(true)
    startTimeoutRef.current = setTimeout(() => {
      startTimeoutRef.current = null
      setIsStarting(false)
      toast.error(t("manager:launch.timeout"))
    }, START_TIMEOUT_MS)
  }

  useEffect(
    () => () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
      }
    },
    [],
  )

  // Un quiz supprimé (ici ou depuis un autre onglet) disparaît de la
  // sélection simple comme de la liste de la soirée : sinon la soirée
  // partirait avec un id introuvable côté serveur.
  useEffect(() => {
    const ids = new Set(data.quizz.map((q) => q.id))

    setEveningQuizIds((prev) =>
      prev.every((id) => ids.has(id)) ? prev : prev.filter((id) => ids.has(id)),
    )
    setSelectedQuizz((prev) => (prev && !ids.has(prev) ? null : prev))
  }, [data.quizz])

  // Échec de lancement (quiz introuvable, soirée invalide…) : message traduit
  // au lieu d'un simple console.warn, et boutons de lancement réactivés.
  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    stopStarting()
    toast.error(translateServerError(t, message))
  })

  const handleLogout = () => {
    socket?.emit(EVENTS.MANAGER.LOGOUT)
    // Sans purge, socket-context ré-authentifierait automatiquement à la
    // prochaine reconnexion (cf. restauration de session).
    localStorage.removeItem("rc_pwd")
    localStorage.removeItem("rc_guest")
    reset(true)
    navigate({ to: isGuest ? "/manager/guest" : "/manager" })
  }

  const handleMoveToFolder = (quizzId: string, folder: string | null) => {
    socket?.emit(EVENTS.QUIZZ.MOVE_FOLDER, { id: quizzId, folder })
  }

  // `custom` distingue les deux entrées du footer : « Démarrer » lance une
  // partie standard et IGNORE les réglages de la modale (sinon une option
  // laissée active s'appliquerait en douce à une partie censée être normale),
  // tandis que « Partie personnalisée » les applique tels quels.
  const handleStart = (custom = false) => {
    if (isStarting) {
      return
    }

    if (!selectedQuizz) {
      toast.error(t("manager:quizz.pleaseSelect"))

      return
    }

    setLaunchModalOpen(false)
    beginStarting()
    setEveningProgress(null)

    socket?.emit(EVENTS.GAME.CREATE, {
      quizId: selectedQuizz,
      powerUpsEnabled: isGuest || !custom ? false : powerUpsEnabled,
      disabledPowerUps: isGuest || !custom ? [] : disabledPowerUps,
      noSpeedMode: custom ? noSpeedMode : false,
      fastMode: custom ? fastMode : false,
      fastModeIntensity: custom ? fastModeIntensity : undefined,
    })
  }

  // Test solo invité : la partie vient d'être créée (demoOnly côté serveur),
  // on la bascule aussitôt en mode démo — même flux que le test-drive de
  // l'éditeur. La navigation vers /party/manager est faite par la page config ;
  // `isStarting` reste actif jusqu'au démontage pour bloquer tout second clic.
  useEvent(EVENTS.MANAGER.GAME_CREATED, ({ gameId }) => {
    if (isGuest) {
      socket?.emit(EVENTS.MANAGER.START_DEMO, { gameId })
    }
  })

  const handleEveningStart = () => {
    if (isStarting) {
      return
    }

    if (eveningQuizIds.length < 2) {
      toast.error(t("manager:evening.selectTwo"))

      return
    }

    beginStarting()
    setEveningProgress({ current: 1, total: eveningQuizIds.length })
    socket?.emit(EVENTS.EVENING.START, {
      quizIds: eveningQuizIds,
      powerUpsEnabled,
      disabledPowerUps,
      noSpeedMode,
      fastMode,
      fastModeIntensity,
    })
  }

  const handleToggleEveningQuizz = (id: string) => {
    setEveningQuizIds((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id],
    )
  }

  const handleToggleEveningOff = () => {
    setEveningMode(false)
    setEveningQuizIds([])
  }

  const selectedQuizzMeta = data.quizz.find((q) => q.id === selectedQuizz)
  const selectedName = selectedQuizzMeta?.subject

  const closeSidebar = () => setSidebarOpen(false)
  const canStart = Boolean(selectedQuizz) && !isStarting && isConnected

  return (
    <ConfigProvider data={data}>
      <div
        className="relative flex h-dvh flex-col overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${background})` }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/55" />

        {/* Header */}
        <header className="relative z-10 flex h-20 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className={clsx(HEADER_ICON_BUTTON, "lg:hidden")}
              aria-label={t("manager:sidebar.open")}
              aria-expanded={sidebarOpen}
              aria-controls="manager-sidebar"
            >
              <Menu className="size-5" />
            </button>
            <Logo className="h-12 shrink-0 sm:h-16" />
            {isGuest && (
              <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-300 ring-1 ring-orange-500/40">
                <Users className="size-3.5 shrink-0" />
                <span className="truncate">{data.guestName}</span>
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Connexion perdue : discret, mais visible avant de cliquer sur
                « Démarrer » (les boutons de lancement sont alors bloqués). */}
            {!isConnected && (
              <span
                role="status"
                className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200 ring-1 ring-red-500/40"
                title={t("manager:connection.lostHint")}
              >
                <WifiOff className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {t("manager:connection.lost")}
                </span>
              </span>
            )}
            <LanguageSwitcher />
            {!isGuest && (
              <button
                type="button"
                onClick={() => setGuestsModalOpen(true)}
                className={HEADER_ICON_BUTTON}
                title={t("manager:guest.modalTitle")}
                aria-label={t("manager:guest.modalTitle")}
              >
                <Users className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className={HEADER_ICON_BUTTON}
              title={t("manager:logout")}
              aria-label={t("manager:logout")}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* Main — passe au-dessus du footer quand le tiroir est ouvert (même
            z-index, sinon le footer, plus loin dans le DOM, le recouvrirait). */}
        <main
          className={clsx(
            "relative flex min-h-0 flex-1 gap-3 p-2 sm:p-3",
            sidebarOpen ? "z-30" : "z-10",
          )}
        >
          <DashboardSidebar
            isOpen={sidebarOpen}
            onClose={closeSidebar}
            activeFolder={activeFolder}
            setActiveFolder={setActiveFolder}
            activeTag={activeTag}
            setActiveTag={setActiveTag}
            view={view}
            setView={setView}
            onMoveToFolder={handleMoveToFolder}
          />
          <div className="min-h-0 min-w-0 flex-1">
            {view === "quizz" ? (
              <QuizzPanel
                search={search}
                setSearch={setSearch}
                activeFolder={activeFolder}
                activeTag={activeTag}
                selectedQuizz={selectedQuizz}
                setSelectedQuizz={setSelectedQuizz}
                eveningMode={eveningMode}
                eveningQuizIds={eveningQuizIds}
                onToggleEveningQuizz={handleToggleEveningQuizz}
              />
            ) : (
              <ResultsPanel />
            )}
          </div>
        </main>

        {/* Footer */}
        {eveningMode ? (
          <EveningFooter
            eveningQuizIds={eveningQuizIds}
            quizzList={data.quizz}
            powerUpsEnabled={powerUpsEnabled}
            noSpeedMode={noSpeedMode}
            onToggleNoSpeed={() => setNoSpeedMode((v) => !v)}
            fastMode={fastMode}
            onToggleFastMode={() => setFastMode((v) => !v)}
            fastModeIntensity={fastModeIntensity}
            onFastModeIntensityChange={setFastModeIntensity}
            onRemove={handleToggleEveningQuizz}
            onStart={handleEveningStart}
            isStarting={isStarting}
            isConnected={isConnected}
            onToggleOff={handleToggleEveningOff}
            onOpenPowerUpsConfig={() => setPowerUpsModalOpen(true)}
          />
        ) : (
          <footer className="relative z-10 flex min-h-16 shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-black/30 px-3 py-2 backdrop-blur-md sm:gap-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {!isGuest && (
                <button
                  type="button"
                  onClick={() => setEveningMode(true)}
                  className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white/70 ring-1 ring-white/10 transition-colors select-none hover:bg-orange-500/20 hover:text-orange-300 hover:ring-orange-500/40 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
                  title={t("manager:evening.enable")}
                  aria-label={t("manager:evening.enable")}
                >
                  <PartyPopper className="size-4" />
                  <span className="hidden sm:inline">
                    {t("manager:evening.mode")}
                  </span>
                </button>
              )}
              <p className="truncate text-sm text-white/60">
                {selectedName ? (
                  <span className="font-semibold text-white">
                    {selectedName}
                  </span>
                ) : (
                  t("manager:quizz.pleaseSelect")
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Partie personnalisée : seul chemin qui passe par la modale de
                  réglages. Le bouton principal, lui, rejoint le salon
                  directement avec les valeurs par défaut. */}
              {!isGuest && (
                <button
                  type="button"
                  onClick={() => setLaunchModalOpen(true)}
                  disabled={!canStart}
                  className={clsx(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none sm:px-4",
                    canStart
                      ? "bg-white/10 text-white/70 ring-1 ring-white/15 hover:bg-white/15 hover:text-white"
                      : "cursor-not-allowed bg-white/5 text-white/30",
                  )}
                  title={t("manager:launch.customHint")}
                  aria-label={t("manager:launch.custom")}
                >
                  <SlidersHorizontal className="size-4" />
                  <span className="hidden sm:inline">
                    {t("manager:launch.custom")}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleStart()}
                disabled={!canStart}
                aria-busy={isStarting}
                className={clsx(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:outline-none sm:px-6",
                  canStart
                    ? "bg-orange-500 shadow-lg shadow-orange-500/30 hover:scale-105 hover:bg-orange-400"
                    : "cursor-not-allowed bg-white/10 text-white/40",
                )}
              >
                {isStarting && <Loader2 className="size-4 animate-spin" />}
                {!isStarting && isGuest && <PlayCircle className="size-4" />}
                {!isStarting && !isGuest && (
                  <Play className="size-4 fill-current" />
                )}
                {isGuest
                  ? t("manager:guest.testQuizz")
                  : t("manager:quizz.startGame")}
              </button>
            </div>
          </footer>
        )}
      </div>
      {!isGuest && guestsModalOpen && (
        <GuestAccountsModal
          onClose={() => setGuestsModalOpen(false)}
          guests={data.guests ?? []}
        />
      )}
      {launchModalOpen && (
        <LaunchModal
          onClose={() => setLaunchModalOpen(false)}
          quizz={selectedQuizzMeta}
          isGuest={isGuest}
          fastMode={fastMode}
          onToggleFastMode={setFastMode}
          fastModeIntensity={fastModeIntensity}
          onIntensityChange={setFastModeIntensity}
          noSpeedMode={noSpeedMode}
          onToggleNoSpeed={setNoSpeedMode}
          powerUpsEnabled={powerUpsEnabled}
          onOpenPowerUpsConfig={() => setPowerUpsModalOpen(true)}
          onStart={() => handleStart(true)}
          isStarting={isStarting}
        />
      )}
      {powerUpsModalOpen && (
        <PowerUpsSettingsModal
          onClose={() => setPowerUpsModalOpen(false)}
          powerUpsEnabled={powerUpsEnabled}
          onTogglePowerUps={setPowerUpsEnabled}
          disabledPowerUps={disabledPowerUps}
          onChangeDisabledPowerUps={setDisabledPowerUps}
        />
      )}
    </ConfigProvider>
  )
}

export default ManagerDashboard
