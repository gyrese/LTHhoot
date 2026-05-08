import { forwardRef } from "react"
import { parseAudio } from "@rahoot/web/features/game/utils/audio"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"

type Props = {
  audio: string
}

const AudioEmbed = forwardRef<HTMLAudioElement, Props>(({ audio }, ref) => {
  const { isHost } = useGameConfig()
  const src = parseAudio(audio)

  if (!isHost) {
    return null
  }

  if (src.type === "file") {
    return <audio ref={ref} src={src.url} autoPlay loop hidden />
  }

  // YouTube audio : iframe minuscule hors-écran
  const params = new URLSearchParams({
    autoplay: "1",
    loop: "1",
    controls: "0",
    mute: "0",
    playlist: src.videoId,
    rel: "0",
    playsinline: "1",
    origin: typeof window !== "undefined" ? window.location.origin : "",
  })

  if (src.start > 0) {
    params.set("start", String(src.start))
  }

  if (src.end > 0) {
    params.set("end", String(src.end))
  }

  return (
    <iframe
      src={`https://www.youtube.com/embed/${src.videoId}?${params.toString()}`}
      allow="autoplay; encrypted-media"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  )
})

AudioEmbed.displayName = "AudioEmbed"

export default AudioEmbed
