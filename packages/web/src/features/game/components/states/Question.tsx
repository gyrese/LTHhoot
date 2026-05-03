import { useEffect, type CSSProperties } from "react"
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import { type SlideElement } from "@rahoot/common/types/game"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import SlideCanvas from "@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["SHOW_QUESTION"]
}

const DEFAULT_BG: CSSProperties = {
  backgroundImage: "url(/bg-salon.png)",
  backgroundSize: "cover",
  backgroundPosition: "center",
}

const noopChange = (_els: SlideElement[]) => undefined
const noopSelect = (_id: string | undefined) => undefined

const Question = ({ data: { question, type, media, background, backgroundOpacity, elements, audio, cooldown, pinImage } }: Props) => {
  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })

  useEffect(() => {
    sfxShow()
  }, [sfxShow])

  let bgStyle: CSSProperties = DEFAULT_BG

  if (background?.type === "image") {
    bgStyle = { backgroundImage: `url(${background.value})`, backgroundSize: "cover", backgroundPosition: "center" }
  } else if (background?.type === "color") {
    bgStyle = { backgroundColor: background.value }
  }

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden">
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0"
        style={{ ...bgStyle, opacity: backgroundOpacity ?? 0.5 }}
      />

      {elements && elements.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          <SlideCanvas elements={elements} onChange={noopChange} selectedId={undefined} onSelect={noopSelect} readOnly />
        </div>
      )}

      {audio && <audio src={audio} autoPlay loop hidden />}

      {type !== "title" && (
        <div className="relative z-10 px-4 pt-4">
          <div className="mx-auto max-w-7xl rounded-2xl bg-black/50 px-6 py-4 backdrop-blur-md">
            <h2 className="anim-show text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl">
              {question}
            </h2>
          </div>
        </div>
      )}

      <section className="relative mx-auto flex h-full w-full max-w-7xl flex-1 flex-col items-center px-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          <QuestionMedia media={type === "drop_pin" && pinImage ? { type: "image", url: pinImage } : media} alt={question} />
        </div>
        {type !== "title" && (
          <div
            className="bg-primary mb-20 h-4 self-start rounded-full"
            style={{ animation: `progressBar ${cooldown}s linear forwards` }}
          />
        )}
      </section>
    </div>
  )
}

export default Question
