import background from "@rahoot/web/assets/background.png"
import Logo from "@rahoot/web/components/Logo"
import LanguageSwitcher from "@rahoot/web/components/LanguageSwitcher"
import { EVENTS } from "@rahoot/common/constants"
import type { ManagerConfig } from "@rahoot/common/types/manager"
import { useSocket } from "@rahoot/web/features/game/contexts/socket-context"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { ConfigProvider } from "@rahoot/web/features/manager/contexts/config-context"
import DashboardSidebar from "./DashboardSidebar"
import QuizzPanel from "./QuizzPanel"
import ResultsPanel from "./ResultsPanel"
import EveningFooter from "./EveningFooter"
import PowerUpsSettingsModal from "./PowerUpsSettingsModal"
import { LogOut, Play, PartyPopper, Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import clsx from "clsx"
import toast from "react-hot-toast"

type Props = { data: ManagerConfig }

const ManagerDashboard = ({ data }: Props) => {
  const { reset } = useManagerStore()
  const { socket } = useSocket()
  const { t } = useTranslation()
  const [selectedQuizz, setSelectedQuizz] = useState<string | null>(null)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"quizz" | "results">("quizz")
  const [eveningMode, setEveningMode] = useState(false)
  const [eveningQuizIds, setEveningQuizIds] = useState<string[]>([])
  const [powerUpsEnabled, setPowerUpsEnabled] = useState(true)
  const [singlePowerUpsEnabled, setSinglePowerUpsEnabled] = useState(false)
  const [disabledPowerUps, setDisabledPowerUps] = useState<string[]>([])
  const [powerUpsModalOpen, setPowerUpsModalOpen] = useState(false)
  const [powerUpsModalMode, setPowerUpsModalMode] = useState<
    "single" | "evening"
  >("single")

  const handleLogout = () => {
    socket?.emit(EVENTS.MANAGER.LOGOUT)
    reset(true)
  }

  const handleMoveToFolder = (quizzId: string, folder: string | null) => {
    socket?.emit(EVENTS.QUIZZ.MOVE_FOLDER, { id: quizzId, folder })
  }

  const handleStart = () => {
    if (!selectedQuizz) {
      toast.error(t("manager:quizz.pleaseSelect"))

      return
    }

    socket?.emit(EVENTS.GAME.CREATE, {
      quizId: selectedQuizz,
      powerUpsEnabled: singlePowerUpsEnabled,
      disabledPowerUps,
    })
  }

  const handleEveningStart = () => {
    if (eveningQuizIds.length < 2) {
      toast.error(t("manager:evening.selectTwo", "Sélectionne au moins 2 quiz"))

      return
    }

    socket?.emit(EVENTS.EVENING.START, {
      quizIds: eveningQuizIds,
      powerUpsEnabled,
      disabledPowerUps,
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

  const selectedName = data.quizz.find((q) => q.id === selectedQuizz)?.subject

  return (
    <ConfigProvider data={data}>
      <div
        className="relative flex h-dvh flex-col overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${background})` }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/55" />

        {/* Header */}
        <header className="relative z-10 flex h-20 shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-5 backdrop-blur-md">
          <Logo className="h-16" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title={t("manager:logout")}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="relative z-10 flex min-h-0 flex-1 gap-3 p-3">
          <DashboardSidebar
            activeFolder={activeFolder}
            setActiveFolder={setActiveFolder}
            activeTag={activeTag}
            setActiveTag={setActiveTag}
            view={view}
            setView={setView}
            onMoveToFolder={handleMoveToFolder}
          />
          <div className="min-h-0 flex-1">
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
            onRemove={handleToggleEveningQuizz}
            onStart={handleEveningStart}
            onToggleOff={handleToggleEveningOff}
            onOpenPowerUpsConfig={() => {
              setPowerUpsModalMode("evening")
              setPowerUpsModalOpen(true)
            }}
          />
        ) : (
          <footer className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-black/30 px-5 backdrop-blur-md">
            <div className="flex items-center gap-3 overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setEveningMode(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setEveningMode(true)
                  }
                }}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white/60 ring-1 ring-white/10 transition-colors select-none hover:bg-orange-500/20 hover:text-orange-300 hover:ring-orange-500/40"
                title={t("manager:evening.enable", "Mode Soirée")}
              >
                <PartyPopper className="size-4" />
                <span className="hidden sm:inline">
                  {t("manager:evening.mode", "Mode Soirée")}
                </span>
              </div>
              <p className="truncate text-sm text-white/50">
                {selectedName ? (
                  <span className="font-semibold text-white">
                    {selectedName}
                  </span>
                ) : (
                  t("manager:quizz.pleaseSelect")
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPowerUpsModalMode("single")
                  setPowerUpsModalOpen(true)
                }}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors select-none",
                  singlePowerUpsEnabled
                    ? "bg-yellow-500/20 text-yellow-200 ring-1 ring-yellow-500/40 hover:bg-yellow-500/30"
                    : "bg-white/5 text-white/40 ring-1 ring-white/10 hover:bg-white/10",
                )}
                title={t("manager:quizz.powerUpsToggle")}
              >
                <Sparkles className="size-3.5" />
                <span>{t("manager:quizz.powerUps")}</span>
              </button>

              <button
                onClick={handleStart}
                disabled={!selectedQuizz}
                className={clsx(
                  "flex shrink-0 items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all",
                  selectedQuizz
                    ? "bg-orange-500 shadow-lg shadow-orange-500/30 hover:scale-105 hover:bg-orange-400"
                    : "cursor-not-allowed bg-white/10 text-white/30",
                )}
              >
                <Play className="size-4 fill-current" />
                {t("manager:quizz.startGame")}
              </button>
            </div>
          </footer>
        )}
      </div>
      <PowerUpsSettingsModal
        isOpen={powerUpsModalOpen}
        onClose={() => setPowerUpsModalOpen(false)}
        powerUpsEnabled={
          powerUpsModalMode === "single"
            ? singlePowerUpsEnabled
            : powerUpsEnabled
        }
        onTogglePowerUps={
          powerUpsModalMode === "single"
            ? setSinglePowerUpsEnabled
            : setPowerUpsEnabled
        }
        disabledPowerUps={disabledPowerUps}
        onChangeDisabledPowerUps={setDisabledPowerUps}
      />
    </ConfigProvider>
  )
}

export default ManagerDashboard
