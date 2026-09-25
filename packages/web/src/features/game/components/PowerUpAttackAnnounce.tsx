import {
  POWER_UP_CATALOG,
  POWER_UP_TYPE,
  type PowerUpEffect,
  type PowerUpType,
} from "@rahoot/common/types/powerup"
import {
  POWER_UP_META_UI,
  RARITY_STYLE,
} from "@rahoot/web/features/game/utils/powerupMeta"
import clsx from "clsx"
import { ShieldCheck, Repeat2 } from "lucide-react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"
import { useEffect, useMemo, useState } from "react"

// Durée d'affichage : assez long pour être lu à travers une salle, assez court
// pour ne pas casser le rythme du quiz. L'annonce se superpose à la question,
// on la veut donc vraiment brève.
export const ATTACK_ANNOUNCE_MS = 2200

// Couleur dominante par famille d'effet. Le rouge/orange dit « tu prends »,
// le cyan dit « tu es sauvé » : la salle doit comprendre l'issue avant même
// d'avoir lu les noms.
const OUTCOME_COLOR = {
  hit: { main: "#F97316", soft: "rgba(249,115,22,0.35)" },
  blocked: { main: "#22D3EE", soft: "rgba(34,211,238,0.35)" },
  mirrored: { main: "#A78BFA", soft: "rgba(167,139,250,0.35)" },
} as const

type Outcome = keyof typeof OUTCOME_COLOR

// Seules les attaques dirigées contre quelqu'un méritent la pleine mise en
// scène : les bonus personnels (Double Points, Bouclier posé…) gardent le toast
// discret, sinon l'écran principal clignote en permanence.
const ATTACK_TARGETS = new Set([
  "ONE_OPPONENT",
  "TWO_OPPONENTS",
  "ALL_OPPONENTS",
  "LEADER_AUTO",
])

export const isAttackEffect = (type: PowerUpType): boolean =>
  ATTACK_TARGETS.has(POWER_UP_CATALOG[type]?.target ?? "SELF")

// Variants plutôt que des `delay` recopiés sur chaque enfant : le parent
// orchestre l'entrée via `staggerChildren`, et la version reduced-motion se
// décrit une seule fois au lieu d'un ternaire dupliqué ligne par ligne.
//
// Les enfants entrent en ressort (`visualDuration`/`bounce`) : une annonce
// d'attaque doit avoir un impact physique, qu'une interpolation linéaire ne
// donne pas. `bounce` reste faible — au-delà, le texte tremble et devient
// pénible à lire à la 20e attaque de la soirée.
const buildVariants = (reduced: boolean) => {
  if (reduced) {
    const fade: Variants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.2 } },
      exit: { opacity: 0, transition: { duration: 0.15 } },
    }

    return {
      container: {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      } as Variants,
      line: fade,
      icon: fade,
      verdict: fade,
    }
  }

  const container: Variants = {
    hidden: { opacity: 0, scale: 0.94 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        visualDuration: 0.3,
        bounce: 0.15,
        // `delayChildren` laisse le voile s'installer avant que le texte entre.
        delayChildren: 0.05,
        staggerChildren: 0.06,
      },
    },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  }

  const line: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", visualDuration: 0.28, bounce: 0.2 },
    },
  }

  const icon: Variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", visualDuration: 0.32, bounce: 0.38 },
    },
  }

  // Le verdict est le mot que la salle doit lire : il arrive le plus franchement.
  const verdict: Variants = {
    hidden: { opacity: 0, scale: 0.88, y: 10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: "spring", visualDuration: 0.3, bounce: 0.34 },
    },
  }

  return { container, line, icon, verdict }
}

type Props = {
  effect: PowerUpEffect
  onDone: () => void
}

