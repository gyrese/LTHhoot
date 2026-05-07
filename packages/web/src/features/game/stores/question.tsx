import type { GameUpdateQuestion } from "@rahoot/common/types/game"
import { create } from "zustand"

type QuestionStore = {
  questionStates: GameUpdateQuestion | null
  cooldown: number | null
  setQuestionStates: (_state: GameUpdateQuestion | null) => void
  setCooldown: (_cooldown: number | null) => void
}

export const useQuestionStore = create<QuestionStore>((set) => ({
  questionStates: null,
  cooldown: null,
  setQuestionStates: (state) => set({ questionStates: state }),
  setCooldown: (cooldown) => set({ cooldown }),
}))
