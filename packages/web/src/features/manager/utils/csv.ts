import type { GameResult } from "@rahoot/common/types/game"

export const downloadGameResultCSV = (result: GameResult) => {
  const headers = ["Username", "Rank", "Total Points"]

  // Add question headers
  result.questions.forEach((q, i) => {
    headers.push(`Q${i + 1}: ${q.question.replace(/"/gu, '""')}`)
  })

  const rows = result.players.map((player) => {
    const row = [
      player.username,
      player.rank.toString(),
      player.points.toString(),
    ]

    // Find player points for each question
    result.questions.forEach((q) => {
      const pAnswer = q.playerAnswers.find(
        (pa) => pa.playerName === player.username,
      )
      row.push(pAnswer ? pAnswer.points.toString() : "0")
    })

    return row.map((val) => `"${val.replace(/"/gu, '""')}"`).join(",")
  })

  const csvContent = [headers.join(","), ...rows].join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute(
    "download",
    `results_${result.subject.replace(/\s+/gu, "_")}_${new Date(result.date).getTime()}.csv`,
  )
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