const PowerUpAttackAnnounce = ({ effect, onDone }: Props) => {
  const reducedMotion = useReducedMotion() ?? false
  const variants = useMemo(() => buildVariants(reducedMotion), [reducedMotion])
  const meta = POWER_UP_META_UI[effect.type]

  useEffect(() => {
    const timer = setTimeout(onDone, ATTACK_ANNOUNCE_MS)

    return () => clearTimeout(timer)
  }, [onDone])

  if (!meta) {
    return null
  }

  const attacker = effect.activatedByUsername ?? "Un joueur"

  let outcome: Outcome = "hit"

  if (effect.mirrored) {
    outcome = "mirrored"
  } else if (effect.blockedByUsername) {
    outcome = "blocked"
  }

  const color = OUTCOME_COLOR[outcome]

  // Victimes réelles : on retire l'attaquant de la liste (certains effets le
  // créditent des points volés, il n'est pas une cible).
  const victims = effect.affectedPlayers
    .filter((p) => p.username !== attacker && p.pointsDelta < 0)
    .map((p) => p.username)
    .filter((name, i, arr) => arr.indexOf(name) === i)

  const loss = effect.affectedPlayers
    .filter((p) => p.pointsDelta < 0)
    .reduce((min, p) => Math.min(min, p.pointsDelta), 0)

  let verdict = meta.label
  let targetLine = victims.join(" · ")

  if (outcome === "blocked") {
    verdict = "BLOQUÉ !"
    targetLine = `${effect.blockedByUsername} encaisse sans broncher`
  } else if (outcome === "mirrored") {
    verdict = "RENVOYÉ !"
    targetLine = `${attacker} prend son propre coup`
  } else if (effect.type === POWER_UP_TYPE.APOCALYPSE) {
    targetLine = "TOUT LE MONDE"
  }

  // L'icône raconte l'issue, pas le power-up : un bouclier qui tient ou un
  // renvoi priment sur l'arme employée.
  let OutcomeIcon = meta.Icon

  if (outcome === "blocked") {
    OutcomeIcon = ShieldCheck
  } else if (outcome === "mirrored") {
    OutcomeIcon = Repeat2
  }

  const rarity = RARITY_STYLE[meta.rarity]

  // Phrase lue par les lecteurs d'écran. Le rendu visuel éclate l'information
  // sur trois lignes (attaquant / verdict / cible), ce qui se lit très mal à
  // voix haute : on recompose donc une phrase entière.
  let announcement = `${attacker} utilise ${meta.label}`

  if (outcome === "blocked") {
    announcement = `${effect.blockedByUsername} bloque l'attaque ${meta.label} de ${attacker}`
  } else if (outcome === "mirrored") {
    announcement = `${attacker} utilise ${meta.label}, l'attaque est renvoyée contre lui`
  } else if (targetLine) {
    announcement = `${attacker} utilise ${meta.label} sur ${targetLine}`

    if (loss < 0) {
      announcement += `, ${Math.abs(loss)} points perdus`
    }
  }

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      // L'information portée ici (qui attaque qui, combien de points) n'existe
      // nulle part ailleurs : sans région live, un joueur au lecteur d'écran
      // ne saurait jamais qu'il vient de se faire voler des points.
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={announcement}
    >
      {/* Voile : l'annonce doit dominer l'écran, pas cohabiter avec lui. Un
          voile trop léger laissait le bandeau de question transparaître sous le
          verdict — deux couches de texte superposées, illisibles de loin. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{
          duration: ATTACK_ANNOUNCE_MS / 1000,
          times: [0, 0.08, 0.75, 1],
          ease: "linear",
        }}
        style={{
          // Base sombre UNIFORME, teinte par-dessus. Un simple dégradé radial
          // éclaircissait le centre — exactement là où se pose le texte — et
          // laissait le bandeau de question transparaître sous le verdict.
          backgroundColor: "rgba(2,6,23,0.94)",
          backgroundImage: `radial-gradient(ellipse at center, ${color.soft} 0%, transparent 55%)`,
        }}
      />

      {/* Impact : un seul flash bref au moment du choc. Supprimé en
          reduced-motion (c'est le composant le plus agressif de l'écran). */}
      {!reducedMotion && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: 0.4, times: [0, 0.12, 1], ease: "linear" }}
          style={{ backgroundColor: color.main }}
        />
      )}

      <motion.div
        className="relative flex flex-col items-center gap-3 px-6 text-center"
        variants={variants.container}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Attaquant */}
        <motion.span
          className="text-sm font-black tracking-[0.35em] text-white/70 uppercase"
          variants={variants.line}
        >
          {attacker}
        </motion.span>

        {/* Icône du power-up, cerclée à sa couleur de rareté */}
        <motion.div
          className={clsx(
            "flex size-24 items-center justify-center rounded-3xl border-2 backdrop-blur-xl",
            rarity.border,
          )}
          variants={variants.icon}
          style={{
            background: `radial-gradient(circle at 50% 35%, ${color.soft} 0%, rgba(2,6,23,0.85) 70%)`,
            boxShadow: `0 0 50px ${color.soft}`,
          }}
        >
          <OutcomeIcon className="size-12" style={{ color: color.main }} />
        </motion.div>

        {/* Verdict : le mot que la salle doit lire en une fraction de seconde */}
        <motion.h2
          className="font-black tracking-tight text-white uppercase"
          variants={variants.verdict}
          style={{
            fontSize: "clamp(2rem, 7vw, 4.5rem)",
            lineHeight: 1,
            textShadow: `0 0 28px ${color.soft}, 0 4px 18px rgba(0,0,0,0.8)`,
          }}
        >
          {verdict}
        </motion.h2>

        {/* Cible + points perdus */}
        {targetLine && (
          <motion.div
            className="flex flex-wrap items-center justify-center gap-3"
            variants={variants.line}
          >
            <span
              className="text-xl font-black text-white sm:text-3xl"
              style={{ textShadow: "0 3px 14px rgba(0,0,0,0.9)" }}
            >
              {targetLine}
            </span>
            {outcome === "hit" && loss < 0 && (
              <span
                className="rounded-xl px-3 py-1 text-xl font-black tabular-nums sm:text-2xl"
                style={{
                  color: color.main,
                  background: color.soft,
                  boxShadow: `0 0 24px ${color.soft}`,
                }}
              >
                {loss} pts
              </span>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

// File d'attente : deux attaques peuvent se résoudre dans la même seconde. On
// les joue l'une après l'autre plutôt que superposées, sinon l'écran devient
// illisible au moment précis où il doit raconter quelque chose.
export const usePowerUpAttackQueue = () => {
  const [queue, setQueue] = useState<PowerUpEffect[]>([])

  const push = (effect: PowerUpEffect) => {
    setQueue((prev) => [...prev, effect])
  }

  const shift = () => {
    setQueue((prev) => prev.slice(1))
  }

  return { current: queue[0] ?? null, push, shift }
}

export const PowerUpAttackLayer = ({
  current,
  onDone,
}: {
  current: PowerUpEffect | null
  onDone: () => void
}) => (
  <AnimatePresence>
    {current && (
      <PowerUpAttackAnnounce
        key={`${current.type}-${current.activatedBy}-${current.affectedPlayers.length}`}
        effect={current}
        onDone={onDone}
      />
    )}
  </AnimatePresence>
)

export default PowerUpAttackAnnounce
