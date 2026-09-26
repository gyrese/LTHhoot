import type { TFunction } from "i18next"

// Forme d'une clé i18n renvoyée par le serveur : "errors:quizz.notFound", ou
// "quizz.notFound" sans espace de noms (quelques handlers l'omettent).
const KEY_PATTERN = /^(?:[\w-]+:)?[\w-]+(?:\.[\w-]+)+$/u

// Traduit un message d'erreur serveur. Une clé sans espace de noms est lue
// dans `errors` ; une clé absente des traductions retombe sur un message
// générique plutôt que d'afficher la clé brute ; un texte libre (message
// d'exception) est affiché tel quel.
export const translateServerError = (t: TFunction, message: string) => {
  if (!KEY_PATTERN.test(message)) {
    return message
  }

  const key = message.includes(":") ? message : `errors:${message}`

  return t(key, { defaultValue: t("manager:errors.generic") })
}
