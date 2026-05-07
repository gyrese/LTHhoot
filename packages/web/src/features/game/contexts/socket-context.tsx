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

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<TypedSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(() => {
    const playerGameId = usePlayerStore.getState().gameId
    const managerGameId = useManagerStore.getState().gameId

    return !!(playerGameId || managerGameId)
  })
  const [clientId] = useState<string>(() => getClientId())

  const playerStore = usePlayerStore()
  const managerStore = useManagerStore()

  useEffect(() => {
    if (socket) {
      return
    }

    let socketClient: TypedSocket | null = null

    try {
      socketClient = io("/", {
        path: "/ws",
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000, // Un peu plus lent pour le polling
        randomizationFactor: 0.5,
        timeout: 20000,
        transports: ["polling"],
        upgrade: false,
        rememberUpgrade: false,
        auth: {
          clientId,
        },
      })

      setSocket(socketClient)

      socketClient.on("connect", () => {
        const transport = socketClient?.io?.engine?.transport?.name
        console.log(
          `[SOCKET] Connecté (POLLING) socket=${socketClient?.id} transport=${transport}`,
        )
        setIsConnected(true)

        // Tenter une reconnexion métier si on a une session
        const playerGameId = usePlayerStore.getState().gameId
        const managerGameId = useManagerStore.getState().gameId

        if (playerGameId) {
          console.log(`[SESSION] Restauration session Joueur: ${playerGameId}`)
          setIsReconnecting(true)
          socketClient?.emit(EVENTS.PLAYER.RECONNECT, { gameId: playerGameId })
        } else if (managerGameId) {
          const pwd = sessionStorage.getItem("rc_pwd")
          console.log(`[SESSION] Restauration session Manager: ${managerGameId} (auth=${!!pwd})`)
          setIsReconnecting(true)
          if (pwd) {
            socketClient?.emit(EVENTS.MANAGER.AUTH, pwd)
          }
          socketClient?.emit(EVENTS.MANAGER.RECONNECT, { gameId: managerGameId })
        }
      })

      socketClient.on("disconnect", (reason) => {
        console.log(
          `[SOCKET] Déconnecté (POLLING) raison=${reason}`,
        )
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
    } catch (error) {
      console.error("Failed to initialize socket:", error)
    }

    // eslint-disable-next-line consistent-return
    return () => {
      if (socketClient) {
        console.log("[SOCKET] Nettoyage socketClient (unmount)")
        socketClient.disconnect()
      }
    }
  }, [clientId, socket])

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

  // Listeners globaux pour l'état isReconnecting
  useEffect(() => {
    if (!socket) return

    const handleSuccess = () => {
      console.log("[SESSION] Reconnexion métier réussie")
      setIsReconnecting(false)
    }

    const handleError = (msg: string) => {
      console.warn(`[SESSION] Échec reconnexion métier: ${msg}`)
      setIsReconnecting(false)
      // Si échec réel, on pourrait reset les stores ici, 
      // mais on laisse les composants décider pour l'instant
    }

    socket.on(EVENTS.PLAYER.SUCCESS_RECONNECT, handleSuccess)
    socket.on(EVENTS.MANAGER.SUCCESS_RECONNECT, handleSuccess)
    socket.on(EVENTS.GAME.ERROR_MESSAGE, handleError)
    socket.on(EVENTS.MANAGER.ERROR_MESSAGE, handleError)

    return () => {
      socket.off(EVENTS.PLAYER.SUCCESS_RECONNECT, handleSuccess)
      socket.off(EVENTS.MANAGER.SUCCESS_RECONNECT, handleSuccess)
      socket.off(EVENTS.GAME.ERROR_MESSAGE, handleError)
      socket.off(EVENTS.MANAGER.ERROR_MESSAGE, handleError)
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
      {isReconnecting && <ReconnectingOverlay />}
      {socket ? children : null}
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
