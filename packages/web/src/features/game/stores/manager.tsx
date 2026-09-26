import type { PublicPlayer } from "@rahoot/common/types/game"
import type { StatusDataMap } from "@rahoot/common/types/game/status"
import type { ManagerConfig } from "@rahoot/common/types/manager"
import {
  createStatus,
  type Status,
} from "@rahoot/web/features/game/utils/createStatus"
import { persist } from "zustand/middleware"
import { create } from "zustand"

// Progression de la soirée affichée sur l'écran principal (« Quiz 1/3 »).
// `current` est le rang (1-based) du quiz en cours. Le serveur ne la renvoie
// pas dans les statuts : elle est posée au lancement puis avancée à chaque
// EVENING.QUIZ_COMPLETE.
export type EveningProgress = { current: number; total: number }

type ManagerStore<T> = {
  config: ManagerConfig | null

  gameId: string | null
  inviteCode: string | null
  salonImage: string | undefined
  status: Status<T> | null
  players: PublicPlayer[]
  eveningProgress: EveningProgress | null

  setConfig: (_config: ManagerConfig) => void
  setGameId: (_gameId: string | null) => void
  setInviteCode: (_inviteCode: string | null) => void
  setSalonImage: (_salonImage: string | undefined) => void
  setStatus: <K extends keyof T>(_name: K, _data: T[K]) => void
  resetStatus: () => void
  setPlayers: (_players: PublicPlayer[]) => void
  setEveningProgress: (_progress: EveningProgress | null) => void
  hydrate: (_data: {
    gameId: string
    inviteCode?: string
    status: { name: keyof T; data: T[keyof T] }
    players: PublicPlayer[]
  }) => void
  reset: (_clearConfig?: boolean) => void
}

const initialState = {
  config: null,
  gameId: null,
  inviteCode: null,
  salonImage: undefined,
  status: null,
  players: [],
  eveningProgress: null,
}

export const useManagerStore = create<ManagerStore<StatusDataMap>>()(
  persist(
    (set) => ({
      ...initialState,

      setConfig: (config) => set({ config }),

      setGameId: (gameId) => set({ gameId }),
      setInviteCode: (inviteCode) => set({ inviteCode }),
      setSalonImage: (salonImage) => set({ salonImage }),

      setStatus: (name, data) => set({ status: createStatus(name, data) }),
      resetStatus: () => set({ status: null }),

      setPlayers: (players) => set({ players }),
      setEveningProgress: (eveningProgress) => set({ eveningProgress }),
      hydrate: (data) => {
        set({
          gameId: data.gameId,
          inviteCode: data.inviteCode || null,
          status: createStatus(data.status.name, data.status.data),
          players: data.players,
        })
      },

      reset: (clearConfig = false) => {
        const { stack } = new Error()
        console.warn(`[STORE] Manager reset called! Stack:`, stack)
        set((state) => ({
          gameId: null,
          inviteCode: null,
          salonImage: undefined,
          status: null,
          players: [],
          config: clearConfig ? null : state.config,
        }))
      },
    }),
    {
      name: "rahoot-manager-storage",
      partialize: (state) => ({
        gameId: state.gameId,
        inviteCode: state.inviteCode,
        // Survit au rechargement de l'écran principal : le serveur ne renvoie
        // que `isEveningMode` à la reconnexion, pas l'index du quiz.
        eveningProgress: state.eveningProgress,
      }),
    },
  ),
)
