import { create } from "zustand"

// Préférence « son coupé » de l'écran principal. Persistée à la main (et non
// via le middleware persist) pour encadrer chaque accès au localStorage d'un
// try/catch : navigation privée ou stockage bloqué ne doivent jamais casser le jeu.
const STORAGE_KEY = "host_sound_muted"

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

const writeMuted = (muted: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0")
  } catch {
    // Stockage indisponible : la préférence reste valable pour la session
  }
}

type SoundStore = {
  muted: boolean
  toggleMuted: () => void
}

export const useSoundStore = create<SoundStore>()((set) => ({
  muted: readMuted(),
  toggleMuted: () =>
    set((state) => {
      const muted = !state.muted
      writeMuted(muted)

      return { muted }
    }),
}))
