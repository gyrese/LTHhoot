export type EveningSummary = {
  id: string
  startedAt: string
  endedAt?: string
  quizCount: number
  leaderboard: {
    id: string
    username: string
    avatar?: string
    points: number
    rank: number
    quizCount: number
  }[]
}
