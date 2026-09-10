import { useEffect } from "react"

// Les messages du lecteur arrivent tantôt en JSON, tantôt déjà désérialisés
// selon le navigateur. Retourne `null` pour tout ce qui n'est pas exploitable.
const parsePayload = (data: unknown): unknown => {
  if (typeof data !== "string") {
    return data
  }

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

// Écoute les messages de l'API iframe YouTube pour récupérer la durée réelle
// d'une vidéo. On passe par postMessage plutôt que par le SDK `iframe_api` :
// les iframes sont déjà rendues par SlideCanvas/AudioEmbed, et charger le SDK
// pour les reprendre en main imposerait de tout réécrire.
//
// Prérequis : l'URL de l'iframe doit porter `enablejsapi=1`.
export function useYoutubeDuration(
  enabled: boolean,
  onDuration: (_seconds: number) => void,
) {
  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    // Une vidéo peut être signalée plusieurs fois (listener + relances du
    // sondage) : on ne retient que la plus longue et on ne notifie qu'en cas
    // de progression, pour ne pas spammer le serveur.
    let bestDuration = 0

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes("youtube.com")) {
        return
      }

      const payload = parsePayload(event.data)

      if (typeof payload !== "object" || payload === null) {
        return
      }

      const { info } = payload as { info?: unknown }

      if (typeof info !== "object" || info === null) {
        return
      }

      const { duration } = info as { duration?: unknown }

      if (typeof duration !== "number" || !Number.isFinite(duration)) {
        return
      }

      if (duration > bestDuration) {
        bestDuration = duration
        onDuration(duration)
      }
    }

    window.addEventListener("message", handleMessage)

    // L'iframe n'émet ses `infoDelivery` qu'après un `listening` de notre part.
    // On insiste quelques secondes : le lecteur peut n'être prêt qu'après le
    // chargement réseau, et un seul envoi arrive souvent trop tôt.
    const frames = () =>
      Array.from(document.querySelectorAll("iframe")).filter((frame) =>
        frame.src.includes("youtube.com/embed/"),
      )

    const requestListening = () => {
      for (const frame of frames()) {
        frame.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
          "*",
        )
      }
    }

    requestListening()

    const interval = setInterval(requestListening, 1000)
    const stop = setTimeout(() => clearInterval(interval), 10000)

    return () => {
      window.removeEventListener("message", handleMessage)
      clearInterval(interval)
      clearTimeout(stop)
    }
  }, [enabled, onDuration])
}
