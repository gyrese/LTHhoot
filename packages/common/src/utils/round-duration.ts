import type { Question, SlideElement } from "@rahoot/common/types/game"

// Plafond de sécurité pour une durée dérivée d'un média (10 min). Il reflète le
// `max` du validateur `time` : une vidéo anormalement longue (ou une durée
// erronée remontée par le client) ne doit pas produire une manche interminable.
export const MAX_MEDIA_ROUND_TIME = 600

// Durée d'un extrait audio YouTube encodé `yt:<videoId>:<start>:<end>`.
// Retourne 0 si la borne de fin est absente : la durée réelle n'est alors
// connue que du lecteur, côté navigateur.
const parseAudioClipDuration = (audio: string | undefined): number => {
  if (!audio?.startsWith("yt:")) {
    return 0
  }

  const [, rawStart, rawEnd] = audio.slice(3).split(":")
  const start = parseInt(rawStart ?? "0", 10) || 0
  const end = parseInt(rawEnd ?? "0", 10) || 0

  return end > start ? end - start : 0
}

// Durée du plus long extrait vidéo posé sur la slide. Même règle que l'audio :
// sans `endTime`, la durée est inconnue à ce stade.
const parseElementsClipDuration = (
  elements: SlideElement[] | undefined,
): number => {
  if (!elements?.length) {
    return 0
  }

  return elements.reduce((longest, element) => {
    if (element.type !== "youtube") {
      return longest
    }

    const { startTime, endTime } = element
    const duration = endTime > startTime ? endTime - startTime : 0

    return Math.max(longest, duration)
  }, 0)
}

// Durée d'extrait connue STATIQUEMENT pour une question (bornes saisies dans
// l'éditeur). 0 signifie « aucune borne » et non « pas de vidéo » : dans ce cas
// la durée réelle est remontée en jeu par le lecteur (cf. VIDEO_DURATION).
export const getStaticMediaDuration = (question: {
  audio?: string
  elements?: SlideElement[]
}): number =>
  Math.max(
    parseAudioClipDuration(question.audio),
    parseElementsClipDuration(question.elements),
  )

// Durée effective d'une manche : le temps configuré, étendu au besoin pour
// couvrir le média. La manche n'est JAMAIS raccourcie — un extrait court laisse
// le temps de réflexion prévu par l'hôte ; seul un média plus long que le temps
// imparti repousse la fin, pour qu'il puisse être écouté ou visionné en entier.
export const resolveRoundDuration = (
  configuredTime: number,
  mediaDuration: number,
): number => {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    return configuredTime
  }

  // Arrondi au supérieur : couper la dernière fraction de seconde d'un extrait
  // tronquerait la note finale d'un blind test.
  const needed = Math.min(Math.ceil(mediaDuration), MAX_MEDIA_ROUND_TIME)

  return Math.max(configuredTime, needed)
}

// Durée de manche d'une question, telle que calculable sans le navigateur.
export const getQuestionRoundDuration = (question: Question): number =>
  resolveRoundDuration(question.time, getStaticMediaDuration(question))
