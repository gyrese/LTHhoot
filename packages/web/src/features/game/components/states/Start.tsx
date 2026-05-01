import { EVENTS } from "@rahoot/common/constants"
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import { useEvent } from "@rahoot/web/features/game/contexts/socket-context"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import { useState } from "react"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["SHOW_START"]
}

const Start = ({ data: { time, subject } }: Props) => {
  const [showTitle, setShowTitle] = useState(true)
  const [cooldown, setCooldown] = useState(time)

  const [sfxBoump] = useSound(SFX.BOUMP_SOUND, { volume: 0.2 })

  useEvent(EVENTS.GAME.START_COOLDOWN, () => {
    sfxBoump()
    setShowTitle(false)
  })

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    sfxBoump()
    setCooldown(sec)
  })

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-8 px-4">
      {showTitle ? (
        <div className="flex flex-col items-center gap-6 text-center">
          <span
            className="anim-badge rounded-full border border-primary/50 bg-primary/20 px-8 py-2 text-sm font-bold uppercase tracking-[0.25em] text-primary backdrop-blur-sm"
          >
            Quiz
          </span>
          <h1
            className="anim-title-big font-black leading-none tracking-tight text-white"
            style={{
              fontSize: "clamp(3.5rem, 11vw, 10rem)",
              textShadow:
                "0 0 80px rgba(255,153,0,0.45), 0 0 20px rgba(255,153,0,0.2), 0 6px 32px rgba(0,0,0,0.9)",
            }}
          >
            {subject}
          </h1>
        </div>
      ) : (
        <div className="relative flex items-center justify-center">
          <div
            className={clsx(
              "anim-show bg-primary aspect-square h-32 transition-all md:h-60",
            )}
            style={{
              transform: `rotate(${45 * (time - cooldown)}deg)`,
            }}
          />
          <span className="absolute text-6xl font-black text-white drop-shadow-md md:text-8xl">
            {cooldown}
          </span>
        </div>
      )}
    </section>
  )
}

export default Start
