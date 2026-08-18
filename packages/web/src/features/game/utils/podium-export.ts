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
const loadSpritesheet = async (
  pet: PetdexAvatar,
): Promise<HTMLImageElement> => {
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
  ctx.fillText(
    "L'APÉRO QUIZ & LES TOILES NOIRES",
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT - 40,
  )

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

export const downloadCanvasAsPng = (
  canvas: HTMLCanvasElement,
  filename: string,
) => {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `${sanitizeFilename(filename)}.png`)
    }
  }, "image/png")
}

export const renderScorecardToCanvas = async (
  username: string,
  avatar: string,
  points: number,
  rank: number | null,
  totalPlayers: number | null,
  subject: string,
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement("canvas")
  const size = 1080
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Canvas 2D context unavailable")
  }

  // 1. Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, size)
  gradient.addColorStop(0, "#0a0518")
  gradient.addColorStop(1, "#180c30")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  // 2. Subtle grid lines in the background
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)"
  ctx.lineWidth = 1
  const gridSpacing = 48
  for (let x = 0; x < size; x += gridSpacing) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
  }
  for (let y = 0; y < size; y += gridSpacing) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
  }

  // 3. Set color scheme based on rank
  let themeColor = "#ffffff"
  let rankLabel = rank ? `#${rank}` : "—"

  if (rank === 1) {
    themeColor = "#FAFF00" // Gold
    rankLabel = "1er"
  } else if (rank === 2) {
    themeColor = "#00F5FF" // Cyan
    rankLabel = "2ème"
  } else if (rank === 3) {
    themeColor = "#FF00E5" // Magenta
    rankLabel = "3ème"
  } else if (rank) {
    rankLabel = `${rank}e`
  }

  // Glowing double outer border
  ctx.save()
  ctx.strokeStyle = themeColor
  ctx.lineWidth = 4
  ctx.shadowColor = themeColor
  ctx.shadowBlur = 30
  ctx.beginPath()
  ctx.roundRect(50, 50, size - 100, size - 100, 36)
  ctx.stroke()
  ctx.restore()

  // Inner border border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(65, 65, size - 130, size - 130, 24)
  ctx.stroke()

  // 4. Header metadata
  ctx.textAlign = "center"
  ctx.fillStyle = themeColor
  ctx.font = "bold 20px monospace"
  ctx.fillText("L'APÉRO QUIZ & LES TOILES NOIRES", size / 2, 115)

  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 52px sans-serif"
  ctx.fillText(subject, size / 2, 185, size - 200)

  // 5. Draw Avatar
  const avatarCx = size / 2
  const avatarCy = size / 2 - 30
  const localAvatarSize = 240

  // Outer glowing ring for avatar
  ctx.save()
  ctx.strokeStyle = themeColor
  ctx.lineWidth = 6
  ctx.shadowColor = themeColor
  ctx.shadowBlur = 25
  ctx.beginPath()
  ctx.arc(avatarCx, avatarCy, localAvatarSize / 2 + 5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Draw actual avatar
  try {
    const { img, sw, sh } = await resolveAvatarImage(avatar)
    ctx.save()
    ctx.beginPath()
    ctx.arc(avatarCx, avatarCy, localAvatarSize / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(
      img,
      0,
      0,
      sw,
      sh,
      avatarCx - localAvatarSize / 2,
      avatarCy - localAvatarSize / 2,
      localAvatarSize,
      localAvatarSize,
    )
    ctx.restore()
  } catch {
    drawFallbackAvatar(ctx, avatar, avatarCx, avatarCy)
  }

  // Draw medal/rank overlay icon on top-right of avatar if top 3
  if (rank && rank <= 3) {
    ctx.save()
    ctx.font = "56px sans-serif"
    ctx.fillText(
      MEDAL_BY_RANK[rank] || "",
      avatarCx + localAvatarSize / 2 - 10,
      avatarCy - localAvatarSize / 2 + 20,
    )
    ctx.restore()
  }

  // 6. Username
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 54px sans-serif"
  ctx.fillText(username, size / 2, avatarCy + localAvatarSize / 2 + 80)

  // 7. Stats Box (Rank & Score)
  const boxY = avatarCy + localAvatarSize / 2 + 130
  const boxWidth = 660
  const boxHeight = 170
  const boxX = size / 2 - boxWidth / 2

  // Background and borders of the stats box
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)"
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 24)
  ctx.fill()
  ctx.stroke()

  // Separator line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"
  ctx.beginPath()
  ctx.moveTo(size / 2, boxY + 20)
  ctx.lineTo(size / 2, boxY + boxHeight - 20)
  ctx.stroke()

  // Left: Rank
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
  ctx.font = "bold 20px monospace"
  ctx.fillText("CLASSEMENT", boxX + boxWidth / 4, boxY + 55)

  ctx.fillStyle = themeColor
  ctx.font = "bold 54px sans-serif"
  let rankText = rankLabel

  if (totalPlayers) {
    rankText += ` / ${totalPlayers}`
  }

  ctx.fillText(rankText, boxX + boxWidth / 4, boxY + 120)

  // Right: Score
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
  ctx.font = "bold 20px monospace"
  ctx.fillText("SCORE", boxX + (3 * boxWidth) / 4, boxY + 55)

  const scoreCenter = boxX + (3 * boxWidth) / 4
  const pointsStr = points.toLocaleString()
  ctx.font = "bold 54px sans-serif"
  const valWidth = ctx.measureText(pointsStr).width
  ctx.font = "bold 24px sans-serif"
  const suffixWidth = ctx.measureText(" pts").width
  const totalWidth = valWidth + suffixWidth
  const startDrawX = scoreCenter - totalWidth / 2

  // Draw score value (left-aligned from startDrawX)
  ctx.textAlign = "left"
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 54px sans-serif"
  ctx.fillText(pointsStr, startDrawX, boxY + 120)

  // Draw suffix (left-aligned after value)
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)"
  ctx.font = "bold 24px sans-serif"
  ctx.fillText(" pts", startDrawX + valWidth, boxY + 120)

  // 8. Footer brand
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)"
  ctx.font = "bold 24px monospace"
  ctx.fillText("L'APÉRO QUIZ & LES TOILES NOIRES", size / 2, size - 85)

  return canvas
}

