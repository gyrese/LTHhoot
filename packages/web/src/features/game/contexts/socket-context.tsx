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

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface SocketContextValue {
  socket: TypedSocket | null
  isConnected: boolean
  clientId: string
  connect: () => void
  disconnect: () => void
  reconnect: () => void
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
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
  const [clientId] = useState<string>(() => getClientId())

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
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 20000,
        transports: ["polling", "websocket"],
        upgrade: true,
        rememberUpgrade: true,
        auth: {
          clientId,
        },
      })

      setSocket(socketClient)

      // Détecter les upgrades de transport (uniquement quand l'engine est prêt)
      socketClient.io.on("open", () => {
        console.log("[SOCKET] Manager open (transport ready)")
        socketClient?.io?.engine?.on?.("upgrade", (transport: any) => {
          console.log(`[SOCKET] Transport upgraded to ${transport.name}`)
        })
      })

      socketClient.on("connect", () => {
        const transport = socketClient?.io?.engine?.transport?.name
        console.log(
          `[SOCKET] Connecté socket=${socketClient?.id} clientId=${clientId.substring(0, 8)} transport=${transport}`,
        )
        setIsConnected(true)
      })

      socketClient.on("disconnect", (reason) => {
        console.log(
          `[SOCKET] Déconnecté socket=${socketClient?.id} raison=${reason}`,
        )
        setIsConnected(false)
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

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        clientId,
        connect,
        disconnect,
        reconnect,
      }}
    >
      {/* On ne rend les enfants que lorsque le socket est instancié pour éviter useEvent(null) */}
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
