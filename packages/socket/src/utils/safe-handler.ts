// Garde-fou d'exécution pour les listeners socket.
//
// Contexte : l'état des parties vit 100 % en mémoire (cf. services/registry).
// Une exception non gérée — throw synchrone OU rejet de promesse — dans un seul
// handler ferait remonter l'erreur jusqu'au process. Avec `autorestart` côté
// supervisor, le process redémarre, la RAM est vidée et TOUTE la salle est
// éjectée d'un coup. Inacceptable : un bug applicatif sur un client ne doit
// jamais coûter la soirée aux autres.
//
// `wrapListener` capture les deux formes d'erreur et les isole (log + on continue).

type AnyListener = (..._args: any[]) => unknown

export const logHandlerError = (context: string, err: unknown): void => {
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
  console.error(`[HANDLER_ERR] ${context}: ${detail}`)
}

// Enveloppe un listener pour qu'aucune exception ne s'échappe :
//  - throw synchrone        → capturé par le try/catch
//  - rejet de promesse async → capturé par le .catch sur le retour
export const wrapListener = (
  event: string | symbol,
  listener: AnyListener,
): AnyListener => {
  const label = `event=${String(event)}`

  return (...args: any[]) => {
    try {
      const result = listener(...args)

      if (result instanceof Promise) {
        result.catch((err) => logHandlerError(label, err))
      }

      return result
    } catch (err) {
      logHandlerError(label, err)

      return undefined
    }
  }
}
