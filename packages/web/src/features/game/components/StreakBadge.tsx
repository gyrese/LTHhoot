import Fire from "@rahoot/web/features/game/components/icons/Fire"
import { AnimatePresence, motion } from "motion/react"

const StreakBadge = ({
  streak,
  className,
}: {
  streak: number
  className?: string
}) => (
  <AnimatePresence>
    {streak >= 2 && (
      <motion.div
        key="streak"
        initial={{ opacity: 0, scale: 0.5, x: -10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.5, x: -10 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={
          className ??
          "ml-2 flex items-center gap-1 rounded-full bg-amber-700 p-1"
        }
      >
        <Fire className="size-7" />
      </motion.div>
    )}
  </AnimatePresence>
)

export default StreakBadge
