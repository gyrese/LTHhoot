import { useEffect, type CSSProperties } from "react"
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import { type SlideElement } from "@rahoot/common/types/game"
import QuestionMedia from "@rahoot/web/components/QuestionMedia"
import BackgroundRevealer from "@rahoot/web/features/game/components/BackgroundRevealer"
import { SFX } from "@rahoot/web/features/game/utils/constants"
import SlideCanvas from "@rahoot/web/features/quizz/components/SlideEditor/SlideCanvas"
import { useGameConfig } from "@rahoot/web/features/game/components/GameWrapper"
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

const Question = ({
  data: {
    question,
    type,
    media,
    background,
    backgroundOpacity,
    elements,
    cooldown,
    pinImage,
    revelationEnabled,
    revealDuration,
    gridCols,
    gridRows,
    revelationStyle,
  },
}: Props) => {
  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })

  const { isHost } = useGameConfig()

  useEffect(() => {
    if (isHost) {
      sfxShow()
    }
  }, [sfxShow, isHost])

  // Les slides ("title") n'ont qu'une seule phase d'affichage : la révélation
  // doit donc s'y jouer directement. Pour les autres types, cette phase n'est
  // qu'une vue d'attente avant la sélection de réponse : tant que la
  // révélation est activée, on NE montre PAS le fond personnalisé ici (sinon
  // le joueur voit l'image en entier avant même que la révélation ne
  // commence, ce qui la rend inutile) — seul le fond classique LTNhoot
  // s'affiche, la vraie image n'apparaît qu'en se révélant dans Answers.tsx.
  const revealHere = revelationEnabled && type === "title"

  let bgStyle: CSSProperties = DEFAULT_BG

  if (type === "title" || !revelationEnabled) {
    if (background?.type === "image") {
      bgStyle = {
        backgroundImage: `url(${background.value})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    } else if (background?.type === "color") {
      bgStyle = { backgroundColor: background.value }
    }
  }

  const opacity = backgroundOpacity ?? (revealHere ? 1 : 0.5)

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden">
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0" style={{ ...bgStyle, opacity }} />

      {revealHere && (
        <BackgroundRevealer
          duration={revealDuration ?? cooldown}
          gridCols={gridCols ?? 8}
          gridRows={gridRows ?? 6}
          seedString={question || background?.value}
          startTimeOffset={0}
          configuredStyle={revelationStyle}
          imageUrl={background?.type === "image" ? background.value : undefined}
        />
      )}

      {type === "title" && elements && elements.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <SlideCanvas
            elements={elements}
            onChange={noopChange}
            selectedId={undefined}
            onSelect={noopSelect}
            readOnly
            noBackground
            hideYoutube
          />
        </div>
      )}

      {type !== "title" && (
        <div id="question-container" className="relative z-10 px-4 pt-4">
          <div className="mx-auto max-w-7xl rounded-2xl bg-black/50 px-6 py-4 backdrop-blur-md">
            <h2 className="anim-show text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl">
              {question}
            </h2>
          </div>
        </div>
      )}

      <section className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-1 flex-col items-center px-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          {(!elements || elements.length === 0) && (
            <QuestionMedia
              media={
                // On cache la vidéo en phase question
                media?.type === "video" || (type === "drop_pin" && pinImage)
                  ? undefined
                  : media
              }
              alt={question}
            />
          )}
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
