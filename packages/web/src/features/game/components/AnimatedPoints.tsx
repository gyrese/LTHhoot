import { useSpring, useTransform } from "motion/react"
import { useEffect, useState } from "react"

type Props = {
  from: number
  to: number
  className?: string
  delay?: number
}

const AnimatedPoints = ({
  from,
  to,
  className,
  delay = 0,
}: {
  from?: number
  to: number
  className?: string
  delay?: number
}) => {
  const spring = useSpring(from ?? to, { stiffness: 100, damping: 30 })
  const display = useTransform(spring, (value) => Math.round(value))
  const [displayValue, setDisplayValue] = useState(from ?? to)

  useEffect(() => {
    const timer = setTimeout(() => {
      spring.set(to)
    }, delay * 1000)

    const unsubscribe = display.on("change", (latest) => {
      setDisplayValue(latest)
    })

    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [to, spring, display, delay])

  return <span className={className}>{displayValue.toLocaleString()}</span>
}

export default AnimatedPoints
