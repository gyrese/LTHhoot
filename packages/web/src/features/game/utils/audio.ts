export type AudioSource =
  | { type: "file"; url: string }
  | { type: "youtube"; videoId: string; start: number; end: number }

export function parseAudio(audio: string): AudioSource {
  if (audio.startsWith("yt:")) {
    const parts = audio.slice(3).split(":")

    return {
      type: "youtube",
      videoId: parts[0] ?? "",
      start: parseInt(parts[1] ?? "0", 10) || 0,
      end: parseInt(parts[2] ?? "0", 10) || 0,
    }
  }

  return { type: "file", url: audio }
}

export function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/u)

  return match?.[1] ?? null
}

export function mmssToSeconds(value: string): number {
  const parts = value.split(":")

  if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0)
  }

  return parseInt(value, 10) || 0
}

export function secondsToMmss(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
