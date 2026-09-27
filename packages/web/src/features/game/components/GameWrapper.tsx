import { EVENTS } from "@rahoot/common/constants"
import { STATUS, type Status } from "@rahoot/common/types/game/status"
import {
  POWER_UP_CATALOG,
  POWER_UP_TYPE,
  type PowerUp,
  type PowerUpType,
} from "@rahoot/common/types/powerup"
import background from "@rahoot/web/assets/background.png"
import GameAvatar from "@rahoot/web/features/game/components/GameAvatar"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import {
  type EveningProgress,
  useManagerStore,
} from "@rahoot/web/features/game/stores/manager"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { useSoundStore } from "@rahoot/web/features/game/stores/sound"
import { useYoutubeDuration } from "@rahoot/web/features/game/hooks/useYoutubeDuration"
import { MANAGER_SKIP_BTN } from "@rahoot/web/features/game/utils/constants"
import AnimatedPoints from "@rahoot/web/features/game/components/AnimatedPoints"
import EveningInterstitiel from "@rahoot/web/features/game/components/states/EveningInterstitiel"
import PowerUpBar from "@rahoot/web/features/game/components/PowerUpBar"
import PowerUpEarnedToast from "@rahoot/web/features/game/components/PowerUpEarnedToast"
import PowerUpConfirmDrawer from "@rahoot/web/features/game/components/PowerUpConfirmDrawer"
import PowerUpEffectToast from "@rahoot/web/features/game/components/PowerUpEffectToast"
import {
  isAttackEffect,
  PowerUpAttackLayer,
  usePowerUpAttackQueue,
} from "@rahoot/web/features/game/components/PowerUpAttackAnnounce"
import ShopDrawer from "@rahoot/web/features/game/components/ShopDrawer"
import useWakeLock from "@rahoot/web/features/game/hooks/useWakeLock"
import clsx from "clsx"
import { Coins, Volume2, VolumeX } from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  type PropsWithChildren,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { assetPreloader } from "@rahoot/web/features/game/services/asset-preloader"
import { AnimatePresence, motion } from "motion/react"
import { stateTransition } from "@rahoot/web/features/game/utils/motion"

type EveningLeaderboardEntry = {
  id: string
  username: string
  avatar?: string
  points: number
  quizPoints?: number
  rank: number
}

type EveningData = {
  gameId: string
  quizIndex: number
  totalQuizzes: number
  subject: string
  leaderboard: EveningLeaderboardEntry[]
}

type GameConfig = {
  isHost: boolean
  isEveningFinale: boolean
  // Vrai pendant la phase de réponses qui suit l'usage d'un FREEZE : sert à
  // l'indicateur visuel du timer sur l'écran principal.
  isFreezeRound: boolean
}

const GameConfigContext = createContext<GameConfig>({
  isHost: false,
  isEveningFinale: false,
  isFreezeRound: false,
})

// Phases pendant lesquelles un power-up ne peut pas être joué : salon, pause,
// duel de départage et fin de partie. La barre reste visible mais grisée.
const POWER_UP_LOCKED_PHASES = new Set<Status>([
  STATUS.SHOW_ROOM,
  STATUS.PAUSED,
  STATUS.FINISHED,
  STATUS.SHOW_TIE_BREAK,
  STATUS.SHOW_TIE_BREAK_SPECTATE,
  STATUS.SHOW_TIE_BREAK_RESULT,
])

// Phases qui ouvrent un nouveau quiz : l'inventaire peut y avoir été remis à
// zéro côté serveur (enchaînement de soirée), on le redemande.
const INVENTORY_REFRESH_PHASES = new Set<Status | undefined>([
  STATUS.SHOW_ROOM,
  STATUS.SHOW_START,
])

// Délai max d'attente de l'accusé d'utilisation d'un power-up.
const POWER_UP_ACK_TIMEOUT = 4000

// Durée d'affichage du badge « NOUVEAU ! » sur un power-up fraîchement obtenu.
const NEW_POWER_UP_BADGE_MS = 2000

export const useGameConfig = () => useContext(GameConfigContext)

