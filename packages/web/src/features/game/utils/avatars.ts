import { LOCAL_PETDEX_AVATARS } from "@rahoot/web/features/game/utils/petdex-local"

export type PetdexAvatar = {
  seed: string
  label: string
  spritesheetUrl: string
  remoteSpritesheetUrl?: string
}

// Offline first: populated by `tasks/petdex-sync.ps1`.
// Remote fallback helps fresh clones run without syncing pets.
const REMOTE_FALLBACK_AVATARS: readonly PetdexAvatar[] = [
  {
    seed: "boba",
    label: "Boba",
    spritesheetUrl: "/pets/boba/spritesheet.webp",
    remoteSpritesheetUrl:
      "https://pub-94495283df974cfea5e98d6a9e3fa462.r2.dev/curated/boba/spritesheet.webp",
  },
  {
    seed: "cosmo",
    label: "Crafternauta",
    spritesheetUrl: "/pets/cosmo/spritesheet.webp",
    remoteSpritesheetUrl:
      "https://pub-94495283df974cfea5e98d6a9e3fa462.r2.dev/curated/cosmo/spritesheet.webp",
  },
  {
    seed: "nukey",
    label: "Nukey",
    spritesheetUrl: "/pets/nukey/spritesheet.webp",
    remoteSpritesheetUrl:
      "https://pub-94495283df974cfea5e98d6a9e3fa462.r2.dev/curated/nukey/spritesheet.webp",
  },
] as const

const CDN_BASE = "https://pub-94495283df974cfea5e98d6a9e3fa462.r2.dev/curated"

const withCdnFallback = (
  avatars: readonly PetdexAvatar[],
): readonly PetdexAvatar[] =>
  avatars.map((a) => ({
    ...a,
    remoteSpritesheetUrl:
      a.remoteSpritesheetUrl ?? `${CDN_BASE}/${a.seed}/spritesheet.webp`,
  }))

export const PETDEX_AVATARS: readonly PetdexAvatar[] = withCdnFallback(
  LOCAL_PETDEX_AVATARS.length > 0
    ? LOCAL_PETDEX_AVATARS
    : REMOTE_FALLBACK_AVATARS,
)

export const AVATAR_SEEDS = PETDEX_AVATARS.map(
  (a) => a.seed,
) as readonly string[]
export type AvatarSeed = (typeof AVATAR_SEEDS)[number]

// Un personnage local reste le secours, même pour les anciens identifiants.
export const DEFAULT_AVATAR: PetdexAvatar = {
  seed: "asterix",
  label: "Astérix",
  spritesheetUrl: "/pets/asterix/spritesheet.webp",
  remoteSpritesheetUrl: `${CDN_BASE}/asterix/spritesheet.webp`,
}

export function getPetdexAvatar(seed: string): PetdexAvatar {
  return PETDEX_AVATARS.find((a) => a.seed === seed) ?? DEFAULT_AVATAR
}

export function getAvatarUrl(seed: string): string {
  return getPetdexAvatar(seed).spritesheetUrl
}
