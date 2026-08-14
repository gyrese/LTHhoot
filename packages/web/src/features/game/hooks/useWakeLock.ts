import { useEffect } from "react"

// Typage défensif : WakeLockSentinel n'est pas garanti dans le lib.dom du projet.
type WakeLockSentinelLike = {
  release: () => Promise<void>
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (_type: "screen") => Promise<WakeLockSentinelLike>
  }
}

// Maintient l'écran allumé pendant la partie (Screen Wake Lock API).
// Sans ça, l'écran d'un joueur qui attend dans le salon se verrouille, l'OS
// suspend la page et le socket meurt silencieusement → il rate le début de la
// question suivante. L'OS libère le verrou à chaque passage en arrière-plan :
// on le re-demande au retour de visibilité. Échec (batterie faible, navigateur
// non supporté) = non bloquant, on retombe sur le watchdog de reconnexion.
const useWakeLock = () => {
  useEffect(() => {
    const { wakeLock } = navigator as NavigatorWithWakeLock

    if (!wakeLock) {
      return
    }

    let sentinel: WakeLockSentinelLike | null = null
    let unmounted = false

    const request = async () => {
      try {
        const lock = await wakeLock.request("screen")

        if (unmounted) {
          void lock.release().catch(() => {})

          return
        }

        sentinel = lock
      } catch {
        // Refusé (économie d'énergie, permission) : le watchdog reste le filet.
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void request()
      }
    }

    void request()
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      unmounted = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void sentinel?.release().catch(() => {})
    }
  }, [])
}

export default useWakeLock