type Props = PropsWithChildren & {
  statusName: Status | undefined
  onNext?: () => void
  manager?: boolean
}

type PlayerBarProps = {
  barRef: RefObject<HTMLDivElement | null>
  player: { username?: string; avatar?: string; points?: number } | null
  coins: number | null
  onOpenShop: () => void
  powerUps: PowerUp[]
  onUsePowerUp: (_powerUp: PowerUp) => void
  freshPowerUpIds: string[]
  powerUpsLocked: boolean
}

// Barre joueur en bas d'écran : avatar, pseudo, boutique, power-ups, points.
// Les marges suivent la safe-area (encoche, indicateur d'accueil iOS).
const PlayerBar = ({
  barRef,
  player,
  coins,
  onOpenShop,
  powerUps,
  onUsePowerUp,
  freshPowerUpIds,
  powerUpsLocked,
}: PlayerBarProps) => {
  const { t } = useTranslation()

  return (
    <div
      ref={barRef}
      className="absolute right-0 bottom-0 left-0 z-20 flex items-center gap-3 bg-black/60 px-[max(0.75rem,env(safe-area-inset-left))] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      {/* Avatar */}
      {player?.avatar && (
        <GameAvatar
          seed={player.avatar}
          animated
          className="border-primary h-11 w-11 shrink-0 rounded-full border-2"
        />
      )}
      {/* Pseudo */}
      <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
        {player?.username}
      </p>
      {/* Boutique : solde de pièces cliquable (uniquement si power-ups actifs) */}
      {coins !== null && (
        <button
          onClick={onOpenShop}
          className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg bg-yellow-500/20 px-2.5 py-1.5 text-sm font-black text-yellow-300 ring-1 ring-yellow-500/40 transition-colors hover:bg-yellow-500/30 active:scale-95"
          title={t("game:shop.open")}
          aria-label={`${t("game:shop.open")} (${coins})`}
        >
          <Coins className="size-4" aria-hidden="true" />
          <span className="tabular-nums">{coins}</span>
        </button>
      )}
      {/* Power-ups inline */}
      {powerUps.length > 0 && (
        <PowerUpBar
          powerUps={powerUps}
          onUse={onUsePowerUp}
          freshIds={freshPowerUpIds}
          disabled={powerUpsLocked}
          compact
        />
      )}
      {/* Points */}
      <div className="anim-pop-in bg-primary/20 text-primary ring-primary/40 shrink-0 rounded-lg px-3 py-1.5 text-sm font-black ring-1">
        <AnimatedPoints to={player?.points ?? 0} className="mr-1" />
        pts
      </div>
    </div>
  )
}

