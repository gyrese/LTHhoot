/* eslint-disable no-empty-function */

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@rahoot/common/types/game/socket"
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { io, Socket } from "socket.io-client"
import { v7 as uuid } from "uuid"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import ReconnectingOverlay from "@rahoot/web/features/game/components/ReconnectingOverlay"
import { EVENTS } from "@rahoot/common/constants"
import { useNavigate } from "@tanstack/react-router"

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface SocketContextValue {
  socket: TypedSocket | null
  isConnected: boolean
  isReconnecting: boolean
  clientId: string
  clockOffset: number
  getServerTime: () => number
  connect: () => void
  disconnect: () => void
  reconnect: () => void
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  isReconnecting: false,
  clientId: "",
  clockOffset: 0,
  getServerTime: () => Date.now(),
  connect: () => {},
  disconnect: () => {},
  reconnect: () => {},
})

// Traces de diagnostic réservées au développement : en production elles
// inondaient la console (et coûtaient à chaque event reçu).
const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

// Resynchronisation métier (RECONNECT) : une seule émission par (re)connexion.
// Le provider l'émet au `connect` quand une session est mémorisée, et les pages
// de partie au montage / à la connexion (arrivée dans une partie, store vidé) :
// sans dédoublonnage, le joueur l'émettait 2× et le manager 3× par connexion.
// La clé inclut l'id du socket (nouveau à chaque connexion) ; la fenêtre
// courte laisse passer une resynchronisation volontaire ultérieure.
const RESYNC_DEDUP_WINDOW = 3000
let lastResync: { key: string; at: number } | null = null

export const emitResync = (
  client: TypedSocket,
  role: "player" | "manager",
  gameId: string,
): boolean => {
  const key = `${role}:${gameId}:${client.id ?? ""}`
  const now = Date.now()

  if (
    lastResync &&
    lastResync.key === key &&
    now - lastResync.at < RESYNC_DEDUP_WINDOW
  ) {
    return false
  }

  lastResync = { key, at: now }

  if (role === "player") {
    client.emit(EVENTS.PLAYER.RECONNECT, { gameId })
  } else {
    client.emit(EVENTS.MANAGER.RECONNECT, { gameId })
  }

  return true
}

const getClientId = (): string => {
  try {
    const stored = localStorage.getItem("client_id")

    if (stored) {
      return stored
    }

    const newId = uuid()
    localStorage.setItem("client_id", newId)

    return newId
  } catch {
    return uuid()
  }
}

