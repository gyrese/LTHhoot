import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import dateImg from "@rahoot/web/assets/game/types/date.png"
import dropPinImg from "@rahoot/web/assets/game/types/drop_pin.png"
import mcqImg from "@rahoot/web/assets/game/types/mcq.png"
import openImg from "@rahoot/web/assets/game/types/open.png"
import puzzleImg from "@rahoot/web/assets/game/types/puzzle.png"
import sliderImg from "@rahoot/web/assets/game/types/slider.png"
import trueFalseImg from "@rahoot/web/assets/game/types/true_false.png"
import { motion, AnimatePresence } from "motion/react"
import { useTranslation } from "react-i18next"

type Props = {
  data: CommonStatusDataMap["SHOW_PREPARED"]
}

const TYPE_ASSETS: Record<string, string> = {
  open: openImg,
  date: dateImg,
  slider: sliderImg,
  mcq: mcqImg,
  true_false: trueFalseImg,
  puzzle: puzzleImg,
  drop_pin: dropPinImg,
}

const Prepared = ({ data: { questionNumber, type } }: Props) => {
  const { t } = useTranslation()
  const image = TYPE_ASSETS[type]

  return (
    <section className="relative mx-auto flex h-full w-full flex-col items-center justify-center px-4">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px] pointer-events-none" />

      <AnimatePresence mode="wait">
        <motion.div
          key={questionNumber}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex flex-col items-center gap-8"
        >
          {/* Header */}
          <div className="flex flex-col items-center gap-2">
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg font-black uppercase tracking-[0.3em] text-white/50"
            >
              Préparez-vous
            </motion.span>
            <h2 className="text-6xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] md:text-8xl">
              {t("game:questionPrefix")}
              {questionNumber}
            </h2>
          </div>

          {/* Main Icon Container */}
          <div className="relative mt-8">
            {/* Pulsing rings */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full border-4 border-white/10"
            />
            
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}
              className="relative flex h-64 w-64 items-center justify-center overflow-hidden rounded-[4rem] bg-gradient-to-br from-white/10 to-white/5 shadow-2xl backdrop-blur-xl border border-white/20 md:h-80 md:w-80"
            >
              {image ? (
                <motion.img
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
                  src={image}
                  alt={type}
                  className="h-full w-full object-cover [mix-blend-mode:multiply] opacity-90"
                />
              ) : (
                <div className="text-8xl text-white/20 font-black">?</div>
              )}
              
              {/* Inner Gloss */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
            </motion.div>
          </div>

          {/* Bottom Label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4 rounded-full bg-white/10 px-6 py-2 border border-white/10 backdrop-blur-sm"
          >
            <span className="text-sm font-bold text-white/80 uppercase tracking-widest">
              {t(`quizz:questionType.${type}`)}
            </span>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

export default Prepared
