import type { Player } from "@rahoot/common/types/game"
import {
  getDiceBearUrl,
  getPetdexAvatar,
  type PetdexAvatar,
} from "@rahoot/web/features/game/utils/avatars"

// Doit rester synchronisé avec GameAvatar.tsx (grille du spritesheet Petdex) —
// dupliqué ici plutôt que de faire dépendre ce composant purement visuel d'un
// export supplémentaire du composant de jeu.
const PETDEX_GRID = { cols: 8, rows: 9 }

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1350
const AVATAR_SIZE = 130

const MEDAL_BY_RANK: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" }

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })

const drawFallbackAvatar = (
  ctx: CanvasRenderingContext2D,
  seed: string,
  cx: number,
  cy: number,
) => {
  ctx.fillStyle = "#f97316"
  ctx.beginPath()
  ctx.arc(cx, cy, AVATAR_SIZE / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold ${Math.round(AVATAR_SIZE * 0.45)}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText((seed[0] ?? "?").toUpperCase(), cx, cy)
}

// Spritesheet local d'abord, fallback CDN distant si le fichier n'est pas
// synchronisé localement (cf. `tasks/petdex-sync.ps1`).
const loadSpritesheet = async (pet: PetdexAvatar): Promise<HTMLImageElement> => {
  try {
    return await loadImage(pet.spritesheetUrl)
  } catch {
    if (!pet.remoteSpritesheetUrl) {
      throw new Error("no remote fallback")
    }

    return loadImage(pet.remoteSpritesheetUrl)
  }
}

type AvatarSource = { img: HTMLImageElement; sw: number; sh: number }

// Résout l'image source à dessiner + la zone à découper (frame idle du
// spritesheet Petdex, ou image DiceBear entière).
const resolveAvatarImage = async (seed: string): Promise<AvatarSource> => {
  const pet = getPetdexAvatar(seed)

  if (!pet) {
    const img = await loadImage(getDiceBearUrl(seed))

    return { img, sw: img.width, sh: img.height }
  }

  const img = await loadSpritesheet(pet)

  return {
    img,
    sw: Math.floor(img.width / PETDEX_GRID.cols),
    sh: Math.floor(img.height / PETDEX_GRID.rows),
  }
}

// Dessine l'avatar dans un cercle centré en (cx, cy). Retombe sur un rond
// initiale si le chargement échoue (réseau/CORS) — ne fait jamais échouer
// l'export entier.
const drawAvatar = async (
  ctx: CanvasRenderingContext2D,
  seed: string,
  cx: number,
  cy: number,
): Promise<void> => {
  try {
    const { img, sw, sh } = await resolveAvatarImage(seed)

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, AVATAR_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(
      img,
      0,
      0,
      sw,
      sh,
      cx - AVATAR_SIZE / 2,
      cy - AVATAR_SIZE / 2,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
    ctx.restore()
  } catch {
    drawFallbackAvatar(ctx, seed, cx, cy)
  }
}

// Construit un canvas dédié (fond dégradé néon + avatars + noms + scores) pour
// le top 3 — pas de capture DOM (le `backdrop-blur` omniprésent de l'app est
// mal supporté par les libs de capture DOM, et le CORS des avatars distants
// serait mal maîtrisé).
export const renderPodiumToCanvas = async (
  top: Player[],
  subject: string,
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement("canvas")
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT

  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Canvas 2D context unavailable")
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
  gradient.addColorStop(0, "#0f0f1a")
  gradient.addColorStop(1, "#1e1033")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.textAlign = "center"
  ctx.fillStyle = "#FAFF00"
  ctx.font = "bold 34px monospace"
  ctx.fillText("CLASSEMENT FINAL", CANVAS_WIDTH / 2, 110)

  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 52px monospace"
  ctx.fillText(subject, CANVAS_WIDTH / 2, 180, CANVAS_WIDTH - 120)

  const rowHeight = 260
  const startY = 320

  for (let i = 0; i < Math.min(3, top.length); i += 1) {
    const player = top[i]!
    const rank = i + 1
    const rowY = startY + i * rowHeight
    const avatarCx = 200
    const avatarCy = rowY + rowHeight / 2 - 20

    ctx.beginPath()
    ctx.fillStyle = "rgba(255,255,255,0.06)"
    ctx.roundRect(60, rowY, CANVAS_WIDTH - 120, rowHeight - 30, 24)
    ctx.fill()

    // eslint-disable-next-line no-await-in-loop
    await drawAvatar(ctx, player.avatar ?? player.username, avatarCx, avatarCy)

    ctx.textAlign = "left"
    ctx.fillStyle = rank === 1 ? "#FAFF00" : "#ffffff"
    ctx.font = "48px sans-serif"
    ctx.fillText(MEDAL_BY_RANK[rank] ?? `#${rank}`, 300, avatarCy - 25)

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 42px sans-serif"
    ctx.fillText(player.username, 420, avatarCy - 25)

    ctx.fillStyle = "#FAFF00"
    ctx.font = "bold 36px monospace"
    ctx.fillText(`${player.points.toLocaleString()} pts`, 420, avatarCy + 30)
  }

  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(255,255,255,0.3)"
  ctx.font = "24px monospace"
  ctx.fillText("LTNHOOT", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40)

  return canvas
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Le sujet du quiz est libre : on retire accents et caractères interdits selon
// l'OS (\ / : * ? " < > |) avant d'en faire un nom de fichier.
const sanitizeFilename = (name: string): string => {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-zA-Z0-9-_ ]/gu, "")
    .trim()
    .replace(/\s+/gu, "-")
    .toLowerCase()

  return slug || "podium"
}

export const downloadCanvasAsPng = (canvas: HTMLCanvasElement, filename: string) => {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `${sanitizeFilename(filename)}.png`)
    }
  }, "image/png")
}