export const renderSoloVictoryToCanvas = async (
  username: string,
  points: number,
  subject: string,
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement("canvas")
  const size = 1024
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Canvas 2D context unavailable")
  }

  // 1. Image template vintage
  const img = await loadImage("/solo-victory-template.jpg")
  ctx.drawImage(img, 0, 0, size, size)

  // 2. Nom du joueur (centré entre les délimiteurs verticaux)
  ctx.save()
  ctx.fillStyle = "#1e1a17"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  const maxNameWidth = 400
  let nameFontSize = 46
  ctx.font = `900 ${nameFontSize}px "Impact", "Arial Black", "Montserrat", sans-serif`
  while (ctx.measureText(username).width > maxNameWidth && nameFontSize > 20) {
    nameFontSize -= 2
    ctx.font = `900 ${nameFontSize}px "Impact", "Arial Black", "Montserrat", sans-serif`
  }
  ctx.fillText(username, 508, 642)
  ctx.restore()

  // 3. Nombre de points (positionné à droite avant "pts")
  ctx.save()
  ctx.fillStyle = "#1e1a17"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const pointsStr = points.toLocaleString()
  let pointsFontSize = 38
  ctx.font = `900 ${pointsFontSize}px "Impact", "Arial Black", "Montserrat", sans-serif`
  const maxPtsWidth = 95
  while (ctx.measureText(pointsStr).width > maxPtsWidth && pointsFontSize > 20) {
    pointsFontSize -= 2
    ctx.font = `900 ${pointsFontSize}px "Impact", "Arial Black", "Montserrat", sans-serif`
  }
  ctx.fillText(pointsStr, 758, 642)
  ctx.restore()

  // 4. Nom du quiz (dans la bannière violette en dessous)
  ctx.save()
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)"
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2

  const maxSubjectWidth = 630
  let subjectFontSize = 34
  const displaySubject = subject.toUpperCase()
  ctx.font = `900 ${subjectFontSize}px "Impact", "Arial Black", "Montserrat", sans-serif`
  while (
    ctx.measureText(displaySubject).width > maxSubjectWidth &&
    subjectFontSize > 16
  ) {
    subjectFontSize -= 2
    ctx.font = `900 ${subjectFontSize}px "Impact", "Arial Black", "Montserrat", sans-serif`
  }
  ctx.fillText(displaySubject, 532, 776)
  ctx.restore()

  return canvas
}

