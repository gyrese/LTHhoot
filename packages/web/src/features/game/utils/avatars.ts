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

export const PETDEX_AVATARS: readonly PetdexAvatar[] =
  LOCAL_PETDEX_AVATARS.length > 0 ? LOCAL_PETDEX_AVATARS : REMOTE_FALLBACK_AVATARS

export const AVATAR_SEEDS = PETDEX_AVATARS.map((a) => a.seed) as readonly string[]
export type AvatarSeed = (typeof AVATAR_SEEDS)[number]

const AVATAR_BG = [
  "b6e3f4",
  "c0aede",
  "d1d4f9",
  "ffd5dc",
  "ffdfbf",
  "d4f5d4",
  "f5e6c8",
  "fce4ec",
  "e8f4f8",
  "fff3e0",
  "f3e5f5",
  "e0f2f1",
]

export function getPetdexAvatar(seed: string): PetdexAvatar | undefined {
  return PETDEX_AVATARS.find((a) => a.seed === seed)
}

export function getAvatarUrl(seed: string): string {
  const pet = getPetdexAvatar(seed)
  if (pet) return pet.spritesheetUrl

  // Fallback: keep DiceBear support for older sessions / unknown seeds.
  const bg = AVATAR_BG[Math.abs(seed.charCodeAt(0)) % AVATAR_BG.length]
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`
}