// Barre « Quiz 1/3 » en haut de l'écran principal pendant une soirée.
const EveningProgressBar = ({ progress }: { progress: EveningProgress }) => {
  const { t } = useTranslation()
  const ratio = Math.min(1, progress.current / Math.max(1, progress.total))

  return (
    <div className="pointer-events-none absolute top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 z-30 flex w-56 -translate-x-1/2 flex-col gap-1.5 rounded-xl border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-md">
      <span className="text-center text-sm font-bold text-white tabular-nums">
        {t("game:evening.progressShort", {
          current: progress.current,
          total: progress.total,
        })}
      </span>
      <div
        className="h-1.5 w-full rounded-full bg-orange-500/30"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.current}
      >
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-500"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}

const GameWrapper = ({ children, statusName, onNext, manager }: Props) => {
  const { isConnected, socket } = useSocket()
  const { muted, toggleMuted } = useSoundStore()
  const { player, gameId: playerGameId, updatePoints } = usePlayerStore()
  const {
    gameId: managerGameId,
    inviteCode,
    eveningProgress,
    setEveningProgress,
  } = useManagerStore()
  const { questionStates, setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()
  const [isDisabled, setIsDisabled] = useState(false)
  const [eveningData, setEveningData] = useState<EveningData | null>(null)
  const [powerUps, setPowerUps] = useState<PowerUp[]>([])
  const [earnedPowerUp, setEarnedPowerUp] = useState<PowerUp | null>(null)
  const [drawerPowerUp, setDrawerPowerUp] = useState<PowerUp | null>(null)
  const [coins, setCoins] = useState<number | null>(null)
  const [disabledPowerUps, setDisabledPowerUps] = useState<string[]>([])
  const [shopOpen, setShopOpen] = useState(false)
  const [isEveningFinale, setIsEveningFinale] = useState(false)
  const [isFreezeRound, setIsFreezeRound] = useState(false)
  const freezePendingRef = useRef(false)
  const [freshPowerUpIds, setFreshPowerUpIds] = useState<string[]>([])
  const playerBarRef = useRef<HTMLDivElement>(null)
  const [playerBarHeight, setPlayerBarHeight] = useState<number | null>(null)
  const [otherPlayers, setOtherPlayers] = useState<
    { id: string; username: string; avatar?: string }[]
  >([])
  const next = statusName ? MANAGER_SKIP_BTN[statusName] : null
  const activeGameId = managerGameId ?? playerGameId

  // Seul l'écran principal héberge les lecteurs vidéo/audio : c'est donc lui
  // qui remonte la durée réelle d'une vidéo sans borne de fin, pour que le
  // serveur étende la manche si le média dépasse le temps imparti.
  const reportVideoDuration = useCallback(
    (duration: number) => {
      if (!managerGameId) {
        return
      }

      socket?.emit(EVENTS.GAME.VIDEO_DURATION, {
        gameId: managerGameId,
        duration,
      })
    },
    [socket, managerGameId],
  )

  useYoutubeDuration(
    Boolean(manager && managerGameId && statusName === STATUS.SELECT_ANSWER),
    reportVideoDuration,
  )

  // Écran maintenu allumé pendant toute la partie (joueur ET écran principal) :
  // un téléphone qui se verrouille dans le salon = socket mort = question ratée.
  useWakeLock()

  useEvent(EVENTS.GAME.UPDATE_QUESTION, ({ current, total }) => {
    setQuestionStates({ current, total })
  })

  const { setCooldown } = useQuestionStore()
  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    toast.error(t(message))
    setIsDisabled(false)
  })

  useEvent(EVENTS.EVENING.QUIZ_COMPLETE, (data) => {
    if (!activeGameId) {
      return
    }

    setEveningData({ gameId: activeGameId, ...data })

    // Écran principal : la barre « Quiz x/y » passe au quiz suivant.
    if (manager) {
      setEveningProgress({
        current: Math.min(data.quizIndex + 2, data.totalQuizzes),
        total: data.totalQuizzes,
      })
    }
  })

  // Fin de soirée : le podium FINISHED qui suit doit s'afficher en mode « soirée ».
  useEvent(EVENTS.EVENING.COMPLETE, () => {
    setIsEveningFinale(true)
  })

  useEvent(EVENTS.POWER_UP.EARNED, (powerUp) => {
    setPowerUps((prev) => [...prev.slice(-2), powerUp])
    setEarnedPowerUp(powerUp)
    setFreshPowerUpIds((prev) => [...prev, powerUp.id])
  })

  // Le badge « NOUVEAU ! » s'efface quelques secondes après la dernière obtention.
  useEffect(() => {
    if (freshPowerUpIds.length === 0) {
      return undefined
    }

    const timer = setTimeout(
      () => setFreshPowerUpIds([]),
      NEW_POWER_UP_BADGE_MS,
    )

    return () => clearTimeout(timer)
  }, [freshPowerUpIds])

  useEvent(EVENTS.POWER_UP.INVENTORY, (inventory) => {
    setPowerUps(inventory)
  })

  useEvent(
    EVENTS.POWER_UP.COINS,
    ({ coins: balance, disabledPowerUps: list }) => {
      setCoins(balance)

      if (list) {
        setDisabledPowerUps(list)
      }
    },
  )

  // Demander l'inventaire (joueur uniquement) à l'arrivée dans une partie, à
  // chaque (re)connexion et à l'ouverture d'un nouveau quiz — et non plus à
  // chaque changement de phase : le serveur répond en rediffusant la liste des
  // joueurs, soit une rafale en N² à chaque phase. Entre-temps, l'inventaire
  // est tenu à jour par les events EARNED / INVENTORY poussés par le serveur.
  useEffect(() => {
    if (!manager && socket && isConnected && playerGameId) {
      socket.emit(EVENTS.POWER_UP.GET_INVENTORY)
    }
  }, [manager, socket, isConnected, playerGameId])

  useEffect(() => {
    if (
      !manager &&
      socket?.connected &&
      playerGameId &&
      INVENTORY_REFRESH_PHASES.has(statusName)
    ) {
      socket.emit(EVENTS.POWER_UP.GET_INVENTORY)
    }
    // Uniquement à l'entrée dans une phase d'ouverture de quiz.
  }, [statusName])

  const [globalFlash, setGlobalFlash] = useState<string | null>(null)
  // Annonce plein écran des attaques (écran principal uniquement) : les joueurs
  // gardent le toast, seul le vidéoprojecteur met l'attaque en scène.
  const attackQueue = usePowerUpAttackQueue()

  useEvent(EVENTS.GAME.MEDIA_PRELOAD, (urls) => {
    if (Array.isArray(urls)) {
      if (import.meta.env.DEV) {
        console.log(
          `[MEDIA_PRELOAD] Début du préchargement de ${urls.length} média(s)`,
        )
      }

      void assetPreloader.preload(urls)
    }
  })

  useEvent(EVENTS.PLAYER.SUCCESS_RECONNECT, (data) => {
    if (data.players) {
      const currentUsername = player?.username || data.player.username
      setOtherPlayers(
        data.players.filter((p) => p.username !== currentUsername),
      )
    }
  })

  useEvent(EVENTS.POWER_UP.EFFECT, (effect) => {
    // Les power-ups self-only (effet uniquement sur l'activateur) ne sont pas
    // affichés si ce n'est pas le joueur concerné ou le manager
    const meta = POWER_UP_CATALOG[effect.type]

    // Le gel s'applique au début de la prochaine phase de réponses.
    if (effect.type === POWER_UP_TYPE.FREEZE) {
      freezePendingRef.current = true
    }

    if (
      meta?.target === "SELF" &&
      !manager &&
      effect.activatedByUsername !== player?.username
    ) {
      return
    }

    // Sur l'écran principal, une attaque ciblée devient un moment de jeu :
    // annonce plein écran (qui remplace le toast, redondant) plutôt qu'une
    // pastille dans un coin que personne ne voit depuis la salle.
    if (manager && isAttackEffect(effect.type)) {
      attackQueue.push(effect)
    } else {
      toast.custom(() => <PowerUpEffectToast effect={effect} />, {
        duration: 4000,
      })
    }

    // Flash fullscreen pour les effets globaux légendaires
    if (effect.type === POWER_UP_TYPE.APOCALYPSE) {
      setGlobalFlash("apocalypse")
      setTimeout(() => setGlobalFlash(null), 1500)
    }

    // Si on est un joueur et qu'on fait partie des victimes, on met à jour nos points
    if (!manager && player) {
      const affectedSelf = effect.affectedPlayers.find(
        (p) => p.username === player.username,
      )

      if (affectedSelf) {
        const currentPoints = player.points ?? 0
        updatePoints(currentPoints + affectedSelf.pointsDelta)
      }
    }
  })

  // Attaque stoppée par un SHIELD. Le serveur prévient l'attaquant ; si le
  // défenseur reçoit aussi l'event (defenderId = son socket), il voit que son
  // bouclier a servi.
  useEvent(EVENTS.POWER_UP.BLOCKED, ({ defenderId }) => {
    if (manager) {
      return
    }

    if (defenderId === socket?.id) {
      toast.success(t("game:powerupToast.shieldProtected"), { icon: "🛡️" })

      return
    }

    toast(t("game:powerupToast.attackBlocked"), { icon: "🛡️" })
  })

  useEvent(EVENTS.GAME.NEW_PLAYER, (newPlayer) => {
    if (player && newPlayer.username === player.username) {
      return
    }

    setOtherPlayers((prev) => [
      ...prev.filter((p) => p.id !== newPlayer.id),
      newPlayer,
    ])
  })

  useEvent(EVENTS.GAME.REMOVE_PLAYER, (playerId) => {
    setOtherPlayers((prev) => prev.filter((p) => p.id !== playerId))
  })

  useEffect(() => {
    setIsDisabled(false)
    setCooldown(null)

    if (statusName === STATUS.SHOW_START || statusName === STATUS.SHOW_ROOM) {
      setEveningData(null)
      setIsEveningFinale(false)
    }

    if (statusName === STATUS.SHOW_ROOM) {
      setQuestionStates(null)
    }

    if (statusName === STATUS.SELECT_ANSWER) {
      setIsFreezeRound(freezePendingRef.current)
      freezePendingRef.current = false
    } else {
      setIsFreezeRound(false)
    }
  }, [statusName, setQuestionStates, setCooldown])

  // Hauteur réelle de la barre joueur (safe-area comprise), exposée en
  // variable CSS pour que les écrans réservent exactement cette place.
  useEffect(() => {
    const bar = playerBarRef.current

    if (!bar) {
      return undefined
    }

    const update = () => setPlayerBarHeight(bar.offsetHeight)

    update()
    const ro = new ResizeObserver(update)
    ro.observe(bar)

    return () => ro.disconnect()
  }, [manager, isConnected, statusName])

  // Référence stable : l'interstitiel relançait son compte à rebours à chaque
  // rendu quand cette fonction était recréée inline.
  const handleEveningContinue = useCallback(() => setEveningData(null), [])

  const handleNext = () => {
    if (isDisabled) {
      return
    }

    setIsDisabled(true)
    onNext?.()
  }

  useEffect(() => {
    // Pendant l'interstitiel de soirée, c'est EveningInterstitiel qui pilote
    // l'avancement : on désactive le clic/flèche global de GameWrapper pour ne
    // pas déclencher deux avancements concurrents.
    if (!manager || !next || eveningData) {
      return undefined
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA" ||
          document.activeElement?.getAttribute("contenteditable") === "true"
        ) {
          return
        }

        e.preventDefault()
        handleNext()
      }
    }

    const handleGlobalClick = (e: MouseEvent) => {
      // Ignorer si ce n'est pas un clic gauche
      if (e.button !== 0) {
        return
      }

      const target = e.target as HTMLElement | null

      if (!target) {
        return
      }

      // Ignorer les clics sur les éléments interactifs
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("a") ||
        target.closest("[role='button']") ||
        target.closest(".pointer-events-auto") ||
        target.closest(".bg-primary") ||
        target.closest(".cursor-pointer")
      ) {
        return
      }

      handleNext()
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("click", handleGlobalClick)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("click", handleGlobalClick)
    }
  }, [manager, next, isDisabled, handleNext, eveningData])

  const handleUsePowerUp = (powerUp: PowerUp) => {
    setDrawerPowerUp(powerUp)
  }

  const handleConfirmPowerUp = (targetIds?: string[]) => {
    if (!drawerPowerUp || !playerGameId) {
      return
    }

    if (!socket) {
      return
    }

    const used = drawerPowerUp
    const usedIndex = powerUps.findIndex((p) => p.id === used.id)

    // Retrait optimiste : l'objet disparaît tout de suite de la barre et n'y
    // revient que si le serveur refuse (ack { ok: false }).
    setPowerUps((prev) => prev.filter((p) => p.id !== used.id))
    setDrawerPowerUp(null)

    // Ack optionnel dans le contrat (anciens clients) : `socket.timeout()` ne
    // sait pas le typer, d'où ce délai de garde manuel.
    let settled = false
    const guard = setTimeout(() => {
      if (settled) {
        return
      }

      settled = true
      // Sans accusé, on ignore si l'objet a été consommé : on resynchronise
      // l'inventaire avec le serveur plutôt que de deviner.
      socket.emit(EVENTS.POWER_UP.GET_INVENTORY)
      toast.error(t("errors:powerup.failed"))
    }, POWER_UP_ACK_TIMEOUT)

    socket.emit(
      EVENTS.POWER_UP.USE,
      { gameId: playerGameId, powerUpId: used.id, targetIds },
      (res) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(guard)

        if (res.ok) {
          return
        }

        setPowerUps((prev) => {
          if (prev.some((p) => p.id === used.id)) {
            return prev
          }

          const restored = [...prev]
          const at = usedIndex < 0 ? restored.length : usedIndex
          restored.splice(Math.min(at, restored.length), 0, used)

          return restored
        })
        toast.error(t(res.error || "errors:powerup.failed"))
      },
    )
  }

  const handleBuyPowerUp = (type: PowerUpType) => {
    if (!playerGameId || !socket) {
      return
    }

    socket
      .timeout(4000)
      .emit(
        EVENTS.PLAYER.BUY_POWER_UP,
        { gameId: playerGameId, data: { powerUpType: type } },
        (err, res) => {
          if (err) {
            toast.error(t("errors:shop.failed"))

            return
          }

          if (!res?.success) {
            toast.error(t(res?.error ?? "errors:shop.failed"))
          }
          // Succès : le serveur pousse le power-up (EARNED) + le nouveau solde (COINS).
        },
      )
  }

  const isRoomScreen = !statusName || statusName === STATUS.SHOW_ROOM

  const gameConfig = useMemo(
    () => ({ isHost: Boolean(manager), isEveningFinale, isFreezeRound }),
    [manager, isEveningFinale, isFreezeRound],
  )

  return (
    <GameConfigContext.Provider value={gameConfig}>
      <section
        className="relative flex h-dvh flex-col overflow-hidden bg-slate-950"
        style={{
          ...(!isRoomScreen && {
            backgroundImage: "url(/bg-salon.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }),
          ...(playerBarHeight !== null && {
            ["--player-bar-h" as string]: `${playerBarHeight}px`,
          }),
        }}
      >
        {/* Fond garage uniquement sur l'écran d'attente */}
        {isRoomScreen && (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-65 select-none"
            style={{ backgroundImage: `url(${background})` }}
          />
        )}
        {/* Overlay sombre pendant les questions */}
        {!isRoomScreen && (
          <div className="pointer-events-none absolute inset-0 bg-black/60" />
        )}

        <div className="z-10 flex w-full flex-1 flex-col">
          {!isConnected && !statusName ? null : (
            <>
              {/* Overlay compteur + bouton suivant (superposé, pas une barre) */}
              <div className="pointer-events-none absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 left-3 z-30 flex items-start justify-between gap-2">
                {/* Pas de compteur sur l'écran salon : aucune question n'est
                    en cours et il passerait sous « Fermer la session ». */}
                {questionStates && !isRoomScreen && (
                  <div
                    className={clsx(
                      "pointer-events-auto rounded-xl bg-black/50 font-bold text-white backdrop-blur-sm",
                      // Écran principal : compteur lisible depuis le fond de la salle.
                      manager
                        ? "border border-white/10 px-5 py-2 text-xl tabular-nums md:text-3xl"
                        : "px-4 py-1.5 text-sm",
                    )}
                  >
                    {manager && (
                      <span className="mr-2 text-base font-semibold text-white/60 md:text-xl">
                        {t("game:question")}
                      </span>
                    )}
                    {questionStates.current} / {questionStates.total}
                  </div>
                )}
                {manager && (
                  // Ml-auto : sans le compteur (écran salon), justify-between
                  // collerait les boutons à gauche, sous « Fermer la session ».
                  <div className="ml-auto flex items-start gap-2">
                    <button
                      type="button"
                      onClick={toggleMuted}
                      className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                      aria-label={
                        muted ? t("game:sound.unmute") : t("game:sound.mute")
                      }
                      aria-pressed={muted}
                      title={
                        muted ? t("game:sound.unmute") : t("game:sound.mute")
                      }
                    >
                      {muted ? (
                        <VolumeX className="size-5" aria-hidden="true" />
                      ) : (
                        <Volume2 className="size-5" aria-hidden="true" />
                      )}
                    </button>
                    {next && (
                      <button
                        id="start-round"
                        onClick={handleNext}
                        disabled={isDisabled}
                        className={clsx(
                          "pointer-events-auto min-h-[44px] rounded-xl bg-white/20 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30",
                          isDisabled && "pointer-events-none opacity-50",
                        )}
                      >
                        {t(next)}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Progression de la soirée (écran principal) */}
              {manager && eveningProgress && !eveningData && (
                <EveningProgressBar progress={eveningProgress} />
              )}

              {/* Contenu principal. Fondu enchaîné : sortie et entrée se
                  chevauchent (mode par défaut, pas "wait") — sinon l'ancien
                  état disparaît avant que le nouveau soit visible et on voit
                  le fond générique du conteneur pendant l'intervalle.
                  `absolute inset-0` fait se superposer les deux états
                  pendant le chevauchement au lieu de s'empiler dans le flex. */}
              <AnimatePresence initial={false}>
                <motion.div
                  key={statusName ?? "none"}
                  className="absolute inset-0 flex flex-col"
                  {...stateTransition()}
                >
                  {children}
                </motion.div>
              </AnimatePresence>

              {/* PIN de la partie affiché en bas à gauche de l'écran principal (projecteur) pour reconnexion rapide */}
              {manager && !isRoomScreen && inviteCode && (
                <div className="pointer-events-auto absolute bottom-6 left-6 z-30 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-orange-500/25 hover:bg-slate-900/80">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                    <span className="text-xs font-black">#</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">
                      {t("game:gamePinLabel")}
                    </span>
                    <span className="font-mono text-lg font-black tracking-wider text-white select-all">
                      {inviteCode}
                    </span>
                  </div>
                </div>
              )}

              {/* Interstitiel soirée */}
              {eveningData && (
                <EveningInterstitiel
                  key={`${eveningData.gameId}-${eveningData.quizIndex}`}
                  gameId={eveningData.gameId}
                  quizIndex={eveningData.quizIndex}
                  totalQuizzes={eveningData.totalQuizzes}
                  subject={eveningData.subject}
                  leaderboard={eveningData.leaderboard}
                  onContinue={handleEveningContinue}
                />
              )}

              {/* Toast power-up obtenu */}
              <AnimatePresence>
                {!manager && earnedPowerUp && (
                  <PowerUpEarnedToast
                    powerUp={earnedPowerUp}
                    onDismiss={() => setEarnedPowerUp(null)}
                  />
                )}
              </AnimatePresence>

              {/* Drawer de confirmation */}
              <PowerUpConfirmDrawer
                powerUp={drawerPowerUp}
                players={otherPlayers}
                onConfirm={handleConfirmPowerUp}
                onCancel={() => setDrawerPowerUp(null)}
              />

              {/* Boutique de power-ups */}
              {!manager && coins !== null && (
                <ShopDrawer
                  open={shopOpen}
                  coins={coins}
                  inventoryCount={powerUps.length}
                  disabledPowerUps={disabledPowerUps}
                  onBuy={handleBuyPowerUp}
                  onClose={() => setShopOpen(false)}
                />
              )}

              {/* Flash fullscreen pour effets globaux légendaires (manager uniquement) */}
              <AnimatePresence>
                {manager && globalFlash === "apocalypse" && (
                  <motion.div
                    key="apocalypse-flash"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.7, 0.3, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, times: [0, 0.15, 0.4, 1] }}
                    className="pointer-events-none fixed inset-0 z-60"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(220,38,38,0.9) 0%, rgba(0,0,0,0.7) 70%)",
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Annonce d'attaque plein écran (écran principal) */}
              {manager && (
                <PowerUpAttackLayer
                  current={attackQueue.current}
                  onDone={attackQueue.shift}
                />
              )}

              {/* Barre joueur en bas (overlay) — contient aussi les power-ups */}
              {!manager && (
                <PlayerBar
                  barRef={playerBarRef}
                  player={player}
                  coins={coins}
                  onOpenShop={() => setShopOpen(true)}
                  powerUps={powerUps}
                  onUsePowerUp={handleUsePowerUp}
                  freshPowerUpIds={freshPowerUpIds}
                  powerUpsLocked={
                    !statusName || POWER_UP_LOCKED_PHASES.has(statusName)
                  }
                />
              )}
            </>
          )}
        </div>
      </section>
    </GameConfigContext.Provider>
  )
}

export default GameWrapper
