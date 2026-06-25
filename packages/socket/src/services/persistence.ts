import type { Player, Quizz, QuestionResult } from "@rahoot/common/types/game"
import { logHandlerError } from "@rahoot/socket/utils/safe-handler"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "fs"
import { resolve } from "path"

// Persistance d'état pour une instance UNIQUE (cible ≤ 50 joueurs / 1 partie).
//
// But : qu'un crash franc ou un redéploiement ne fasse PLUS perdre la partie en
// cours. L'état des parties vit en RAM (cf. registry) ; on en écrit un instantané
// sur disque, rechargé au démarrage. Pas de Redis : inutile à cette échelle.
//
// Choix de reprise (volontairement conservateur, zéro double-scoring) :
//  - On ne persiste PAS les réponses en cours d'une question (transitoires).
//  - `resumeIndex` = nombre de questions déjà traitées (= `questionsHistory.length`).
//    C'est l'index de la prochaine question NON scorée. À la reprise, l'hôte
//    relance via le bouton « Démarrer » habituel : la partie repart à cette
//    question avec les scores cumulés intacts.
//  - Les inventaires de power-ups (indexés par socket id volatil) ne sont pas
//    restaurés.

export const SNAPSHOT_VERSION = 1

export interface PlayerSnapshot {
  clientId: string
  username: string
  avatar?: string
  points: number
  streak: number
}

export interface GameSnapshot {
  version: number
  gameId: string
  inviteCode: string
  managerClientId: string
  quizz: Quizz
  resumeIndex: number
  questionsHistory: QuestionResult[]
  players: PlayerSnapshot[]
  eveningSession: {
    quizIds: string[]
    currentIndex: number
    powerUpsEnabled: boolean
  } | null
  singleQuizPowerUpsEnabled: boolean
  savedAt: number
}

export const playerToSnapshot = (p: Player): PlayerSnapshot => ({
  clientId: p.clientId,
  username: p.username,
  avatar: p.avatar,
  points: p.points,
  streak: p.streak,
})

// Reconstruit un Player en mémoire à partir d'un snapshot. `id` est initialisé à
// `clientId` (placeholder) ; il sera remplacé par le vrai socket id lors de la
// reconnexion (PlayerManager.updateSocketId, indexé par l'ancien id).
export const snapshotToPlayer = (s: PlayerSnapshot): Player => ({
  id: s.clientId,
  clientId: s.clientId,
  connected: false,
  username: s.username,
  avatar: s.avatar,
  points: s.points,
  streak: s.streak,
})

class Persistence {
  private readonly dir: string
  private readonly file: string
  private readonly tmpFile: string

  constructor() {
    const configPath = process.env.CONFIG_PATH
      ? resolve(process.env.CONFIG_PATH)
      : resolve(process.cwd(), "../../config")

    this.dir = resolve(configPath, "state")
    this.file = resolve(this.dir, "games.json")
    this.tmpFile = resolve(this.dir, "games.json.tmp")
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  // Écriture atomique : on écrit dans un fichier temporaire puis on renomme, pour
  // ne jamais laisser un games.json tronqué si le process meurt en plein write.
  write(json: string): void {
    try {
      this.ensureDir()
      writeFileSync(this.tmpFile, json, "utf-8")
      renameSync(this.tmpFile, this.file)
    } catch (err) {
      logHandlerError("persistence.write", err)
    }
  }

  read(): GameSnapshot[] {
    try {
      if (!existsSync(this.file)) {
        return []
      }

      let raw = readFileSync(this.file, "utf-8")

      // On retire un éventuel BOM (fichier édité à la main sous Windows) que
      // JSON.parse refuserait.
      if (raw.charCodeAt(0) === 0xfeff) {
        raw = raw.slice(1)
      }

      const parsed = JSON.parse(raw) as GameSnapshot[]

      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed.filter((s) => s && s.version === SNAPSHOT_VERSION)
    } catch (err) {
      logHandlerError("persistence.read", err)

      return []
    }
  }
}

export default Persistence