// Crée le client socket ET attache tous les handlers de façon SYNCHRONE.
// Extrait au niveau module pour pouvoir être appelé depuis l'initialiseur du
// provider (avant tout rendu), garantissant que le socket existe dès la 1re
// frame — sinon `{socket ? children : null}` laisse un écran blanc.
const createSocketClient = (
  clientId: string,
  setIsConnected: (_v: boolean) => void,
  setIsReconnecting: (_v: boolean) => void,
): TypedSocket | null => {
  // Filet de sécurité : si une reconnexion métier est lancée mais que le serveur
  // ne répond jamais (event perdu, partie disparue silencieusement…), on libère
  // l'overlay au bout de RECONNECT_RESOLVE_TIMEOUT plutôt que de rester bloqué.
  const RECONNECT_RESOLVE_TIMEOUT = 5000
  // Fenêtre de reconnexion silencieuse : une réattribution NAT opérateur ou un
  // handover 4G coupe le lien 1-3s (constaté en prod : 23 sessions / 159 avec
  // changement d'IP en cours de partie). Si la reconnexion + resync aboutissent
  // dans cette fenêtre, le joueur ne voit RIEN — l'overlay plein écran n'apparaît
  // que si la coupure dure vraiment. Les réponses émises pendant le blip sont
  // bufferisées par socket.io-client et parties à la reconnexion.
  const SILENT_RECONNECT_GRACE = 2500
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let overlayGraceTimeout: ReturnType<typeof setTimeout> | null = null

  const clearReconnectTimeout = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  const clearOverlayGrace = () => {
    if (overlayGraceTimeout) {
      clearTimeout(overlayGraceTimeout)
      overlayGraceTimeout = null
    }
  }

  // N'affiche l'overlay qu'après SILENT_RECONNECT_GRACE. Ré-armer pendant que le
  // délai court est un no-op : la fenêtre se mesure depuis la coupure initiale.
  const showOverlayAfterGrace = () => {
    if (overlayGraceTimeout) {
      return
    }

    overlayGraceTimeout = setTimeout(() => {
      overlayGraceTimeout = null
      debugLog(
        "[SESSION] Coupure > fenêtre silencieuse, affichage de l'overlay",
      )
      setIsReconnecting(true)
    }, SILENT_RECONNECT_GRACE)
  }

  const finishReconnecting = () => {
    clearReconnectTimeout()
    clearOverlayGrace()
    setIsReconnecting(false)
  }

  const armReconnectTimeout = () => {
    clearReconnectTimeout()
    reconnectTimeout = setTimeout(() => {
      console.warn(
        "[SESSION] Timeout de reconnexion : aucune réponse serveur, libération de l'overlay",
      )
      setIsReconnecting(false)
    }, RECONNECT_RESOLVE_TIMEOUT)
  }

  try {
    const socketClient: TypedSocket = io("/", {
      path: "/ws",
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      // Plafond bas : sur le Wi-Fi d'une salle, 8s de backoff = une question
      // ratée. Les retries polling sont bon marché, on retente vite.
      reconnectionDelayMax: 3000,
      randomizationFactor: 0.5,
      timeout: 20000,
      // Doit refléter le serveur : polling d'abord, puis upgrade WebSocket. Si le
      // proxy bloque l'upgrade, Socket.IO conserve automatiquement le polling —
      // donc aucune rupture sur les réseaux qui n'acceptent pas le WebSocket.
      transports: ["polling", "websocket"],
      upgrade: true,
      auth: {
        clientId,
      },
    })

    socketClient.on("connect", () => {
      const transport = socketClient.io?.engine?.transport?.name
      debugLog(
        `[SOCKET] Connecté (POLLING) socket=${socketClient.id} transport=${transport}`,
      )
      setIsConnected(true)

      // La télécommande restaure elle-même sa partie, sans ancienne session joueur/admin.
      if (window.location.pathname.startsWith("/remote")) {
        finishReconnecting()
        return
      }

      // Tenter une reconnexion métier si on a une session
      const playerGameId = usePlayerStore.getState().gameId
      const managerGameId = useManagerStore.getState().gameId
      const pwd = localStorage.getItem("rc_pwd")
      const guestRaw = localStorage.getItem("rc_guest")

      if (playerGameId) {
        debugLog(`[SESSION] Restauration session Joueur: ${playerGameId}`)
        showOverlayAfterGrace()
        armReconnectTimeout()
        emitResync(socketClient, "player", playerGameId)
      } else {
        // Si on a un mot de passe manager en session, on s'authentifie systématiquement à la reconnexion.
        // Cela permet au manager de rester authentifié sur les écrans hors-partie (config, éditeur)
        // même après une déconnexion réseau ou un redémarrage du serveur.
        // Une session invité (rc_guest) est exclusive de la session admin (rc_pwd).
        if (guestRaw) {
          try {
            const { name, password } = JSON.parse(guestRaw)

            debugLog(
              `[SESSION] Restauration authentification Invité (guest=true)`,
            )
            socketClient.emit(EVENTS.MANAGER.GUEST_AUTH, { name, password })
          } catch {
            localStorage.removeItem("rc_guest")
          }
        } else if (pwd) {
          debugLog(
            `[SESSION] Restauration authentification Manager (auth=true)`,
          )
          socketClient.emit(EVENTS.MANAGER.AUTH, pwd)
        }

        if (managerGameId) {
          debugLog(`[SESSION] Restauration session Manager: ${managerGameId}`)
          showOverlayAfterGrace()
          armReconnectTimeout()
          emitResync(socketClient, "manager", managerGameId)
        } else {
          finishReconnecting()
        }
      }
    })

    socketClient.on("disconnect", (reason) => {
      debugLog(`[SOCKET] Déconnecté (POLLING) raison=${reason}`)
      setIsConnected(false)

      // Déconnexion involontaire → reconnexion silencieuse d'abord : l'overlay
      // n'apparaît que si le blip dépasse la fenêtre de grâce.
      if (reason !== "io client disconnect") {
        showOverlayAfterGrace()
      }
    })

    socketClient.io.on("reconnect_attempt", (attempt) => {
      debugLog(`[SOCKET] Tentative de reconnexion #${attempt}`)
    })

    socketClient.io.on("reconnect_error", (err) => {
      console.error(`[SOCKET] Erreur de reconnexion: ${err.message}`)
    })

    socketClient.io.on("reconnect_failed", () => {
      console.error("[SOCKET] Échec définitif de la reconnexion")
    })

    socketClient.on("connect_error", (err) => {
      console.error(`[SOCKET] Erreur connexion: ${err.message}`)
    })

    // Listeners métiers IMMÉDIATS pour éviter les race conditions
    socketClient.on(EVENTS.PLAYER.SUCCESS_RECONNECT, () => {
      debugLog("[SESSION] SUCCESS_RECONNECT reçu (global)")
      finishReconnecting()
    })
    socketClient.on(EVENTS.MANAGER.SUCCESS_RECONNECT, () => {
      debugLog("[SESSION] SUCCESS_RECONNECT reçu (global manager)")
      finishReconnecting()
    })
    socketClient.on(EVENTS.GAME.ERROR_MESSAGE, (msg) => {
      console.warn(`[SESSION] ERROR_MESSAGE reçu: ${msg}`)
      finishReconnecting()
    })
    socketClient.on(EVENTS.GAME.RESET, (msg) => {
      console.warn(`[SESSION] GAME.RESET reçu: ${msg}`)
      finishReconnecting()
    })

    return socketClient
  } catch (error) {
    console.error("Failed to initialize socket:", error)

    return null
  }
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [clientId] = useState<string>(() => getClientId())
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search)

    if (urlParams.has("pin")) {
      usePlayerStore.getState().reset()

      return false
    }

    const playerGameId = usePlayerStore.getState().gameId
    const managerGameId = useManagerStore.getState().gameId

    return Boolean(playerGameId || managerGameId)
  })

  const isReconnectingRef = useRef(isReconnecting)
  useEffect(() => {
    isReconnectingRef.current = isReconnecting
  }, [isReconnecting])

  // Création SYNCHRONE du socket via un ref lazy : il est disponible dès le 1er
  // rendu. Auparavant il était créé dans un useEffect (donc null au 1er rendu),
  // empêchant le montage du layout (fond sombre) ET du loader → écran BLANC
  // pendant toute la connexion. Le ref garantit une création unique, y compris
  // en double-invocation StrictMode.
  const socketRef = useRef<TypedSocket | null>(null)

  socketRef.current ||= createSocketClient(
    clientId,
    setIsConnected,
    setIsReconnecting,
  )

  const socket = socketRef.current

  // Déconnexion propre au démontage du provider.
  useEffect(
    () => () => {
      if (socketRef.current) {
        debugLog("[SOCKET] Nettoyage socketClient (unmount)")
        socketRef.current.disconnect()
      }
    },
    [],
  )

  // Watchdog mobile : quand l'app revient au premier plan (téléphone
  // déverrouillé, retour d'onglet) ou que le réseau revient, on ne laisse PAS
  // Socket.IO attendre son backoff (timers gelés en arrière-plan par l'OS) ni
  // son ping timeout (~35s) pour découvrir que le lien est mort. On vérifie
  // immédiatement : déconnecté → connect() direct ; « connecté » → sonde ping
  // ack 7s, sans réponse → recyclage de la connexion. C'est ce qui ramène un
  // joueur qui rallume son téléphone dans la partie en ~1s au lieu de 8–45s.
  useEffect(() => {
    if (!socket) {
      return undefined
    }

    let lastProbe = 0

    const verifyLiveness = () => {
      if (document.visibilityState === "hidden" || isReconnectingRef.current) {
        return
      }

      if (!socket.connected) {
        debugLog(
          "[WATCHDOG] Premier plan et socket déconnecté → reconnexion immédiate",
        )
        socket.connect()

        return
      }

      // Anti-rafale : online + pageshow + visibilitychange peuvent tirer en même temps.
      const now = Date.now()

      if (now - lastProbe < 3000) {
        return
      }

      lastProbe = now

      debugLog("[WATCHDOG] Envoi sonde de vivacité...")
      socket.timeout(7000).emit(EVENTS.CONNECTION.PING, (err) => {
        if (err) {
          console.warn(
            "[WATCHDOG] Sonde de vivacité sans réponse → recyclage de la connexion",
          )
          socket.disconnect()
          socket.connect()
        } else {
          debugLog("[WATCHDOG] Sonde de vivacité OK")
        }
      })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verifyLiveness()
      }
    }

    const onOffline = () => {
      // Le navigateur connaît l'état réseau avant Engine.IO. Marquer la
      // connexion comme indisponible immédiatement évite que la télécommande
      // continue d'envoyer des actions pendant une coupure Wi‑Fi/4G.
      setIsConnected(false)
    }

    window.addEventListener("online", verifyLiveness)
    window.addEventListener("offline", onOffline)
    window.addEventListener("pageshow", verifyLiveness)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.removeEventListener("online", verifyLiveness)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("pageshow", verifyLiveness)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [socket])

  // Synchronisation d'horloge NTP (SNTP) : calcule le décalage milliseconde
  // (clockOffset = serverTime - clientLocalTime) via les pings WebSocket pour
  // synchroniser parfaitement les comptes à rebours entre tous les appareils.
  const [clockOffset, setClockOffset] = useState<number>(0)
  const clockOffsetRef = useRef<number>(0)

  const syncClock = useCallback((client: TypedSocket) => {
    if (!client || !client.connected) {
      return
    }

    const sampleOffsets: { rtt: number; offset: number }[] = []
    let count = 0
    const maxSamples = 3

    const ping = () => {
      if (!client.connected || count >= maxSamples) {
        if (sampleOffsets.length > 0) {
          // On retient l'échantillon au RTT minimal (le moins bruité par la gigue réseau)
          sampleOffsets.sort((a, b) => a.rtt - b.rtt)
          const [best] = sampleOffsets

          clockOffsetRef.current = best.offset
          setClockOffset(best.offset)
          debugLog(
            `[NTP_SYNC] Offset horloge calculé: ${Math.round(best.offset)}ms (RTT: ${best.rtt}ms)`,
          )
        }

        return
      }

      const t0 = Date.now()
      count += 1
      client
        .timeout(3000)
        .emit(EVENTS.CONNECTION.SYNC_TIME, { clientTime: t0 }, (err, res) => {
          if (!err && res && typeof res.serverTime === "number") {
            const t1 = Date.now()
            const rtt = t1 - t0
            const offset = res.serverTime - (t0 + rtt / 2)
            sampleOffsets.push({ rtt, offset })
          }
          setTimeout(ping, 100)
        })
    }

    ping()
  }, [])

  useEffect(() => {
    if (!socket || !isConnected) {
      return undefined
    }

    // Sync initiale dès la connexion
    syncClock(socket)

    // Resynchronisation périodique toutes les 45s
    const interval = setInterval(() => {
      syncClock(socket)
    }, 45000)

    return () => clearInterval(interval)
  }, [socket, isConnected, syncClock])

  const getServerTime = useCallback(
    () => Date.now() + clockOffsetRef.current,
    [],
  )

  const connect = useCallback(() => {
    debugLog("[SOCKET] Action: connect")

    if (socket && !socket.connected) {
      socket.connect()
    }
  }, [socket])

  const disconnect = useCallback(() => {
    debugLog("[SOCKET] Action: disconnect")

    if (socket && socket.connected) {
      socket.disconnect()
    }
  }, [socket])

  const navigate = useNavigate()

  // « Quitter » depuis l'overlay de reconnexion : on abandonne la session
  // mémorisée (sinon chaque reconnexion la relancerait) et on revient à
  // l'accueil du rôle concerné.
  const quitSession = useCallback(() => {
    const isManager = Boolean(useManagerStore.getState().gameId)

    usePlayerStore.getState().reset()
    useManagerStore.getState().reset()
    setIsReconnecting(false)

    if (isManager) {
      void navigate({ to: "/manager/config" })
    } else {
      void navigate({ to: "/", search: { pin: undefined } })
    }
  }, [navigate])

  const reconnect = useCallback(() => {
    debugLog("[SOCKET] Action: reconnect")

    if (socket) {
      socket.disconnect()
      socket.connect()
    }
  }, [socket])

  // Valeur mémoïsée : un nouvel objet à chaque rendu re-rendait tous les
  // consommateurs du contexte, même sans changement.
  const value = useMemo(
    () => ({
      socket,
      isConnected,
      isReconnecting,
      clientId,
      clockOffset,
      getServerTime,
      connect,
      disconnect,
      reconnect,
    }),
    [
      socket,
      isConnected,
      isReconnecting,
      clientId,
      clockOffset,
      getServerTime,
      connect,
      disconnect,
      reconnect,
    ],
  )

  return (
    <SocketContext.Provider value={value}>
      {isReconnecting && (
        <ReconnectingOverlay
          key="global-reconnect-overlay"
          onQuit={quitSession}
        />
      )}
      <div
        style={{ display: isReconnecting ? "none" : "block", height: "100%" }}
        id="app-content-root"
      >
        {socket ? children : null}
      </div>
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)

export const useEvent = <E extends keyof ServerToClientEvents>(
  event: E,
  callback: ServerToClientEvents[E],
) => {
  const { socket } = useSocket()
  const callbackRef = useRef<ServerToClientEvents[E]>(callback)

  useLayoutEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    if (!socket) {
      return () => {}
    }

    const stableHandler = (...args: Parameters<ServerToClientEvents[E]>) => {
      ;(callbackRef.current as (..._a: unknown[]) => void)(...args)
    }

    socket.on(event, stableHandler as any)

    return () => {
      socket?.off?.(event, stableHandler as any)
    }
  }, [socket, event])
}
