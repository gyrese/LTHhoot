import { MEDIA_TYPES } from "@rahoot/common/constants"
import type { QuestionMedia as QuestionMediaType } from "@rahoot/common/types/game"

type Props = {
  media?: QuestionMediaType
  alt?: string
}

const parseYoutubeId = (url: string): string | null => {
  try {
    const u = new URL(url)
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v")
  } catch {
    if (/^[\w-]{11}$/u.test(url)) return url
  }
  return null
}

const QuestionMedia = ({ media, alt = "" }: Props) => {
  if (!media?.type) {
    return null
  }

  if (media.type === MEDIA_TYPES.IMAGE) {
    return (
      <img
        alt={alt}
        src={media.url}
        className="max-h-60 w-auto rounded-md sm:max-h-100"
      />
    )
  }

  if (media.type === MEDIA_TYPES.VIDEO) {
    const youtubeId = parseYoutubeId(media.url)
    if (youtubeId) {
      return (
        <iframe
          className="m-4 mb-2 aspect-video max-h-60 w-auto rounded-md px-4 sm:max-h-100"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )
    }
    return (
      <video
        className="m-4 mb-2 aspect-video max-h-60 w-auto rounded-md px-4 sm:max-h-100"
        src={media.url}
        autoPlay
        controls
      />
    )
  }

  if (media.type === MEDIA_TYPES.AUDIO) {
    return (
      <audio
        className="m-4 mb-2 w-auto rounded-md"
        src={media.url}
        autoPlay
        controls
      />
    )
  }

  return null
}

export default QuestionMedia
