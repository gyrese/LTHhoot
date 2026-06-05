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
  useRef,
  useState,
} from "react"
import { io, Socket } from "socket.io-client"
import { v7 as uuid } from "uuid"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import ReconnectingOverlay from "@rahoot/web/features/game/components/ReconnectingOverlay"
import { EVENTS } from "@rahoot/common/constants"

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface SocketContextValue {
  socket: TypedSocket | null
  isConnected: boolean
  isReconnecting: boolean
  clientId: string
  connect: () => void
  disconnect: () => void
  reconnect: () => void
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  isReconnecting: false,
  clientId: "",
  connect: () => {},
  disconnect: () => {},
  reconnect: () => {},
})

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
  try {
    const socketClient: TypedSocket = io("/", {
      path: "/ws",
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      // Un peu plus lent pour le polling
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.5,
      timeout: 20000,
      transports: ["polling", "websocket"],
      upgrade: true,
      auth: {
        clientId,
      },
    })

    socketClient.on("connect", () => {
      const transport = socketClient.io?.engine?.transport?.name
      console.log(
        `[SOCKET] Connecté (POLLING) socket=${socketClient.id} transport=${transport}`,
      )
      setIsConnected(true)

      // Tenter une reconnexion métier si on a une session
      const playerGameId = usePlayerStore.getState().gameId
      const managerGameId = useManagerStore.getState().gameId
      const pwd = sessionStorage.getItem("rc_pwd")

      if (playerGameId) {
        console.log(`[SESSION] Restauration session Joueur: ${playerGameId}`)
        setIsReconnecting(true)
        socketClient.emit(EVENTS.PLAYER.RECONNECT, { gameId: playerGameId })
      } else {
        // Si on a un mot de passe manager en session, on s'authentifie systématiquement à la reconnexion.
        // Cela permet au manager de rester authentifié sur les écrans hors-partie (config, éditeur)
        // même après une déconnexion réseau ou un redémarrage du serveur.
        if (pwd) {
          console.log(`[SESSION] Restauration authentification Manager (auth=true)`)
          socketClient.emit(EVENTS.MANAGER.AUTH, pwd)
        }

        if (managerGameId) {
          console.log(`[SESSION] Restauration session Manager: ${managerGameId}`)
          setIsReconnecting(true)
          socketClient.emit(EVENTS.MANAGER.RECONNECT, { gameId: managerGameId })
        } else {
          setIsReconnecting(false)
        }
      }
    })

    socketClient.on("disconnect", (reason) => {
      console.log(`[SOCKET] Déconnecté (POLLING) raison=${reason}`)
      setIsConnected(false)

      // Si la déconnexion est involontaire, on passe en mode reconnect
      if (reason !== "io client disconnect") {
        setIsReconnecting(true)
      }
    })

    socketClient.io.on("reconnect_attempt", (attempt) => {
      console.log(`[SOCKET] Tentative de reconnexion #${attempt}`)
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
      console.log("[SESSION] SUCCESS_RECONNECT reçu (global)")
      setIsReconnecting(false)
    })
    socketClient.on(EVENTS.MANAGER.SUCCESS_RECONNECT, () => {
      console.log("[SESSION] SUCCESS_RECONNECT reçu (global manager)")
      setIsReconnecting(false)
    })
    socketClient.on(EVENTS.GAME.ERROR_MESSAGE, (msg) => {
      console.warn(`[SESSION] ERROR_MESSAGE reçu: ${msg}`)
      setIsReconnecting(false)
    })
    socketClient.on(EVENTS.GAME.RESET, (msg) => {
      console.warn(`[SESSION] GAME.RESET reçu: ${msg}`)
      setIsReconnecting(false)
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

  const playerStore = usePlayerStore()
  const managerStore = useManagerStore()

  useEffect(() => {
    const currentStatus = playerStore.status?.name || managerStore.status?.name || "NONE"
    console.log(`[UI_TRACE_v1k8qp] isReconnecting=${isReconnecting} isConnected=${isConnected} currentStatus=${currentStatus} overlayVisible=${isReconnecting}`)
  }, [isReconnecting, isConnected, playerStore.status?.name, managerStore.status?.name])

  // Déconnexion propre au démontage du provider.
  useEffect(
    () => () => {
      if (socketRef.current) {
        console.log("[SOCKET] Nettoyage socketClient (unmount)")
        socketRef.current.disconnect()
      }
    },
    [],
  )

  const connect = useCallback(() => {
    console.log("[SOCKET] Action: connect")

    if (socket && !socket.connected) {
      socket.connect()
    }
  }, [socket])

  const disconnect = useCallback(() => {
    console.log("[SOCKET] Action: disconnect")

    if (socket && socket.connected) {
      socket.disconnect()
    }
  }, [socket])

  const reconnect = useCallback(() => {
    console.log("[SOCKET] Action: reconnect")

    if (socket) {
      socket.disconnect()
      socket.connect()
    }
  }, [socket])

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isReconnecting,
        clientId,
        connect,
        disconnect,
        reconnect,
      }}
    >
      {isReconnecting && (
        <ReconnectingOverlay key="global-reconnect-overlay" />
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
    console.log(`[EVENT] Mount hook for event: ${event}`)

    if (!socket) {
      console.warn(`[EVENT] Skip attach ${event}: socket is null`)

      return () => {}
    }

    const stableHandler = (...args: Parameters<ServerToClientEvents[E]>) => {
      if (event.includes("SUCCESS_RECONNECT")) {
        console.log(`[RESYNC] Réussite de la resynchronisation métier: ${event}`)
      }

      ;(callbackRef.current as (..._a: unknown[]) => void)(...args)
    }

    console.log(`[EVENT] Attach listener: ${event}`)
    socket.on(event, stableHandler as any)

    return () => {
      console.log(`[EVENT] Detach listener: ${event}`)
      socket?.off?.(event, stableHandler as any)
    }
  }, [socket, event])
}
