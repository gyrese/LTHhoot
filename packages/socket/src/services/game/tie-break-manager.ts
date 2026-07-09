import type { Player } from "@rahoot/common/types/game"
import type {
  Socket,
  TieBreakAckStatus,
} from "@rahoot/common/types/game/socket"
import {
  STATUS,
  type Status,
  type StatusDataMap,
} from "@rahoot/common/types/game/status"
import { CooldownTimer } from "@rahoot/socket/services/game/cooldown-timer"
import { PlayerManager } from "@rahoot/socket/services/game/player-manager"

// Banque de questions vrai/faux pour le duel de départage — contenu simple
// embarqué en dur (pas d'appel IA, doit rester synchrone et fiable).
const TIE_BREAK_QUESTIONS: { statement: string; answer: 0 | 1 }[] = [
  { statement: "La Terre est plus grande que la Lune.", answer: 1 },
  { statement: "L'eau bout à 100°C au niveau de la mer.", answer: 1 },
  { statement: "Un triangle a 4 côtés.", answer: 0 },
  { statement: "Paris est la capitale de l'Espagne.", answer: 0 },
  { statement: "Le Soleil est une étoile.", answer: 1 },
  { statement: "Les poissons peuvent respirer hors de l'eau.", answer: 0 },
  { statement: "Il y a 12 mois dans une année.", answer: 1 },
  { statement: "Un octogone a 8 côtés.", answer: 1 },
  { statement: "Le requin est un mammifère.", answer: 0 },
  { statement: "La lumière va plus vite que le son.", answer: 1 },
]

const TIE_BREAK_DURATION_SECONDS = 10

type SendFn = <T extends Status>(
  _target: string,
  _status: T,
  _data: StatusDataMap[T],
) => void
type BroadcastFn = <T extends Status>(
  _status: T,
  _data: StatusDataMap[T],
) => void

export interface TieBreakManagerOptions {
  players: PlayerManager
  cooldown: CooldownTimer
  send: SendFn
  broadcast: BroadcastFn
  getManagerId: () => string
}

/**
 * Duel de départage : sous-flux AUTONOME déclenché sur égalité dans le top 3
 * du classement final. N'interagit jamais avec le pipeline de manche normal
 * (newQuestion/selectAnswer) — état et réponses entièrement séparés.
 */
export class TieBreakManager {
  private readonly opts: TieBreakManagerOptions
  private active = false
  // Duellistes et réponses indexés par clientId (STABLE) et non par id socket :
  // une reconnexion pendant les 10s du duel mute `player.id` (updateSocketId),
  // ce qui rendait le duelliste muet et corrompait le réordonnancement final.
  private playerClientIds: string[] = []
  private question: { statement: string; answer: 0 | 1 } | null = null
  private answers: Map<string, { answerId: number; at: number }> = new Map()

  constructor(opts: TieBreakManagerOptions) {
    this.opts = opts
  }

  // Diffuse et exécute un duel complet ; retourne le clientId du vainqueur, ou
  // `null` si personne n'a trouvé la bonne réponse à temps (ou si moins de 2
  // joueurs ex-æquo sont encore connectés).
  async run(tiedClientIds: string[]): Promise<string | null> {
    const duelPlayers = tiedClientIds
      .map((clientId) => this.opts.players.findByClientId(clientId))
      .filter((p): p is Player => Boolean(p))

    if (duelPlayers.length < 2) {
      return null
    }

    this.active = true
    this.playerClientIds = duelPlayers.map((p) => p.clientId)
    this.answers = new Map()
    this.question =
      TIE_BREAK_QUESTIONS[
        Math.floor(Math.random() * TIE_BREAK_QUESTIONS.length)
      ]!

    const duelNames = duelPlayers.map((p) => p.username)
    const spectators = this.opts.players
      .getAll()
      .filter((p) => !this.playerClientIds.includes(p.clientId))

    for (const p of duelPlayers) {
      this.opts.send(p.id, STATUS.SHOW_TIE_BREAK, {
        statement: this.question.statement,
        opponents: duelNames.filter((name) => name !== p.username),
      })
    }

    for (const p of spectators) {
      this.opts.send(p.id, STATUS.SHOW_TIE_BREAK_SPECTATE, {
        duelPlayerNames: duelNames,
      })
    }

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_TIE_BREAK_SPECTATE, {
      duelPlayerNames: duelNames,
    })

    // Résolu soit par expiration du temps, soit par abort() immédiat déclenché
    // dans submitAnswer() dès la première bonne réponse (même mécanisme que
    // la mort subite, cf. RoundManager.selectAnswer()).
    await this.opts.cooldown.start(TIE_BREAK_DURATION_SECONDS)

    this.active = false

    const winnerClientId = this.resolveWinner()

    this.playerClientIds = []
    this.answers = new Map()
    this.question = null

    const winnerName = winnerClientId
      ? (this.opts.players.findByClientId(winnerClientId)?.username ?? null)
      : null

    this.opts.broadcast(STATUS.SHOW_TIE_BREAK_RESULT, { winnerName })

    return winnerClientId
  }

  private resolveWinner(): string | null {
    if (!this.question) {
      return null
    }

    let winnerClientId: string | null = null
    let winnerAt = Number.POSITIVE_INFINITY

    for (const [clientId, answer] of this.answers) {
      if (answer.answerId === this.question.answer && answer.at < winnerAt) {
        winnerClientId = clientId
        winnerAt = answer.at
      }
    }

    return winnerClientId
  }

  // Réponse d'un des duellistes — le statut retourné alimente l'ack client
  // (le duelliste ne verrouille sa saisie que sur confirmation).
  submitAnswer(socket: Socket, answerId: number): TieBreakAckStatus {
    if (!this.active || !this.question) {
      return "closed"
    }

    const player = this.opts.players.findById(socket.id)

    if (!player || !this.playerClientIds.includes(player.clientId)) {
      return "no_player"
    }

    if (this.answers.has(player.clientId)) {
      return "duplicate"
    }

    this.answers.set(player.clientId, { answerId, at: Date.now() })

    if (answerId === this.question.answer) {
      this.opts.cooldown.abort()
    }

    return "ok"
  }
}
