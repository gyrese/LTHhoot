import type { Transition, Variants } from "motion/react"

// ─── Tokens de motion ─────────────────────────────────────────────────────────
// Source de vérité des durées/courbes côté jeu. Toute nouvelle animation framer
// doit piocher ici plutôt que redéfinir des valeurs inline : c'est ce qui donne
// un rythme cohérent entre les écrans (cf. plan « Motion A+B+E », tasks/todo.md).

export const MOTION_DUR = {
  /** Sorties, micro-feedbacks — ne doit jamais faire attendre le joueur */
  fast: 0.15,
  /** Entrées standard */
  base: 0.3,
  /** Moments de mise en scène (révélation, podium) */
  dramatic: 0.6,
} as const

export const MOTION_EASE = {
  /** Ease-out expo : départ vif, atterrissage doux — entrées d'éléments */
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
} as const

/** Spring standard : pops de confirmation, badges, éléments interactifs */
export const MOTION_SPRING: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
}

// ─── Variants réutilisables ───────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DUR.base, ease: MOTION_EASE.out },
  },
}

/**
 * Props `initial`/`animate`/`exit` du conteneur de contenu de GameWrapper.
 * Fondu enchaîné rapide entre deux états — volontairement sobre (les
 * tentatives plus démonstratives — balayage, glitch RGB — n'ont pas
 * convaincu). Utilisé avec `AnimatePresence` en mode par défaut (sync, pas
 * "wait") pour que sortie et entrée se chevauchent : sans ce chevauchement,
 * l'ancien état disparaît avant que le nouveau soit visible et on voit le
 * fond générique du conteneur pendant l'intervalle. Sans mouvement
 * directionnel, donc déjà compatible prefers-reduced-motion.
 */
export const stateTransition = () => ({
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: MOTION_DUR.fast, ease: MOTION_EASE.out },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION_DUR.fast },
  },
})

// ─── Apparition des réponses sur l'écran hôte ─────────────────────────────────

/** Écart entre l'arrivée de deux cases de réponse (secondes). */
export const ANSWER_ENTRANCE_STAGGER = 0.4

/**
 * « Glissé + rebond » : chaque case monte depuis le bas avec un léger
 * dépassement (spring peu amorti), l'une après l'autre. Purement décoratif —
 * le chrono et les téléphones ne sont pas retardés. `reduceMotion` : aucune
 * animation (apparition immédiate de toutes les cases).
 */
export const answerEntrance = (index: number, reduceMotion: boolean) =>
  reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 140 },
        animate: { opacity: 1, y: 0 },
        transition: {
          y: {
            type: "spring" as const,
            stiffness: 320,
            damping: 16,
            delay: index * ANSWER_ENTRANCE_STAGGER,
          },
          opacity: {
            duration: MOTION_DUR.fast,
            delay: index * ANSWER_ENTRANCE_STAGGER,
          },
        },
      }
