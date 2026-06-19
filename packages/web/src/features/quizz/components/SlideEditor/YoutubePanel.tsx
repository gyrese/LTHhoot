import type { YoutubeElement } from "@rahoot/common/types/game"
import { X } from "lucide-react"
import clsx from "clsx"
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
      id: `el_${uuidv4()}`,
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
    <label className="text-ink flex items-center justify-between gap-2 text-xs">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={clsx(
          "focus-ring h-5 w-9 rounded-full transition-colors duration-150",
          value ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          className={clsx(
            "mx-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150",
            value ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </label>
  )

  return (
    <div className="border-border bg-elevated w-72 rounded-xl border p-4 shadow-xl shadow-black/10">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-ink text-sm font-semibold">YouTube</span>
        <button
          onClick={onClose}
          className="focus-ring hover:bg-panel rounded-lg p-1 transition-colors"
        >
          <X className="text-ink-subtle size-4" />
        </button>
      </div>

      <input
        autoFocus
        type="text"
        placeholder="URL ou ID de la vidéo"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="border-border text-ink focus:border-primary mb-3 w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30"
      />

      {videoId && (
        <img
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt="thumbnail"
          className="mb-3 w-full rounded-lg object-cover"
        />
      )}

      <div className="mb-3 flex flex-col gap-2">
        <Toggle label="Lecture auto" value={autoplay} onChange={setAutoplay} />
        <Toggle label="Muet" value={mute} onChange={setMute} />
        <Toggle label="Boucle" value={loop} onChange={setLoop} />
        <Toggle label="Contrôles" value={controls} onChange={setControls} />
      </div>

      <div className="mb-4 flex gap-2">
        <label className="text-ink-muted flex-1 text-xs">
          Début (s)
          <input
            type="number"
            min={0}
            value={startTime}
            onChange={(e) => setStartTime(Number(e.target.value))}
            className="border-border text-ink focus:border-primary mt-1 w-full rounded-lg border px-2 py-1 text-xs outline-none"
          />
        </label>
        <label className="text-ink-muted flex-1 text-xs">
          Fin (s, 0 = fin)
          <input
            type="number"
            min={0}
            value={endTime}
            onChange={(e) => setEndTime(Number(e.target.value))}
            className="border-border text-ink focus:border-primary mt-1 w-full rounded-lg border px-2 py-1 text-xs outline-none"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={!videoId}
        onClick={handleAdd}
        className="bg-primary text-secondary w-full rounded-lg py-2 text-sm font-semibold transition-transform duration-150 hover:brightness-[0.97] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Insérer la vidéo
      </button>
    </div>
  )
}

export default YoutubePanel
