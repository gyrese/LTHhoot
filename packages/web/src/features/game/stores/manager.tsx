import type { Player } from "@rahoot/common/types/game"
import type { StatusDataMap } from "@rahoot/common/types/game/status"
import type { ManagerConfig } from "@rahoot/common/types/manager"
import {
  createStatus,
  type Status,
} from "@rahoot/web/features/game/utils/createStatus"
import { persist } from "zustand/middleware"
import { create } from "zustand"

type ManagerStore<T> = {
  config: ManagerConfig | null

  gameId: string | null
  salonImage: string | undefined
  status: Status<T> | null
  players: Player[]

  setConfig: (_config: ManagerConfig) => void
  setGameId: (_gameId: string | null) => void
  setSalonImage: (_salonImage: string | undefined) => void
  setStatus: <K extends keyof T>(_name: K, _data: T[K]) => void
  resetStatus: () => void
  setPlayers: (_players: Player[]) => void
  hydrate: (_data: {
    gameId: string
    status: { name: keyof T; data: T[keyof T] }
    players: Player[]
  }) => void
  reset: () => void
}

const initialState = {
  config: null,
  gameId: null,
  salonImage: undefined,
  status: null,
  players: [],
}

export const useManagerStore = create<ManagerStore<StatusDataMap>>()(
  persist(
    (set) => ({
      ...initialState,

      setConfig: (config) => set({ config }),

      setGameId: (gameId) => set({ gameId }),
      setSalonImage: (salonImage) => set({ salonImage }),

      setStatus: (name, data) => set({ status: createStatus(name, data) }),
      resetStatus: () => set({ status: null }),

      setPlayers: (players) => set({ players }),
      hydrate: (data) => {
        console.log(`[STORE] Manager hydrate gameId=${data.gameId}`)
        set({
          gameId: data.gameId,
          status: createStatus(data.status.name, data.status.data),
          players: data.players,
        })
      },

      reset: () => {
        const stack = new Error().stack
        console.warn(`[STORE] Manager reset called! Stack:`, stack)
        set(initialState)
      },
    }),
    {
      name: "rahoot-manager-storage",
    },
  ),
)
