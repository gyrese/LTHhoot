import { LOCAL_PETDEX_AVATARS } from "@rahoot/web/features/game/utils/petdex-local"

export type PetdexAvatar = {
  seed: string
  label: string
  spritesheetUrl: string
}

// Généré par `tasks/petdex-sync.ps1` : les spritesheets sont servies par l'app.
export const PETDEX_AVATARS: readonly PetdexAvatar[] = LOCAL_PETDEX_AVATARS

export const AVATAR_SEEDS = PETDEX_AVATARS.map(
  (a) => a.seed,
) as readonly string[]
export type AvatarSeed = (typeof AVATAR_SEEDS)[number]

const hashSeed = (seed: string): number =>
  Array.from(seed).reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) % 2147483647,
    0,
  )

// Toujours un vrai personnage : graine exacte, puis insensible à la casse,
// sinon (ancien identifiant, pseudo) un personnage stable dérivé de la graine.
export function getPetdexAvatar(seed: string): PetdexAvatar {
  const lower = seed.toLowerCase()

  return (
    PETDEX_AVATARS.find((a) => a.seed === seed) ??
    PETDEX_AVATARS.find((a) => a.seed.toLowerCase() === lower) ??
    PETDEX_AVATARS[hashSeed(seed) % PETDEX_AVATARS.length]
  )
}

export function getAvatarUrl(seed: string): string {
  return getPetdexAvatar(seed).spritesheetUrl
}

const SPRITESHEET_RETRIES = 3
const SPRITESHEET_RETRY_MS = 1500

const spritesheetCache = new Map<string, Promise<HTMLImageElement>>()

const loadImageOnce = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })

// Une seule requête par spritesheet pour toute la page (plusieurs écrans
// affichent le même joueur) ; un échec réseau est retenté au lieu d'abandonner.
export function loadSpritesheet(url: string): Promise<HTMLImageElement> {
  const cached = spritesheetCache.get(url)

  if (cached) {
    return cached
  }

  const attempt = (retry: number): Promise<HTMLImageElement> =>
    loadImageOnce(url).catch(
      (error: unknown) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          if (retry >= SPRITESHEET_RETRIES) {
            reject(error)

            return
          }

          setTimeout(
            () => {
              attempt(retry + 1).then(resolve, reject)
            },
            SPRITESHEET_RETRY_MS * (retry + 1),
          )
        }),
    )

  const promise = attempt(0).catch((error: unknown) => {
    // Pas de cache sur l'échec : le prochain affichage retentera.
    spritesheetCache.delete(url)
    throw error
  })

  spritesheetCache.set(url, promise)

  return promise
}
