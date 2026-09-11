// Mode rapide — intensités et temporisations.
//
// Source de vérité UNIQUE des durées du mode rapide, partagée serveur/client :
// le serveur pilote l'enchaînement, le client accorde ses animations dessus.
// Les valeurs vivaient auparavant en constantes éparpillées dans
// round-manager.ts, ce qui rendait impossible d'en juger le rythme d'ensemble.

export const FAST_MODE_INTENSITY = {
  /** Enchaîné mais lisible — laisse le temps de lire l'énoncé. */
  SMOOTH: "SMOOTH",
  /** Défaut : nerveux sans être injouable. */
  NERVOUS: "NERVOUS",
  /** « Hurry Up! » — pression maximale, temps de réponse dégressif. */
  HURRY_UP: "HURRY_UP",
} as const

export type FastModeIntensity =
  (typeof FAST_MODE_INTENSITY)[keyof typeof FAST_MODE_INTENSITY]

export interface FastModeTiming {
  /** Écran d'accueil avant le décompte de lancement (s). */
  intro: number
  /** Décompte 3-2-1 avant la première question (s). */
  countdown: number
  /**
   * Écran « Prêt ? » entre deux questions (s). `0` = écran supprimé : la
   * question enchaîne directement, sans cet intermédiaire qui, sous la
   * seconde, ne fait plus que clignoter.
   */
  prepared: number
  /** Plafond du temps de lecture de l'énoncé avant l'ouverture des réponses (s). */
  questionRead: number
  /** Affichage du résultat avant la question suivante (s). */
  results: number
  /**
   * Secondes retirées au temps de réponse à chaque question franchie
   * (`0` = temps constant). C'est la montée en pression facon WarioWare.
   */
  speedUpStep: number
  /** Plancher du temps de réponse quand `speedUpStep` le rogne (s). */
  minAnswerTime: number
}

export const FAST_MODE_TIMINGS: Record<FastModeIntensity, FastModeTiming> = {
  SMOOTH: {
    intro: 2,
    countdown: 3,
    prepared: 1,
    questionRead: 2,
    results: 3,
    speedUpStep: 0,
    minAnswerTime: 5,
  },
  NERVOUS: {
    intro: 1,
    countdown: 2,
    prepared: 0,
    questionRead: 1,
    results: 2,
    speedUpStep: 0,
    minAnswerTime: 4,
  },
  HURRY_UP: {
    intro: 1,
    countdown: 2,
    prepared: 0,
    questionRead: 1,
    results: 1,
    speedUpStep: 1,
    minAnswerTime: 3,
  },
}

export const DEFAULT_FAST_MODE_INTENSITY: FastModeIntensity =
  FAST_MODE_INTENSITY.NERVOUS

export const getFastModeTiming = (
  intensity?: FastModeIntensity,
): FastModeTiming => FAST_MODE_TIMINGS[intensity ?? DEFAULT_FAST_MODE_INTENSITY]

/**
 * Temps de réponse d'une question, rogné par l'accélération progressive.
 *
 * `questionIndex` est le rang de la question DÉJÀ jouée (0 pour la première,
 * qui garde donc toujours son temps plein). Le plancher `minAnswerTime` est
 * respecté même si le temps configuré lui est inférieur : on ne rallonge
 * jamais une question courte.
 */
export const resolveFastAnswerTime = (
  configuredTime: number,
  questionIndex: number,
  timing: FastModeTiming,
): number => {
  if (timing.speedUpStep <= 0) {
    return configuredTime
  }

  const reduced = configuredTime - questionIndex * timing.speedUpStep
  const floor = Math.min(timing.minAnswerTime, configuredTime)

  return Math.max(floor, reduced)
}
