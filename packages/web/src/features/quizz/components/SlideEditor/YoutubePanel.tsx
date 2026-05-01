import type { YoutubeElement } from "@rahoot/common/types/game"
import { X } from "lucide-react"
import { useState } from "react"
import { v4 as uuidv4 } from "uuid"

type YoutubePanelProps = {
  onAdd: (_el: YoutubeElement) => void
  onClose: () => void
}

const parseVideoId = (input: string): string | null => {
  try {
    const url = new URL(input)

    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1) || null
    }

    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v")
    }
  } catch {
    // Considéré comme un ID direct si ce n'est pas une URL
    if (/^[\w-]{11}$/u.test(input)) {
      return input
    }
  }

  return null
}

const YoutubePanel = ({ onAdd, onClose }: YoutubePanelProps) => {
  const [url, setUrl] = useState("")
  const [autoplay, setAutoplay] = useState(true)
  const [mute, setMute] = useState(true)
  const [loop, setLoop] = useState(false)
  const [controls, setControls] = useState(true)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)

  const videoId = parseVideoId(url)

  const handleAdd = () => {
    if (!videoId) {
      return
    }

    const el: YoutubeElement = {
      id: `el_${  uuidv4()}`,
      type: "youtube",
      videoId,
      autoplay,
      mute,
      loop,
      controls,
      startTime,
      endTime,
      x: 200,
      y: 150,
      width: 640,
      height: 360,
      rotation: 0,
      opacity: 1,
    }
    onAdd(el)
  }

  const Toggle = ({
    label,
    value,
    onChange,
  }: {
    label: string
    value: boolean
    onChange: (_v: boolean) => void
  }) => (
    <label className="flex items-center justify-between gap-2 text-xs text-gray-700">
      {label}
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors ${value ? "bg-red-500" : "bg-gray-300"}`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${value ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
    </label>
  )

  return (
    <div className="w-72 rounded-xl bg-white shadow-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm text-gray-800">YouTube</span>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="size-4 text-gray-500" />
        </button>
      </div>

      <input
        autoFocus
        type="text"
        placeholder="URL ou ID de la vidéo"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mb-3 outline-none focus:border-red-400"
      />

      {videoId && (
        <img
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt="thumbnail"
          className="w-full rounded mb-3 object-cover"
        />
      )}

      <div className="flex flex-col gap-2 mb-3">
        <Toggle label="Lecture auto" value={autoplay} onChange={setAutoplay} />
        <Toggle label="Muet" value={mute} onChange={setMute} />
        <Toggle label="Boucle" value={loop} onChange={setLoop} />
        <Toggle label="Contrôles" value={controls} onChange={setControls} />
      </div>

      <div className="flex gap-2 mb-4">
        <label className="flex-1 text-xs text-gray-600">
          Début (s)
          <input
            type="number"
            min={0}
            value={startTime}
            onChange={(e) => setStartTime(Number(e.target.value))}
            className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none"
          />
        </label>
        <label className="flex-1 text-xs text-gray-600">
          Fin (s, 0 = fin)
          <input
            type="number"
            min={0}
            value={endTime}
            onChange={(e) => setEndTime(Number(e.target.value))}
            className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={!videoId}
        onClick={handleAdd}
        className="w-full bg-red-500 text-white rounded py-1.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Insérer la vidéo
      </button>
    </div>
  )
}

export default YoutubePanel
