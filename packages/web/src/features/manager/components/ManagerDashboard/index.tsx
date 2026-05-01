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
import { LogOut, Play } from "lucide-react"
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

  const handleLogout = () => {
    socket?.emit(EVENTS.MANAGER.LOGOUT)
    reset()
  }

  const handleMoveToFolder = (quizzId: string, folder: string | null) => {
    socket?.emit(EVENTS.QUIZZ.MOVE_FOLDER, { id: quizzId, folder })
  }

  const handleStart = () => {
    if (!selectedQuizz) {
      toast.error(t("manager:quizz.pleaseSelect"))
      return
    }
    socket?.emit(EVENTS.GAME.CREATE, selectedQuizz)
  }

  const selectedName = data.quizz.find((q) => q.id === selectedQuizz)?.subject

  return (
    <ConfigProvider data={data}>
      <div
        className="relative flex h-dvh flex-col overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${background})` }}
      >
        <div className="absolute inset-0 bg-black/55 pointer-events-none" />

        {/* Header */}
        <header className="relative z-10 flex h-20 shrink-0 items-center justify-between px-5 bg-black/30 backdrop-blur-md border-b border-white/10">
          <Logo className="h-16" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
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
              />
            ) : (
              <ResultsPanel />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-4 px-5 bg-black/30 backdrop-blur-md border-t border-white/10">
          <p className="truncate text-sm text-white/50">
            {selectedName ? (
              <span className="font-semibold text-white">{selectedName}</span>
            ) : (
              t("manager:quizz.pleaseSelect")
            )}
          </p>
          <button
            onClick={handleStart}
            disabled={!selectedQuizz}
            className={clsx(
              "flex shrink-0 items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all",
              selectedQuizz
                ? "bg-orange-500 hover:bg-orange-400 shadow-lg shadow-orange-500/30 hover:scale-105"
                : "cursor-not-allowed bg-white/10 text-white/30",
            )}
          >
            <Play className="size-4 fill-current" />
            {t("manager:quizz.startGame")}
          </button>
        </footer>
      </div>
    </ConfigProvider>
  )
}

export default ManagerDashboard
