import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

type Props = {
  images: string[]
  imageInterval: number
}

/**
 * Affiche une sequence d'images en plein ecran, une apres l'autre,
 * a intervalle configurable. La derniere image reste affichee.
 */
const ImageSequenceReveal = ({ images, imageInterval }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation()

  useEffect(() => {
    if (images.length <= 1) {
      return undefined
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= images.length - 1) {
          clearInterval(timer)

          return prev
        }

        return prev + 1
      })
    }, imageInterval * 1000)

    return () => clearInterval(timer)
  }, [images, imageInterval])

  if (!images.length) {
    return null
  }

  return (
    <div className="absolute inset-0 z-10">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          className="absolute inset-0 h-full w-full object-contain"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        />
      </AnimatePresence>

      {/* Indicateur image k / n */}
      <div className="absolute right-4 bottom-4 z-20 rounded-xl bg-black/50 px-3 py-1.5 backdrop-blur-md">
        <span className="text-sm font-bold text-white/80 tabular-nums">
          {t("game:imageSequence.indicator", {
            current: currentIndex + 1,
            total: images.length,
            defaultValue: `Image ${currentIndex + 1} / ${images.length}`,
          })}
        </span>
      </div>
    </div>
  )
}

export default ImageSequenceReveal
