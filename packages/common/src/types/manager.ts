import type { GameResultMeta, QuizzMeta } from "@rahoot/common/types/game"

// "remote" : session ouverte par le PIN de télécommande (REMOTE_PIN). Elle ne
// permet QUE de piloter une partie existante — jamais d'accéder aux quiz,
// résultats, invités ou médias (config émise vide).
export type ManagerRole = "admin" | "guest" | "remote"

export type GuestMeta = {
  id: string
  name: string
  createdAt: number
}

export type ManagerConfig = {
  quizz: QuizzMeta[]
  results: GameResultMeta[]
  // Absent = admin (clients existants) : seule la valeur "guest" restreint l'UI.
  role?: ManagerRole
  // Nom affiché du compte invité connecté (rôle guest uniquement).
  guestName?: string
  // Comptes invités pour la modal de réglages (rôle admin uniquement, sans hash).
  guests?: GuestMeta[]
}
