import crypto from "crypto"

const KEY_LENGTH = 64

// Hash du mot de passe manager avec scrypt (crypto natif Node, pas de dépendance
// npm supplémentaire). Le salt est stocké en clair à côté du hash (format
// `salt:hash`) : c'est la pratique standard pour scrypt, la sécurité repose sur
// le coût de calcul de la fonction, pas sur le secret du salt.
export const hashPassword = (plain: string): string => {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(plain, salt, KEY_LENGTH).toString("hex")

  return `${salt}:${hash}`
}

export const verifyPassword = (plain: string, stored: string): boolean => {
  const [salt, hash] = stored.split(":")

  if (!salt || !hash) {
    return false
  }

  const hashBuffer = Buffer.from(hash, "hex")
  const candidateBuffer = crypto.scryptSync(plain, salt, KEY_LENGTH)

  // timingSafeEqual exige deux buffers de même longueur, sinon il lève une
  // exception : un hash stocké corrompu/tronqué ne doit pas planter l'auth.
  if (hashBuffer.length !== candidateBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(hashBuffer, candidateBuffer)
}
