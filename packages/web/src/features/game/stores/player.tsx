import type { StatusDataMap } from "@rahoot/common/types/game/status"
import {
  createStatus,
  type Status,
} from "@rahoot/web/features/game/utils/createStatus"
import { persist } from "zustand/middleware"
import { create } from "zustand"

type PlayerState = {
  username?: string
  avatar?: string
  points?: number
}

type PlayerStore<T> = {
  gameId: string | null
  player: PlayerState | null
  status: Status<T> | null
  hasAnswered: boolean
  submittedAnswer: unknown

  setGameId: (_gameId: string | null) => void

  setPlayer: (_state: PlayerState) => void
  login: (_username: string, _avatar?: string) => void
  join: (_gameId: string) => void
  updatePoints: (_points: number) => void
  setAnswerSubmitted: (_submitted: boolean, _answer?: unknown) => void

  setStatus: <K extends keyof T>(_name: K, _data: T[K]) => void
  hydrate: (_data: {
    gameId: string
    player: PlayerState
    status: { name: keyof T; data: T[keyof T] }
    hasAnswered?: boolean
    submittedAnswer?: unknown
  }) => void
  reset: () => void
}

const initialState = {
  gameId: null,
  player: null,
  status: null,
  hasAnswered: false,
  submittedAnswer: null,
}

export const usePlayerStore = create<PlayerStore<StatusDataMap>>()(
  persist(
    (set) => ({
      ...initialState,

      setGameId: (gameId) => set({ gameId }),

      setPlayer: (player: PlayerState) => set({ player }),
      login: (username, avatar) =>
        set((state) => ({
          player: { ...state.player, username, avatar },
        })),

      join: (gameId) => {
        set((state) => ({
          gameId,
          player: { ...state.player, points: 0 },
        }))
      },

      updatePoints: (points) =>
        set((state) => ({
          player: { ...state.player, points },
        })),

      setAnswerSubmitted: (hasAnswered, submittedAnswer = null) =>
        set({ hasAnswered, submittedAnswer }),

      setStatus: (name, data) =>
        set({
          status: createStatus(name, data),
          hasAnswered: false,
          submittedAnswer: null,
        }),
      hydrate: (data) => {
        console.log(
          `[STORE] Player hydrate gameId=${data.gameId} hasAnswered=${data.hasAnswered}`,
        )
        set({
          gameId: data.gameId,
          player: data.player,
          status: createStatus(data.status.name, data.status.data),
          hasAnswered: Boolean(data.hasAnswered),
          submittedAnswer: data.submittedAnswer ?? null,
        })
      },

      reset: () => {
        const { stack } = new Error()
        console.warn(`[STORE] Player reset called! Stack:`, stack)
        set(initialState)
      },
    }),
    {
      name: "rahoot-player-storage",
      // Ne persister QUE l'identité de session. Persister `status` réaffichait un
      // écran de question périmé/figé au rechargement avant la resync serveur.
      partialize: (state) => ({
        gameId: state.gameId,
        player: state.player,
      }),
    },
  ),
)
