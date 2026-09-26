import type { Socket } from "@rahoot/common/types/game/socket"

// Adresses de proxys de confiance : boucle locale et réseaux privés (nginx du
// conteneur, reverse-proxy du réseau Docker). Derrière eux, l'adresse du socket
// est toujours la même pour tout le monde.
const PRIVATE_IP =
  /^(?:::1|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::ffff:(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)|f[cd][0-9a-f]{2}:)/iu

const isPrivate = (ip: string) => PRIVATE_IP.test(ip)

// IP réelle du client, pour le rate-limit. Quand la connexion arrive d'un proxy
// privé, on remonte `X-Forwarded-For` en partant de la DROITE et on garde la
// première adresse publique : les entrées de gauche sont fournies par le
// client lui-même et ne sont donc pas fiables (usurpation triviale).
export const getClientIp = (socket: Pick<Socket, "handshake">): string => {
  const address = socket.handshake.address || "unknown"

  if (!isPrivate(address)) {
    return address
  }

  const header = socket.handshake.headers["x-forwarded-for"]
  const raw = Array.isArray(header) ? header.join(",") : (header ?? "")
  const chain = raw
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean)

  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (!isPrivate(chain[i]!)) {
      return chain[i]!
    }
  }

  return address
}
